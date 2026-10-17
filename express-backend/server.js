/**
 * server.js — Express backend
 *
 * Responsibilities:
 *   • WebSocket (Socket.IO) for live scanner signal push
 *   • Cron-based stock pattern scanner (O=H / O=L signals)
 *   • Cron-based 15-minute candle DB worker (incremental, market-hours-only)
 *   • REST API endpoints for candle reads, status, and admin triggers
 *
 * Candle worker behaviour:
 *   ─ On first boot, each symbol self-detects that it has no stored data
 *     and performs a one-time 30d historical import automatically.
 *   ─ On every subsequent scheduled run, only candles newer than the last
 *     stored timestamp are fetched and saved (incremental-only).
 *   ─ The scheduler runs every 2 minutes during NSE market hours.
 *   ─ A post-market catch-up runs at 16:00 IST on weekdays.
 *   ─ These jobs run independently of website visitors.
 */

'use strict';

require('dotenv').config({ path: '../.env.local' });
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cron     = require('node-cron');
const cors     = require('cors');

const { scanStocks, pool } = require('./scanner');
const { importAllCandles } = require('./candle-importer');
const { runSyncCycle, backfillSymbol, getSyncStatus } = require('./candle-worker');
const fs   = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

// ── Worker auth (set WORKER_SECRET in .env.local for production) ──────────────
const WORKER_SECRET = process.env.WORKER_SECRET || '';
function requireWorkerAuth(req, res, next) {
  if (!WORKER_SECRET) return next(); // dev: open if no secret set
  const provided = req.headers['x-worker-secret'] || req.query.secret;
  if (provided !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Scanner: today's signals ──────────────────────────────────────────────────
app.get('/api/today', async (req, res) => {
  try {
    const today = new Date();
    const optionsDate = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateParts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(today);
    const todayStr = `${dateParts.find(p => p.type === 'day').value}/${dateParts.find(p => p.type === 'month').value}/${dateParts.find(p => p.type === 'year').value}`;

    const { rows } = await pool.query(
      'SELECT * FROM signals_history WHERE candle_date = $1 ORDER BY id DESC',
      [todayStr]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Candles: range query ──────────────────────────────────────────────────────
app.get('/api/candles', async (req, res) => {
  try {
    const { symbol, from, to, limit } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });

    const symUpper = symbol.toUpperCase();
    const nowTs    = Math.floor(Date.now() / 1000);
    const fromTs   = from  ? parseInt(from,  10) : nowTs - 30 * 86400;
    const toTs     = to    ? parseInt(to,    10) : nowTs;
    const maxRows  = limit ? Math.min(parseInt(limit, 10), 5000) : 5000;

    const { rows } = await pool.query(
      `SELECT
         candle_timestamp AS time,
         open_price  AS open,
         high_price  AS high,
         low_price   AS low,
         close_price AS close,
         volume,
         is_complete
       FROM candles_15m
       WHERE symbol    = $1
         AND timeframe  = '15m'
         AND candle_timestamp >= $2
         AND candle_timestamp <= $3
       ORDER BY candle_timestamp ASC
       LIMIT $4`,
      [symUpper, fromTs, toTs, maxRows]
    );

    res.json({
      symbol: symUpper,
      timeframe: '15m',
      from: fromTs, to: toTs,
      count: rows.length,
      candles: rows.map(r => ({
        time:       Number(r.time),
        open:       Number(r.open),
        high:       Number(r.high),
        low:        Number(r.low),
        close:      Number(r.close),
        volume:     Number(r.volume),
        isComplete: r.is_complete,
      })),
    });
  } catch (err) {
    console.error('[/api/candles]', err.message);
    res.status(500).json({ error: 'Failed to fetch candles' });
  }
});

// ── Candles: latest N candles ─────────────────────────────────────────────────
app.get('/api/candles/latest', async (req, res) => {
  try {
    const { symbol, limit } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });

    const symUpper = symbol.toUpperCase();
    const maxRows  = limit ? Math.min(parseInt(limit, 10), 2000) : 500;

    const { rows } = await pool.query(
      `SELECT
         candle_timestamp AS time,
         open_price  AS open,
         high_price  AS high,
         low_price   AS low,
         close_price AS close,
         volume,
         is_complete
       FROM candles_15m
       WHERE symbol   = $1 AND timeframe = '15m'
       ORDER BY candle_timestamp DESC
       LIMIT $2`,
      [symUpper, maxRows]
    );

    const candles = rows
      .map(r => ({
        time:       Number(r.time),
        open:       Number(r.open),
        high:       Number(r.high),
        low:        Number(r.low),
        close:      Number(r.close),
        volume:     Number(r.volume),
        isComplete: r.is_complete,
      }))
      .reverse();

    res.json({ symbol: symUpper, timeframe: '15m', count: candles.length, candles });
  } catch (err) {
    console.error('[/api/candles/latest]', err.message);
    res.status(500).json({ error: 'Failed to fetch candles' });
  }
});

// ── Candles: sync status ──────────────────────────────────────────────────────
app.get('/api/candles/status', async (req, res) => {
  try {
    const { symbol } = req.query;
    const status = await getSyncStatus(symbol || undefined);
    res.json({ success: true, status });
  } catch (err) {
    console.error('[/api/candles/status]', err.message);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// ── Manual scanner trigger ────────────────────────────────────────────────────
app.post('/api/trigger-scan', async (req, res) => {
  console.log('Manual scan triggered...');
  try {
    const importedCandles = await importAllCandles();
    const newSignals = await scanStocks(importedCandles);
    if (newSignals && newSignals.length > 0) io.emit('new_signals', newSignals);
    res.json({
      success: true,
      stocksImported: Object.keys(importedCandles).length,
      signalsFound:   newSignals ? newSignals.length : 0,
    });
  } catch (err) {
    console.error('Manual scan error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Worker: trigger incremental sync (protected) ──────────────────────────────
app.post('/api/worker/sync', requireWorkerAuth, async (req, res) => {
  const { force } = req.body || {};
  const label = force ? 'forced historical re-import' : 'incremental sync';
  console.log(`[WORKER] Manual ${label} triggered`);
  // Start async, respond immediately
  const promise = runSyncCycle(!!force);
  res.json({ success: true, message: `${label} started`, force: !!force });
  promise
    .then(r => r && console.log(`[WORKER] Manual ${label} complete: +${r.totalInserted} inserted`))
    .catch(e => console.error(`[WORKER] Manual ${label} error:`, e.message));
});

// ── Worker: backfill a single symbol (protected) ──────────────────────────────
app.post('/api/worker/backfill', requireWorkerAuth, async (req, res) => {
  const { symbol } = req.body || {};
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });
  try {
    console.log(`[WORKER] Backfill requested for ${symbol}`);
    const result = await backfillSymbol(symbol);
    res.json({ success: true, result });
  } catch (err) {
    console.error(`[WORKER] Backfill error for ${symbol}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// WEBSOCKET
// ─────────────────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON JOBS
// ─────────────────────────────────────────────────────────────────────────────

// ── Pattern scanner — every 15 min at :01, :16, :31, :46 during market hours ──
cron.schedule('1,16,31,46 9-15 * * 1-5', async () => {
  const d = new Date();
  const opts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = new Intl.DateTimeFormat('en-IN', opts).format(d);
  const [hour, minute] = timeStr.split(':').map(Number);

  if (hour === 9  && minute < 31) return; // before first 15m candle
  if (hour === 15 && minute > 31) return; // after market close
  if (hour > 15) return;

  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  [${timeStr} IST] SCHEDULED SCAN STARTING                ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  try {
    const importedCandles = await importAllCandles();
    const stockCount = Object.keys(importedCandles).length;
    if (stockCount === 0) { console.log(`[${timeStr}] No candles — skipping scanner`); return; }

    const newSignals = await scanStocks(importedCandles);
    if (newSignals && newSignals.length > 0) {
      console.log(`[${timeStr}] Emitting ${newSignals.length} signals`);
      io.emit('new_signals', newSignals);
    } else {
      console.log(`[${timeStr}] No new signals`);
    }
  } catch (err) {
    console.error(`[${timeStr}] Scanner error:`, err.message);
  }

  console.log(`[${timeStr}] ─── Scan cycle complete ───`);
}, { timezone: 'Asia/Kolkata' });

// ── Candle DB worker — every 2 minutes during market hours (Mon-Fri) ──────────
// Runs 9:13 AM–3:35 PM IST.  Each symbol self-determines first-import vs. incremental.
cron.schedule('*/2 9-15 * * 1-5', async () => {
  const d = new Date();
  const opts = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = new Intl.DateTimeFormat('en-IN', opts).format(d);
  const [hour, minute] = timeStr.split(':').map(Number);
  const totalMin = hour * 60 + minute;

  // 9:13 AM = first candle (9:15) closes at 9:30, so earliest useful sync is ~9:32
  if (totalMin < 9 * 60 + 13) return;
  // 3:35 PM = last 15m candle (3:15–3:30) should have published by then
  if (totalMin > 15 * 60 + 35) return;

  console.log(`[WORKER] ⏰ Market-hours incremental sync at ${timeStr} IST`);
  try {
    await runSyncCycle(false); // false = incremental (not forced historical)
  } catch (err) {
    console.error('[WORKER] Cron sync error:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ── Post-market catch-up — 16:00 IST weekdays ────────────────────────────────
// Captures any data Yahoo publishes after market close (delayed feeds, adjustments).
cron.schedule('0 16 * * 1-5', async () => {
  console.log('[WORKER] 🔔 4:00 PM IST post-market catch-up');
  try {
    await runSyncCycle(false);
  } catch (err) {
    console.error('[WORKER] Post-market sync error:', err.message);
  }
}, { timezone: 'Asia/Kolkata' });

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.EXPRESS_PORT || 8080;
server.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  Express server running on port ${PORT}                      ║`);
  console.log('║  Candle worker: self-managing (first-import or incr.)    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // On startup: run one sync cycle.
  // For symbols with no stored data, this becomes their first historical import.
  // For symbols already populated, it fetches only the latest gap.
  // Delay 5 seconds to let the DB connection pool warm up.
  setTimeout(async () => {
    console.log('[WORKER] 🚀 Startup sync — checking each symbol for missing history...');
    try {
      await runSyncCycle(false);
    } catch (err) {
      console.error('[WORKER] Startup sync error:', err.message);
    }
  }, 5000);
});
