/**
 * server.js
 * 
 * Express backend for the Trick in NSE scanner.
 * 
 * Flow (every 15 minutes during market hours):
 *   1. candle-importer.js imports clean, completed 15-min candles
 *      → Batch 1 (25 stocks) → pause → Batch 2 (25+ stocks) → Nifty 50
 *   2. scanner.js receives the imported candles and runs tricks
 *      → O=H / O=L detection + Nifty 50 4-candle setup
 *   3. Signals saved to DB and emitted via WebSocket
 * 
 * The scanner NEVER fetches candles directly — it only uses pre-imported, 
 * verified candles. This guarantees correct signals.
 */

require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const cors = require('cors');
const { scanStocks, pool } = require('./scanner');
const { importAllCandles } = require('./candle-importer');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// API route to get today's signals
app.get('/api/today', async (req, res) => {
  try {
    const today = new Date();
    const optionsDate = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateParts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(today);
    const todayStr = `${dateParts.find(p=>p.type==='day').value}/${dateParts.find(p=>p.type==='month').value}/${dateParts.find(p=>p.type==='year').value}`;

    const { rows } = await pool.query(
      'SELECT * FROM signals_history WHERE candle_date = $1 ORDER BY id DESC',
      [todayStr]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});


io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─────────────────────────────────────────────────────────────
// CRON: Import Candles → Run Scanner → Emit Signals
// ─────────────────────────────────────────────────────────────
// Schedule: 1,16,31,46 past the hour, Mon-Fri
// These are 1 minute AFTER each 15-min candle closes:
//   9:31 (for 9:15-9:30 candle), 9:46 (for 9:30-9:45), ...
//   15:31 (for 15:15-15:30, last candle)
//
// We run at 9-15 hours and filter out invalid times in the handler.

cron.schedule('1,16,31,46 9-15 * * 1-5', async () => {
  // Get current IST time
  const d = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = new Intl.DateTimeFormat('en-IN', options).format(d);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Skip anything before 9:31 (market not open / first candle not closed yet)
  if (hour === 9 && minute < 31) return;
  // Skip anything after 15:31 (market closed / all candles done)
  if (hour === 15 && minute > 31) return;
  if (hour > 15) return;

  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  [${timeStr} IST] SCHEDULED SCAN STARTING                ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  try {
    // STEP 1: Import clean, completed candles (2 batches + Nifty 50)
    console.log(`[${timeStr} IST] Step 1: Importing candles...`);
    const importedCandles = await importAllCandles();

    const stockCount = Object.keys(importedCandles).length;
    if (stockCount === 0) {
      console.log(`[${timeStr} IST] No candles imported — skipping scanner.`);
      return;
    }

    // STEP 2: Run scanner on imported candles
    console.log(`[${timeStr} IST] Step 2: Running scanner on ${stockCount} stocks...`);
    const newSignals = await scanStocks(importedCandles);

    // STEP 3: Emit signals via WebSocket
    if (newSignals && newSignals.length > 0) {
      console.log(`[${timeStr} IST] Step 3: Emitting ${newSignals.length} signals to WebSocket.`);
      io.emit('new_signals', newSignals);
    } else {
      console.log(`[${timeStr} IST] Step 3: No new signals found.`);
    }
  } catch (error) {
    console.error(`[${timeStr} IST] ERROR in scheduled scan:`, error.message);
  }

  console.log(`[${timeStr} IST] ─── Scan cycle complete ───`);
  console.log('');
}, {
  timezone: 'Asia/Kolkata'
});


// ─────────────────────────────────────────────────────────────
// MANUAL TRIGGER (for testing without waiting for cron)
// ─────────────────────────────────────────────────────────────
app.post('/api/trigger-scan', async (req, res) => {
  console.log("Manual scan triggered...");
  try {
    // Step 1: Import candles
    const importedCandles = await importAllCandles();

    // Step 2: Run scanner
    const newSignals = await scanStocks(importedCandles);

    // Step 3: Emit signals
    if (newSignals && newSignals.length > 0) {
      io.emit('new_signals', newSignals);
    }

    res.json({
      success: true,
      stocksImported: Object.keys(importedCandles).length,
      signalsFound: newSignals ? newSignals.length : 0,
    });
  } catch (error) {
    console.error("Error in manual scan:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.EXPRESS_PORT || 8080;
server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
