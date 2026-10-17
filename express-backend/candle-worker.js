/**
 * candle-worker.js
 * Background worker: persists 15-minute OHLCV candles to candles_15m table.
 *
 * DESIGN RULES (critical):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. HISTORICAL IMPORT (runs once):
 *    • Triggered only when latestStoredTs === null (no data in DB for that symbol).
 *    • Fetches the maximum available history (30d from Yahoo).
 *    • After success, sets latestStoredTs — subsequent runs are incremental.
 *
 * 2. INCREMENTAL SYNC (all normal scheduled runs):
 *    • Reads latestStoredTs from candle_sync_status (DB-persisted).
 *    • Computes the minimum Yahoo `range` param that covers only the gap.
 *    • Filters incoming candles: only saves those with timestamp > latestStoredTs
 *      (one-candle overlap kept to handle forming-candle corrections).
 *    • NEVER downloads 30d of history during a normal sync.
 *    • Duplicate-safe: DB UNIQUE constraint + ON CONFLICT DO UPDATE.
 *
 * 3. NO HISTORY DELETION — old candles are never removed.
 *
 * 4. FORMING CANDLES — a candle whose 15-min slot has not ended yet is stored
 *    with is_complete=false and updated in-place on future syncs.
 *
 * 5. CONCURRENT RUN GUARD — only one cycle runs at a time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const {
  ALL_SYMBOLS,
  alignTo15Min,
  isWeekdayIST,
  isMarketHoursIST,
  isCandleCompleted,
} = require('./candle-importer');

const {
  upsertCandles,
  getLatestCandleTs,
  getCandleCount,
  updateSyncStatus,
  getSyncStatus,
} = require('./candle-db');

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_EXCHANGE   = 'NSE';
const HISTORY_RANGE      = '30d';          // used only for first-ever import
const MAX_YAHOO_RANGE    = '30d';          // Yahoo's practical 15m history limit
const OVERLAP_CANDLES    = 2;              // keep this many existing candles in overlap
const MAX_DELAY_MS       = 800;            // max jitter between symbol requests (ms)
const BATCH_SIZE         = 8;             // symbols processed in one wave
const BATCH_DELAY_MS     = 1200;          // pause between waves (ms)

// 15-min candle duration in seconds
const CANDLE_SECONDS     = 15 * 60;

// Concurrent-run guard
let isRunning = false;

// Symbols to persist — all Nifty-50 stocks + NIFTY50 index + BTC
const WORKER_SYMBOLS = [
  ...ALL_SYMBOLS,
  { symbol: 'NIFTY50', name: 'Nifty 50 Index',  exchange: 'NSE'    },
  { symbol: 'BTC',     name: 'Bitcoin',           exchange: 'CRYPTO' },
];

// ── Yahoo ticker mapping ──────────────────────────────────────────────────────
function toYahooTicker(symbol, exchange) {
  if (symbol === 'NIFTY50') return '^NSEI';
  if (symbol === 'BTC')     return 'BTC-USD';
  return `${symbol}.NS`;
}

// ── Calculate the minimum Yahoo range string that covers the gap ──────────────
// Yahoo Finance accepts: 1d, 2d, 5d, 10d, 15d, 30d (for 15m interval)
// We pick the smallest range that covers (nowTs - latestStoredTs).
function gapToYahooRange(latestStoredTs) {
  if (latestStoredTs === null) return HISTORY_RANGE; // first-ever import
  const nowTs = Math.floor(Date.now() / 1000);
  const gapDays = (nowTs - latestStoredTs) / 86400;

  if (gapDays <= 1)  return '2d';   // 2d covers up to ~1.5d gap with buffer
  if (gapDays <= 4)  return '5d';
  if (gapDays <= 9)  return '10d';
  if (gapDays <= 14) return '15d';
  return MAX_YAHOO_RANGE;           // 30d — maximum available
}

// ── Fetch raw 15m candles from Yahoo Finance ──────────────────────────────────
async function fetchYahooCandles(ticker, range) {
  // Try both Yahoo mirrors — index tickers like ^NSEI sometimes get throttled on query1
  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=15m&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=15m&range=${range}`,
  ];

  let lastError;
  for (const url of endpoints) {
    // 20-second timeout per attempt
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':          'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control':   'no-cache',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        lastError = new Error(`Yahoo HTTP ${res.status} for ${ticker}`);
        await new Promise(r => setTimeout(r, 2000)); // wait before retry
        continue;
      }

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.timestamp || result.timestamp.length === 0) return [];

      const timestamps = result.timestamp;
      const q = result.indicators?.quote?.[0];
      if (!q) return [];

      // De-duplicate by 15m aligned timestamp
      const candleMap = new Map();
      for (let i = 0; i < timestamps.length; i++) {
        const rawOpen  = q.open[i];
        const rawHigh  = q.high[i];
        const rawLow   = q.low[i];
        const rawClose = q.close[i];
        const rawVol   = q.volume?.[i] || 0;

        if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null) continue;

        const ts = alignTo15Min(timestamps[i]);

        if (candleMap.has(ts)) {
          const ex = candleMap.get(ts);
          ex.high   = Math.max(ex.high,  Number(rawHigh.toFixed(4)));
          ex.low    = Math.min(ex.low,   Number(rawLow.toFixed(4)));
          ex.close  = Number(rawClose.toFixed(4));
          ex.volume += rawVol;
        } else {
          candleMap.set(ts, {
            timestamp:  ts,
            open:       Number(rawOpen.toFixed(4)),
            high:       Number(rawHigh.toFixed(4)),
            low:        Number(rawLow.toFixed(4)),
            close:      Number(rawClose.toFixed(4)),
            volume:     rawVol,
            isComplete: isCandleCompleted(ts),
          });
        }
      }

      return Array.from(candleMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err.name === 'AbortError'
        ? new Error(`Fetch timed out for ${ticker} (20s)`)
        : err;
      await new Promise(r => setTimeout(r, 2000)); // wait before trying mirror
    }
  }

  throw lastError || new Error(`All endpoints failed for ${ticker}`);
}

// ── Filter candles: for NSE stocks, keep only trading hours; allow all for CRYPTO ──
function applyMarketFilter(candles, exchange) {
  if (exchange === 'CRYPTO') return candles; // BTC trades 24/7
  return candles.filter(c => isWeekdayIST(c.timestamp) && isMarketHoursIST(c.timestamp));
}

// ── Core: sync one symbol ─────────────────────────────────────────────────────
async function syncSymbol(symbolObj) {
  const { symbol, name } = symbolObj;
  const exchange = symbolObj.exchange || DEFAULT_EXCHANGE;
  const logPrefix = `[WORKER][${symbol}]`;

  // Record attempt time
  await updateSyncStatus(symbol, exchange, {
    lastSyncAttempt: new Date(),
    syncStatus:      'running',
    lastInserted:    0,
    lastUpdated:     0,
  });

  try {
    // ── Step 1: determine latest stored timestamp ────────────────────────────
    const latestStoredTs = await getLatestCandleTs(symbol, exchange);
    const isFirstImport  = (latestStoredTs === null);

    // ── Step 2: pick the minimum Yahoo range needed ──────────────────────────
    const range = gapToYahooRange(latestStoredTs);
    const ticker = toYahooTicker(symbol, exchange);

    console.log(
      `${logPrefix} ${isFirstImport ? '🚀 First import' : '🔄 Incremental'} | ` +
      `range=${range} | latest=${latestStoredTs ? new Date(latestStoredTs * 1000).toISOString() : 'none'}`
    );

    // ── Step 3: fetch from Yahoo ─────────────────────────────────────────────
    const rawCandles = await fetchYahooCandles(ticker, range);
    if (rawCandles.length === 0) {
      console.log(`${logPrefix} No data returned from Yahoo`);
      const total = await getCandleCount(symbol, exchange);
      await updateSyncStatus(symbol, exchange, {
        candlesTotal: total,
        lastInserted: 0,
        lastUpdated:  0,
        syncStatus:   'ok',
        lastError:    null,
        lastSyncSuccess: new Date(),
      });
      return { symbol, inserted: 0, updated: 0, total };
    }

    // ── Step 4: apply market-hours filter ────────────────────────────────────
    const filtered = applyMarketFilter(rawCandles, exchange);

    // ── Step 5: incremental filter ────────────────────────────────────────────
    // For incremental syncs, only keep candles newer than (latestStoredTs - overlap).
    // The overlap covers:
    //   a) the last still-forming candle that was stored as is_complete=false
    //   b) legitimate corrections Yahoo publishes for recent candles
    let candlesToStore;
    if (isFirstImport) {
      // First-ever import: save everything
      candlesToStore = filtered;
    } else {
      // Overlap = last OVERLAP_CANDLES worth of 15m slots before latest stored
      const overlapCutoff = latestStoredTs - OVERLAP_CANDLES * CANDLE_SECONDS;
      candlesToStore = filtered.filter(c => c.timestamp >= overlapCutoff);

      if (candlesToStore.length === 0) {
        // Nothing newer — already up to date
        console.log(`${logPrefix} ✅ Already up-to-date (no new candles)`);
        const total = await getCandleCount(symbol, exchange);
        await updateSyncStatus(symbol, exchange, {
          candlesTotal:    total,
          lastInserted:    0,
          lastUpdated:     0,
          syncStatus:      'ok',
          lastError:       null,
          lastSyncSuccess: new Date(),
        });
        return { symbol, inserted: 0, updated: 0, total };
      }
    }

    // ── Step 6: upsert into DB ────────────────────────────────────────────────
    const { inserted, updated } = await upsertCandles(symbol, exchange, candlesToStore);

    const newLatestTs = candlesToStore[candlesToStore.length - 1]?.timestamp;
    const latestCompleteTs = candlesToStore.filter(c => c.isComplete).pop()?.timestamp ?? null;
    const total = await getCandleCount(symbol, exchange);

    await updateSyncStatus(symbol, exchange, {
      latestStoredTs:  newLatestTs,
      latestCompleteTs,
      candlesTotal:    total,
      lastInserted:    inserted,
      lastUpdated:     updated,
      syncStatus:      'ok',
      lastError:       null,
      lastSyncSuccess: new Date(),
    });

    const tag = isFirstImport ? 'INIT' : 'INCR';
    console.log(`${logPrefix} [${tag}] ✓ +${inserted} new, ~${updated} updated | DB total: ${total}`);
    return { symbol, inserted, updated, total };

  } catch (err) {
    console.error(`${logPrefix} ✗ ${err.message}`);
    const total = await getCandleCount(symbol, exchange).catch(() => 0);
    await updateSyncStatus(symbol, exchange, {
      candlesTotal: total,
      lastInserted: 0,
      lastUpdated:  0,
      lastError:    err.message,
      syncStatus:   'error',
    });
    return { symbol, inserted: 0, updated: 0, total, error: err.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
function jitter(maxMs) {
  return sleep(Math.floor(Math.random() * maxMs));
}

// ── Run a full sync cycle across all symbols ──────────────────────────────────
// Each symbol self-determines whether it needs a first import or just incremental.
// `forceHistorical` forces the 30d range even if data already exists (manual backfill only).
async function runSyncCycle(forceHistorical = false) {
  if (isRunning) {
    console.log('[WORKER] ⚠ Previous cycle still running — skipping this trigger');
    return null;
  }

  isRunning = true;
  const startMs = Date.now();
  const label   = forceHistorical ? 'FORCED HISTORICAL RE-IMPORT' : 'SYNC';

  console.log('');
  console.log(`[WORKER] ══════════ ${label} STARTED ${new Date().toISOString()} ══════════`);

  const results = [];
  let totalInserted = 0;
  let totalUpdated  = 0;
  let errors        = 0;

  // Use forceHistorical to override the incremental logic
  // We temporarily wrap syncSymbol to force history range if needed
  const symbolsToProcess = forceHistorical
    ? WORKER_SYMBOLS.map(s => ({ ...s, _forceHistorical: true }))
    : WORKER_SYMBOLS;

  for (let i = 0; i < symbolsToProcess.length; i += BATCH_SIZE) {
    const batch = symbolsToProcess.slice(i, i + BATCH_SIZE);

    for (const symbolObj of batch) {
      await jitter(MAX_DELAY_MS);

      let result;
      if (symbolObj._forceHistorical) {
        // Override: pretend it's a first import by temporarily clearing the
        // latest timestamp (we do NOT delete from DB; just override decision)
        result = await syncSymbolForced(symbolObj);
      } else {
        result = await syncSymbol(symbolObj);
      }

      results.push(result);
      totalInserted += result.inserted;
      totalUpdated  += result.updated;
      if (result.error) errors++;
    }

    if (i + BATCH_SIZE < symbolsToProcess.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`[WORKER] ══ ${label} DONE in ${elapsed}s ══`);
  console.log(`[WORKER]    Inserted: ${totalInserted} | Updated: ${totalUpdated} | Errors: ${errors}/${WORKER_SYMBOLS.length}`);
  console.log('');

  isRunning = false;
  return { results, totalInserted, totalUpdated, errors, elapsed };
}

// ── Force historical fetch (ignores existing latestStoredTs in decision) ──────
async function syncSymbolForced(symbolObj) {
  const { symbol, name } = symbolObj;
  const exchange   = symbolObj.exchange || DEFAULT_EXCHANGE;
  const logPrefix  = `[WORKER][${symbol}]`;
  const range      = HISTORY_RANGE;
  const ticker     = toYahooTicker(symbol, exchange);

  await updateSyncStatus(symbol, exchange, {
    lastSyncAttempt: new Date(),
    syncStatus: 'running',
    lastInserted: 0,
    lastUpdated: 0,
  });

  try {
    console.log(`${logPrefix} 📥 Forced historical import | range=${range}`);
    const rawCandles = await fetchYahooCandles(ticker, range);
    if (rawCandles.length === 0) {
      const total = await getCandleCount(symbol, exchange);
      await updateSyncStatus(symbol, exchange, {
        candlesTotal: total, lastInserted: 0, lastUpdated: 0,
        syncStatus: 'ok', lastError: null, lastSyncSuccess: new Date(),
      });
      return { symbol, inserted: 0, updated: 0, total };
    }

    const filtered = applyMarketFilter(rawCandles, exchange);
    const { inserted, updated } = await upsertCandles(symbol, exchange, filtered);

    const newLatestTs      = filtered[filtered.length - 1]?.timestamp;
    const latestCompleteTs = filtered.filter(c => c.isComplete).pop()?.timestamp ?? null;
    const total            = await getCandleCount(symbol, exchange);

    await updateSyncStatus(symbol, exchange, {
      latestStoredTs: newLatestTs, latestCompleteTs,
      candlesTotal: total, lastInserted: inserted, lastUpdated: updated,
      syncStatus: 'ok', lastError: null, lastSyncSuccess: new Date(),
    });

    console.log(`${logPrefix} [FORCED] ✓ +${inserted} new, ~${updated} updated | DB total: ${total}`);
    return { symbol, inserted, updated, total };
  } catch (err) {
    console.error(`${logPrefix} ✗ ${err.message}`);
    const total = await getCandleCount(symbol, exchange).catch(() => 0);
    await updateSyncStatus(symbol, exchange, {
      candlesTotal: total, lastInserted: 0, lastUpdated: 0,
      lastError: err.message, syncStatus: 'error',
    });
    return { symbol, inserted: 0, updated: 0, total, error: err.message };
  }
}

// ── Manual backfill for a single symbol ──────────────────────────────────────
async function backfillSymbol(symbol) {
  const symbolObj = WORKER_SYMBOLS.find(
    s => s.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!symbolObj) throw new Error(`Symbol ${symbol} not in worker list`);
  return syncSymbolForced(symbolObj);
}

module.exports = {
  runSyncCycle,
  backfillSymbol,
  WORKER_SYMBOLS,
  getSyncStatus,
};
