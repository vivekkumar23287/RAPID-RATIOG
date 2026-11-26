// scanner.js — 15-Minute Candlestick Pattern Scanner
// Implements:
//   1. 3-Candle Bullish Breakout Confirmation Strategy (for ALL NSE stocks & Nifty 50)
//   2. Open = High and Open = Low Signals (15-min)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { Pool } = require('pg');
const { getISTTimeString, getISTDateString, getISTHourMinute } = require('./candle-importer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 3-CANDLE GAP STRATEGY LOGIC:
 * 1. Bullish 3-Candle Gap:
 *    - Candle 1: Green (c1.close > c1.open)
 *    - Candle 2: Any (bullish, bearish, or doji)
 *    - Candle 3: Green (c3.close > c3.open)
 *    - Gap: c3.low > c1.high (Gap Points = c3.low - c1.high)
 *    - Pattern Type: BULLISH 3-CANDLE GAP
 * 2. Bearish 3-Candle Gap:
 *    - Candle 1: Red (c1.close < c1.open)
 *    - Candle 2: Any (bullish, bearish, or doji)
 *    - Candle 3: Red (c3.close < c3.open)
 *    - Gap: c3.high < c1.low (Gap Points = c1.low - c3.high)
 *    - Pattern Type: BEARISH 3-CANDLE GAP
 */
function check3CandleGap(quotes) {
  if (!quotes || quotes.length < 3) return null;

  // quotes are completed 15-minute candles sorted ascending by timestamp
  for (let i = quotes.length - 3; i >= 0; i--) {
    const c1 = quotes[i];
    const c2 = quotes[i + 1];
    const c3 = quotes[i + 2];

    // Must be on the same trading day (if dateStr available)
    if (c1.dateStr && c2.dateStr && c3.dateStr) {
      if (c1.dateStr !== c2.dateStr || c2.dateStr !== c3.dateStr) continue;
    }

    const isBullish = (c1.close > c1.open) && (c3.close > c3.open) && (c3.low > c1.high);
    const isBearish = (c1.close < c1.open) && (c3.close < c3.open) && (c3.high < c1.low);

    if (!isBullish && !isBearish) continue;

    const candleTime = `${c1.timeStr || ''} - ${c3.timeStr || ''}`;
    const detectionTime = c3.timeStr || '';

    if (isBullish) {
      const gapPoints = Number((c3.low - c1.high).toFixed(2));
      return {
        signalType: 'BULLISH 3-CANDLE GAP',
        direction: 'UP',
        gapPoints,
        c1,
        c2,
        c3,
        c1High: c1.high,
        c1Low: c1.low,
        c3High: c3.high,
        c3Low: c3.low,
        candleTime,
        detectionTime,
        candleDate: c3.dateStr,
        triggerPrice: c3.close,
      };
    }

    if (isBearish) {
      const gapPoints = Number((c1.low - c3.high).toFixed(2));
      return {
        signalType: 'BEARISH 3-CANDLE GAP',
        direction: 'DOWN',
        gapPoints,
        c1,
        c2,
        c3,
        c1High: c1.high,
        c1Low: c1.low,
        c3High: c3.high,
        c3Low: c3.low,
        candleTime,
        detectionTime,
        candleDate: c3.dateStr,
        triggerPrice: c3.close,
      };
    }
  }
  return null;
}

async function scanStocks(importedCandles) {
  const newSignals = [];

  // =========================================================================
  // 1. Scan EVERY stock (including NIFTY50 & BTC) for 3-Candle Gap (Bullish & Bearish)
  // =========================================================================
  console.log('[SCANNER] Scanning all stocks for 3-Candle Gap setup (Bullish & Bearish)...');
  let gapCount = 0;

  for (const [symbol, data] of Object.entries(importedCandles)) {
    try {
      const { quotes, name } = data;
      if (!quotes || quotes.length < 3) continue;

      const gapSetup = check3CandleGap(quotes);
      if (gapSetup) {
        newSignals.push({
          stock_symbol: symbol,
          stock_name: name || (symbol === 'NIFTY50' ? 'Nifty 50 Index' : symbol === 'BTC' ? 'Bitcoin' : symbol),
          signal_type: gapSetup.signalType,
          direction: gapSetup.direction,
          timeframe: '15m',
          gap_points: gapSetup.gapPoints,
          open_price: gapSetup.triggerPrice,
          high_price: Math.max(gapSetup.c1High, gapSetup.c3High),
          low_price: Math.min(gapSetup.c1Low, gapSetup.c3Low),
          close_price: gapSetup.triggerPrice,
          candle_time: gapSetup.candleTime,
          candle_date: gapSetup.candleDate,
          c1_high: gapSetup.c1High,
          c1_low: gapSetup.c1Low,
          c3_high: gapSetup.c3High,
          c3_low: gapSetup.c3Low,
          detection_time: gapSetup.detectionTime,
        });
        gapCount++;
        console.log(`[SCANNER] ✓ ${gapSetup.signalType} (${gapSetup.direction}) confirmed for ${symbol}: Gap=${gapSetup.gapPoints} pts at ${gapSetup.candleTime}`);
      }
    } catch (err) {
      console.error(`[SCANNER] Error checking 3-candle gap for ${symbol}:`, err.message);
    }
  }

  console.log(`[SCANNER] Found ${gapCount} 3-Candle Gap setups`);

  // =========================================================================
  // 2. Scan stocks for 15-Min Open = High / Open = Low Signals (Trick 4)
  // Trick 4 is strictly implemented for only 7 assets:
  // Apollo Hospitals, Bajaj Auto, Eicher Motors, Maruti Suzuki, UltraTech Cement, Nifty 50, BTC
  // =========================================================================
  console.log('[SCANNER] Scanning stocks for O=H / O=L signals (Trick 4 - 7 target assets)...');
  let signalCount = 0;

  const TRICK_4_SYMBOLS_SET = new Set([
    'APOLLOHOSP',
    'BAJAJ-AUTO',
    'EICHERMOT',
    'MARUTI',
    'ULTRACEMCO',
    'NIFTY50',
    'NIFTY',
    '^NSEI',
    'BTC',
    'BTC-USD'
  ]);

  for (const [symbol, data] of Object.entries(importedCandles)) {
    if (!TRICK_4_SYMBOLS_SET.has(symbol.toUpperCase())) continue;

    try {
      const { quotes, name } = data;
      if (!quotes || quotes.length === 0) continue;

      // Identify the latest trading date present in the quotes
      const latestDateStr = quotes[quotes.length - 1].dateStr;

      // Scan all candles for the trading day between 9:15 AM and 3:30 PM IST
      const sessionCandles = quotes.filter(c => {
        if (c.dateStr !== latestDateStr) return false;
        const { hours, minutes } = getISTHourMinute(c.timestamp);
        const totalMinutes = hours * 60 + minutes;
        return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
      });

      for (const candle of sessionCandles) {
        const { open, high, low, close, timestamp, dateStr, timeStr } = candle;

        let signalType = null;
        let direction = null;

        // RULE 1: If candle HIGH == OPEN → signal = DOWN (Bearish)
        // Uses floating-point tolerance (< 0.02)
        if (Math.abs(high - open) < 0.02) {
          signalType = 'OPEN = HIGH ↓';
          direction = 'DOWN';
        }
        // RULE 2: If candle LOW == OPEN → signal = UP (Bullish)
        else if (Math.abs(low - open) < 0.02) {
          signalType = 'OPEN = LOW ↑';
          direction = 'UP';
        }

        if (signalType) {
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
      }
    } catch (e) {
      console.error(`[SCANNER] Error scanning O=H/O=L for ${symbol}:`, e.message);
    }
  }

  console.log(`[SCANNER] Found ${signalCount} O=H/O=L signals`);

  // =========================================================================
  // 3. Save unique signals to DB without duplicate inserts
  // =========================================================================
  const validSavedSignals = [];
  if (newSignals.length > 0) {
    console.log(`[SCANNER] Saving ${newSignals.length} total signals to DB...`);

    for (const sig of newSignals) {
      try {
        // Prevent duplicate signals for the same stock, signal type, and candle
        const existing = await pool.query(
          `SELECT id FROM signals_history 
           WHERE stock_symbol = $1 AND candle_time = $2 AND candle_date = $3 AND signal_type = $4`,
          [sig.stock_symbol, sig.candle_time, sig.candle_date, sig.signal_type]
        );

        if (existing.rows && existing.rows.length > 0) {
          validSavedSignals.push({ ...sig, id: existing.rows[0].id });
          continue;
        }

        const query = `
          INSERT INTO signals_history (
            stock_symbol, stock_name, signal_type, direction, timeframe,
            open_price, high_price, low_price, close_price, candle_time, candle_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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

    console.log(`[SCANNER] ✅ Processed ${validSavedSignals.length} unique signals in DB`);
  }

  return validSavedSignals;
}

module.exports = { scanStocks, pool };
