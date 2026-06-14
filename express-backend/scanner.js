/**
 * scanner.js
 * 
 * Scans pre-imported 15-min candles for trading signals.
 * 
 * IMPORTANT: This module does NOT fetch candles from Yahoo Finance directly.
 * It receives already-filtered, completed candles from candle-importer.js.
 * This guarantees the scanner always uses correct, verified candles.
 * 
 * Tricks:
 *   1. OPEN = HIGH (Bearish ↓) — candle's high equals its open
 *   2. OPEN = LOW  (Bullish ↑) — candle's low equals its open
 *   3. Nifty 50 4-Candle Setup — special multi-candle pattern
 */

require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');
const { getISTTimeString, getISTDateString } = require('./candle-importer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});


// ─────────────────────────────────────────────────────────────
// NIFTY 50 — 4-Candle Special Setup Scanner
// ─────────────────────────────────────────────────────────────

/**
 * Scans the last 4 completed candles of NIFTY 50 for the special setup.
 * All 4 candles must be from the same trading day.
 *
 * Bearish Setup:
 *   C1: Red (close < open)
 *   C2: Green (close > open) & breaks C1's low (C2.low < C1.low)
 *   C3: Red (close < open) & breaks C2's high (C3.high > C2.high)
 *   C4: Red (close < open)
 *
 * Bullish Setup:
 *   C1: Green (close > open)
 *   C2: Red (close < open) & breaks C1's high (C2.high > C1.high)
 *   C3: Green (close > open) & breaks C2's low (C3.low < C2.low)
 *   C4: Green (close > open)
 */
function scanNifty50Setup(niftyData) {
  const { quotes } = niftyData;
  if (!quotes || quotes.length < 4) {
    console.log('[SCANNER] Nifty 50: Not enough candles for 4-candle setup');
    return null;
  }

  // Get the last 4 completed candles
  const c1 = quotes[quotes.length - 4];
  const c2 = quotes[quotes.length - 3];
  const c3 = quotes[quotes.length - 2];
  const c4 = quotes[quotes.length - 1];

  // All 4 candles must be from the SAME trading day (IST)
  if (c1.dateStr !== c4.dateStr || c2.dateStr !== c4.dateStr || c3.dateStr !== c4.dateStr) {
    console.log('[SCANNER] Nifty 50: Candles span multiple days — skipping');
    return null;
  }

  // Bearish Setup
  const isBearish =
    (c1.close < c1.open) &&
    (c2.close > c2.open) &&
    (c2.low < c1.low) &&
    (c3.close < c3.open) &&
    (c3.high > c2.high) &&
    (c4.close < c4.open);

  // Bullish Setup
  const isBullish =
    (c1.close > c1.open) &&
    (c2.close < c2.open) &&
    (c2.high > c1.high) &&
    (c3.close > c3.open) &&
    (c3.low < c2.low) &&
    (c4.close > c4.open);

  if (!isBearish && !isBullish) return null;

  const signalType = isBullish ? 'Nifty 50 Bullish Setup' : 'Nifty 50 Bearish Setup';
  const direction = isBullish ? 'UP' : 'DOWN';

  // Build candle time range string (start of C4 → end of C4)
  const candleTimeStart = c4.timeStr;
  const candleEndTs = c4.timestamp + 15 * 60;
  const candleTimeEnd = getISTTimeString(candleEndTs);
  const candleTime = `${candleTimeStart} - ${candleTimeEnd}`;

  return {
    stock_symbol: 'NIFTY50',
    stock_name: 'Nifty 50 Index',
    signal_type: signalType,
    direction: direction,
    timeframe: '15m',
    open_price: c4.open,
    high_price: c4.high,
    low_price: c4.low,
    close_price: c4.close,
    candle_time: candleTime,
    candle_date: c4.dateStr,
  };
}


// ─────────────────────────────────────────────────────────────
// MAIN SCANNER
// ─────────────────────────────────────────────────────────────

/**
 * Scan all pre-imported candles for trading signals.
 *
 * @param {Object} importedCandles — from candle-importer.js importAllCandles()
 *   Format: { [symbol]: { quotes: [...], meta: {...}, name: string } }
 *
 * @returns {Array} — saved signals from DB
 */
async function scanStocks(importedCandles) {
  const newSignals = [];

  // ── 1. Scan NIFTY 50 for the 4-candle setup ──
  if (importedCandles['NIFTY50']) {
    try {
      console.log('[SCANNER] Scanning Nifty 50 for 4-candle setup...');
      const niftySignal = scanNifty50Setup(importedCandles['NIFTY50']);
      if (niftySignal) {
        newSignals.push(niftySignal);
        console.log(`[SCANNER] ✓ Detected: ${niftySignal.signal_type}`);
      } else {
        console.log('[SCANNER] ✗ No Nifty 50 setup detected');
      }
    } catch (err) {
      console.error('[SCANNER] Error in Nifty 50 scan:', err.message);
    }
  }

  // ── 2. Scan all stocks for Open=High / Open=Low trick ──
  console.log('[SCANNER] Scanning stocks for O=H / O=L signals...');
  let signalCount = 0;

  for (const [symbol, data] of Object.entries(importedCandles)) {
    if (symbol === 'NIFTY50') continue; // Already handled above

    try {
      const { quotes, name } = data;
      if (!quotes || quotes.length === 0) continue;

      // Use the LAST completed candle (guaranteed by importer)
      const lastCandle = quotes[quotes.length - 1];
      if (!lastCandle) continue;

      const { open, high, low, close, timestamp, dateStr, timeStr } = lastCandle;

      let signalType = null;
      let direction = null;

      // RULE 1: If candle HIGH == OPEN → signal = DOWN (Bearish)
      if (high === open) {
        signalType = 'OPEN = HIGH ↓';
        direction = 'DOWN';
      }
      // RULE 2: If candle LOW == OPEN → signal = UP (Bullish)
      else if (low === open) {
        signalType = 'OPEN = LOW ↑';
        direction = 'UP';
      }

      if (signalType) {
        // Build candle time range: "09:15 AM - 09:30 AM"
        const candleEndTs = timestamp + 15 * 60;
        const candleTimeEnd = getISTTimeString(candleEndTs);
        const candleTime = `${timeStr} - ${candleTimeEnd}`;

        newSignals.push({
          stock_symbol: symbol,
          stock_name: name,
          signal_type: signalType,
          direction: direction,
          timeframe: '15m',
          open_price: open,
          high_price: high,
          low_price: low,
          close_price: close,
          candle_time: candleTime,
          candle_date: dateStr,
        });
        signalCount++;
      }
    } catch (e) {
      console.error(`[SCANNER] Error scanning ${symbol}:`, e.message);
    }
  }

  console.log(`[SCANNER] Found ${signalCount} O=H/O=L signals`);

  // ── 3. Save signals to database ──
  const validSavedSignals = [];
  if (newSignals.length > 0) {
    console.log(`[SCANNER] Saving ${newSignals.length} total signals to DB...`);

    for (const sig of newSignals) {
      try {
        const query = `
          INSERT INTO signals_history (
            stock_symbol, stock_name, signal_type, direction, timeframe,
            open_price, high_price, low_price, close_price, candle_time, candle_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (stock_symbol) DO UPDATE SET
            signal_type = EXCLUDED.signal_type,
            direction = EXCLUDED.direction,
            open_price = EXCLUDED.open_price,
            high_price = EXCLUDED.high_price,
            low_price = EXCLUDED.low_price,
            close_price = EXCLUDED.close_price,
            candle_time = EXCLUDED.candle_time,
            candle_date = EXCLUDED.candle_date,
            created_at = CURRENT_TIMESTAMP
          RETURNING *;
        `;
        const values = [
          sig.stock_symbol, sig.stock_name, sig.signal_type, sig.direction, sig.timeframe,
          sig.open_price, sig.high_price, sig.low_price, sig.close_price, sig.candle_time, sig.candle_date,
        ];

        const res = await pool.query(query, values);
        if (res.rowCount > 0) {
          validSavedSignals.push(res.rows[0]);
        }
      } catch (err) {
        console.error('[SCANNER] DB Insert Error for', sig.stock_symbol, ':', err.message);
      }
    }

    console.log(`[SCANNER] ✅ Saved ${validSavedSignals.length} signals to DB`);
  }

  return validSavedSignals;
}


module.exports = { scanStocks, pool };
