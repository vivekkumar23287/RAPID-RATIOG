

require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');
const { getISTTimeString, getISTDateString } = require('./candle-importer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function scanNifty50Setup(niftyData) {
  const { quotes } = niftyData;
  if (!quotes || quotes.length < 4) {
    console.log('[SCANNER] Nifty 50: Not enough candles for 4-candle setup');
    return null;
  }

  
  const c1 = quotes[quotes.length - 4];
  const c2 = quotes[quotes.length - 3];
  const c3 = quotes[quotes.length - 2];
  const c4 = quotes[quotes.length - 1];

  
  if (c1.dateStr !== c4.dateStr || c2.dateStr !== c4.dateStr || c3.dateStr !== c4.dateStr) {
    console.log('[SCANNER] Nifty 50: Candles span multiple days — skipping');
    return null;
  }

  
  const isBearish =
    (c1.close < c1.open) &&
    (c2.close > c2.open) &&
    (c2.low < c1.low) &&
    (c3.close < c3.open) &&
    (c3.high > c2.high) &&
    (c4.close < c4.open);

  
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

async function scanStocks(importedCandles) {
  const newSignals = [];

  
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
      console.error(`[SCANNER] Error scanning ${symbol}:`, e.message);
    }
  }

  console.log(`[SCANNER] Found ${signalCount} O=H/O=L signals`);

  
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
