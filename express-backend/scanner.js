// scanner.js — 15-Minute Candlestick Pattern Scanner
// Implements:
//   1. 3-Candle Bullish Breakout Confirmation Strategy (for ALL NSE stocks & Nifty 50)
//   2. Open = High and Open = Low Signals (15-min)

require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');
const { getISTTimeString, getISTDateString } = require('./candle-importer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 3-CANDLE BREAKOUT STRATEGY LOGIC:
 * 1. Candle 1: Completed Red reference candle (close < open). High and Low form the reference range.
 * 2. Candle 2: Completed Green candle (close > open) whose High strictly breaks above C1 High (c2.high > c1.high).
 * 3. Candle 3: Completed Green candle (close > open) whose High strictly breaks above C2 High (c3.high > c2.high).
 * 4. Candle 4: Signal triggers strictly at the START of the fourth candle, immediately when it begins.
 */
function check3CandleBreakout(quotes) {
  if (!quotes || quotes.length < 3) return null;
  const nowTs = Math.floor(Date.now() / 1000);

  // quotes are completed 15-minute candles sorted ascending by timestamp
  for (let i = quotes.length - 3; i >= 0; i--) {
    const c1 = quotes[i];
    const c2 = quotes[i + 1];
    const c3 = quotes[i + 2];

    // Must be on the same trading day
    if (c1.dateStr !== c2.dateStr || c2.dateStr !== c3.dateStr) continue;

    // 1. Candle 1 must be RED (close < open)
    if (c1.close >= c1.open) continue;

    // 2. Candle 2 must be GREEN (close > open) and strictly break above C1 High
    if (c2.close <= c2.open) continue;
    if (c2.high <= c1.high) continue;

    // 3. Candle 3 must be GREEN (close > open) and strictly break above C2 High
    if (c3.close <= c3.open) continue;
    if (c3.high <= c2.high) continue;

    // 4. Candle 4 verification:
    // Before giving the name of the company, check if it becomes a green candle or not,
    // and check for 5 to 8 min then add the company name.
    const c4StartTs = c3.timestamp + 15 * 60;
    const c4EndTs = c4StartTs + 15 * 60;
    const elapsedSec = nowTs - c4StartTs;
    const isCompletedPastCandle = quotes.length > i + 3;

    // Must check for 5 to 8 minutes into Candle 4
    if (!isCompletedPastCandle && elapsedSec < 5 * 60) {
      continue;
    }

    const c4 = quotes[i + 3];
    const c4Open = c4 ? c4.open : c3.close;
    const c4Price = c4 ? c4.close : c3.close;

    // Check if Candle 4 has become a GREEN candle (close/price > open)
    const isC4Green = c4 ? (c4.close > c4.open) : true;
    if (c4 && !isC4Green) {
      // Candle 4 is RED or flat — do not add company name
      continue;
    }

    const c4StartTimeStr = getISTTimeString(c4StartTs);
    const c4EndTimeStr = getISTTimeString(c4EndTs);
    const candleTime = `${c4StartTimeStr} - ${c4EndTimeStr}`;

    return {
      c1,
      c2,
      c3,
      c4: c4 || null,
      c4StartTs,
      candleTime,
      candleDate: c3.dateStr,
      confirmationTime: c4StartTimeStr,
      refRange: { high: c1.high, low: c1.low },
      c2High: c2.high,
      c3High: c3.high,
      triggerPrice: c4 ? c4.close : c3.close,
    };
  }
  return null;
}

async function scanStocks(importedCandles) {
  const newSignals = [];

  // =========================================================================
  // 1. Scan EVERY stock (including NIFTY50) for 3-Candle Bullish Breakout
  // =========================================================================
  console.log('[SCANNER] Scanning all stocks for 3-Candle Bullish Breakout setup...');
  let breakoutCount = 0;

  for (const [symbol, data] of Object.entries(importedCandles)) {
    try {
      const { quotes, name } = data;
      if (!quotes || quotes.length < 3) continue;

      const breakout = check3CandleBreakout(quotes);
      if (breakout) {
        newSignals.push({
          stock_symbol: symbol,
          stock_name: name || (symbol === 'NIFTY50' ? 'Nifty 50 Index' : symbol),
          signal_type: '3-CANDLE BUY BREAKOUT',
          direction: 'UP',
          timeframe: '15m',
          open_price: breakout.triggerPrice,
          high_price: breakout.c3High,
          low_price: breakout.refRange.low,
          close_price: breakout.triggerPrice,
          candle_time: breakout.candleTime,
          candle_date: breakout.candleDate,
        });
        breakoutCount++;
        console.log(`[SCANNER] ✓ 3-Candle Breakout confirmed for ${symbol} at ${breakout.candleTime}`);
      }
    } catch (err) {
      console.error(`[SCANNER] Error checking 3-candle breakout for ${symbol}:`, err.message);
    }
  }

  console.log(`[SCANNER] Found ${breakoutCount} 3-Candle Breakout setups`);

  // =========================================================================
  // 2. Scan stocks for 15-Min Open = High / Open = Low Signals (Trick 4)
  // =========================================================================
  console.log('[SCANNER] Scanning stocks for O=H / O=L signals...');
  let signalCount = 0;

  for (const [symbol, data] of Object.entries(importedCandles)) {
    if (symbol === 'NIFTY50') continue;

    try {
      const { quotes, name } = data;
      if (!quotes || quotes.length === 0) continue;

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
