require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const cors = require('cors');
const { scanStocks, pool } = require('./scanner');
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

// Schedule the cron job
// Run every 15 mins during market hours (Mon-Fri)
// Market hours IST: 9:15 AM to 3:30 PM.
// Scans should trigger just AFTER the candle closes:
// Candles: 9:15-9:30, 9:30-9:45 ... 3:15-3:30
// So cron runs at: 9:31, 9:46, 10:01, 10:16, etc.
// For simplicity, we can just run it every minute and check if it's right after 15 min mark:
// e.g., 1,16,31,46 past the hour, between 9 and 15, on Mon-Fri.
// Since market opens at 9:15, first candle closes 9:30 -> first scan 9:31.
// 31 9 * * 1-5 (9:31)
// 46 9 * * 1-5 (9:46)
// 1,16,31,46 10-14 * * 1-5 (10:01 to 14:46)
// 1,16,31 15 * * 1-5 (15:01, 15:16, 15:31)
// We will define a cron schedule: '1,16,31,46 9-15 * * 1-5'
// and filter out 9:01, 9:16, 15:46 inside the handler.

cron.schedule('1,16,31,46 9-15 * * 1-5', async () => {
  // Current time in IST
  const d = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const timeStr = new Intl.DateTimeFormat('en-IN', options).format(d);
  const [hour, minute] = timeStr.split(':').map(Number);
  
  // Market filters (9:15 - 15:30)
  // Skip anything before 9:31
  if (hour === 9 && minute < 31) return;
  // Skip anything after 15:31
  if (hour === 15 && minute > 31) return;

  console.log(`[${timeStr} IST] Running Trick in NSE Scanner...`);
  const newSignals = await scanStocks();

  if (newSignals && newSignals.length > 0) {
    console.log(`Found ${newSignals.length} new valid signals. Emitting to WS.`);
    io.emit('new_signals', newSignals);
  } else {
    console.log('No new signals found.');
  }
}, {
  timezone: 'Asia/Kolkata'
});


// A manual trigger endpoint for testing without waiting for 15m
app.post('/api/trigger-scan', async (req, res) => {
  console.log("Manual scan triggered...");
  const newSignals = await scanStocks();
  if (newSignals && newSignals.length > 0) {
    io.emit('new_signals', newSignals);
  }
  res.json({ success: true, count: newSignals ? newSignals.length : 0 });
});

const PORT = process.env.EXPRESS_PORT || 8080;
server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
