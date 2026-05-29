require('dotenv').config({ path: '../.env.local' });
async function fetchYahooChart(ticker, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Yahoo Finance API returned status ${response.status}`);
  }
  const data = await response.json();
  if (data.chart && data.chart.error) {
    throw new Error(data.chart.error.description || "Yahoo Finance API error");
  }
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    return { quotes: [] };
  }
  
  const quotes = [];
  const quoteData = result.indicators.quote[0];
  for (let i = 0; i < result.timestamp.length; i++) {
    if (
      quoteData.open[i] !== null &&
      quoteData.high[i] !== null &&
      quoteData.low[i] !== null &&
      quoteData.close[i] !== null
    ) {
      quotes.push({
        date: new Date(result.timestamp[i] * 1000),
        open: quoteData.open[i],
        high: quoteData.high[i],
        low: quoteData.low[i],
        close: quoteData.close[i],
        volume: quoteData.volume[i] || 0
      });
    }
  }
  return { quotes, meta: result.meta };
}
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const SCAN_SYMBOLS = [
  {"symbol": "RELIANCE", "name": "Reliance Industries"},
  {"symbol": "TCS", "name": "Tata Consultancy Services"},
  {"symbol": "HDFCBANK", "name": "HDFC Bank"},
  {"symbol": "ICICIBANK", "name": "ICICI Bank"},
  {"symbol": "INFY", "name": "Infosys"},
  {"symbol": "POLYCAB", "name": "Polycab India"},
  {"symbol": "TMPV", "name": "Tata Motors Passenger"},
  {"symbol": "TMCV", "name": "Tata Motors Commercial"},
  {"symbol": "SBIN", "name": "State Bank of India"},
  {"symbol": "BHARTIARTL", "name": "Bharti Airtel"},
  {"symbol": "ITC", "name": "ITC Limited"},
  {"symbol": "LT", "name": "Larsen & Toubro"},
  {"symbol": "AXISBANK", "name": "Axis Bank"},
  {"symbol": "WIPRO", "name": "Wipro"},
  {"symbol": "HCLTECH", "name": "HCL Technologies"},
  {"symbol": "MARUTI", "name": "Maruti Suzuki"},
  {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank"},
  {"symbol": "HINDUNILVR", "name": "Hindustan Unilever"},
  {"symbol": "BAJFINANCE", "name": "Bajaj Finance"},
  {"symbol": "ADANIENT", "name": "Adani Enterprises"},
  {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical"},
  {"symbol": "TITAN", "name": "Titan Company"},
  {"symbol": "BAJAJFINSV", "name": "Bajaj Finserv"},
  {"symbol": "ULTRACEMCO", "name": "UltraTech Cement"},
  {"symbol": "TATASTEEL", "name": "Tata Steel"},
  {"symbol": "NTPC", "name": "NTPC"},
  {"symbol": "JSWSTEEL", "name": "JSW Steel"},
  {"symbol": "ASIANPAINT", "name": "Asian Paints"},
  {"symbol": "M&M", "name": "Mahindra & Mahindra"},
  {"symbol": "POWERGRID", "name": "Power Grid Corp"},
  {"symbol": "ONGC", "name": "ONGC"},
  {"symbol": "ADANIPORTS", "name": "Adani Ports & SEZ"},
  {"symbol": "COALINDIA", "name": "Coal India"},
  {"symbol": "TECHM", "name": "Tech Mahindra"},
  {"symbol": "INDUSINDBK", "name": "IndusInd Bank"},
  {"symbol": "NESTLEIND", "name": "Nestle India"},
  {"symbol": "LTM", "name": "LTI Mindtree"},
  {"symbol": "HINDALCO", "name": "Hindalco Industries"},
  {"symbol": "BRITANNIA", "name": "Britannia Industries"},
  {"symbol": "GRASIM", "name": "Grasim Industries"},
  {"symbol": "DRREDDY", "name": "Dr. Reddy's"},
  {"symbol": "APOLLOHOSP", "name": "Apollo Hospitals"},
  {"symbol": "EICHERMOT", "name": "Eicher Motors"},
  {"symbol": "SBILIFE", "name": "SBI Life Insurance"},
  {"symbol": "BPCL", "name": "BPCL"},
  {"symbol": "CIPLA", "name": "Cipla"},
  {"symbol": "BAJAJ-AUTO", "name": "Bajaj Auto"},
  {"symbol": "DIVISLAB", "name": "Divi's Laboratories"},
  {"symbol": "HEROMOTOCO", "name": "Hero MotoCorp"},
  {"symbol": "UPL", "name": "UPL"},
  {"symbol": "TATACONSUM", "name": "Tata Consumer Products"},
  {"symbol": "DLF", "name": "DLF Limited"},
  {"symbol": "BHEL", "name": "BHEL"},
  {"symbol": "CANBK", "name": "Canara Bank"},
  {"symbol": "PNB", "name": "Punjab National Bank"},
  {"symbol": "TATAPOWER", "name": "Tata Power"},
  {"symbol": "IRCTC", "name": "IRCTC"},
  {"symbol": "UNIONBANK", "name": "Union Bank of India"},
  {"symbol": "FEDERALBNK", "name": "Federal Bank"},
  {"symbol": "SAIL", "name": "Steel Authority of India"},
  {"symbol": "GMRAIRPORT", "name": "GMR Airports"},
  {"symbol": "IDFCFIRSTB", "name": "IDFC First Bank"},
  {"symbol": "IOC", "name": "Indian Oil Corp"}
];

async function scanStocks() {
  const newSignals = [];

  for (const stock of SCAN_SYMBOLS) {
    try {
      const ticker = `${stock.symbol}.NS`;
      // Fetch 1d range, 15m interval
      const result = await fetchYahooChart(ticker, '15m', '1d');
      
      if (!result || !result.quotes || result.quotes.length === 0) continue;
      
      // Find the last fully completed candle by searching backwards
      let lastCandle = null;
      for (let i = result.quotes.length - 1; i >= 0; i--) {
        const quote = result.quotes[i];
        const ageMs = Date.now() - quote.date.getTime();
        // A candle is fully completed if the current time is at least 15 minutes past its starting time.
        if (ageMs >= 15 * 60 * 1000) {
          lastCandle = quote;
          break;
        }
      }
      
      if (!lastCandle || !lastCandle.open) continue;

      const open = Number(lastCandle.open.toFixed(2));
      const high = Number(lastCandle.high.toFixed(2));
      const low = Number(lastCandle.low.toFixed(2));
      const close = Number(lastCandle.close.toFixed(2));

      let signalType = null;
      let direction = null;

      // RULE 1: If candle HIGH == OPEN -> signal = DOWN (Bearish)
      if (high === open) {
        signalType = "OPEN = HIGH ↓";
        direction = "DOWN";
      } 
      // RULE 2: If candle LOW == OPEN -> signal = UP (Bullish)
      else if (low === open) {
        signalType = "OPEN = LOW ↑";
        direction = "UP";
      }

      if (signalType) {
        const d = new Date(lastCandle.date);
        
        // Convert to IST representation for storing
        // A simple way to format it locally:
        const optionsDate = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
        const optionsTime = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };
        
        const dateParts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(d);
        const candleDate = `${dateParts.find(p=>p.type==='day').value}/${dateParts.find(p=>p.type==='month').value}/${dateParts.find(p=>p.type==='year').value}`;
        
        const candleTimeStart = new Intl.DateTimeFormat('en-IN', optionsTime).format(d).toUpperCase();
        const dEnd = new Date(d.getTime() + 15 * 60 * 1000);
        const candleTimeEnd = new Intl.DateTimeFormat('en-IN', optionsTime).format(dEnd).toUpperCase();
        const candleTime = `${candleTimeStart} - ${candleTimeEnd}`;

        newSignals.push({
          stock_symbol: stock.symbol,
          stock_name: stock.name,
          signal_type: signalType,
          direction: direction,
          timeframe: "15m",
          open_price: open,
          high_price: high,
          low_price: low,
          close_price: close,
          candle_time: candleTime,
          candle_date: candleDate
        });
      }

    } catch (e) {
      console.error(`Error scanning ${stock.symbol}:`, e.message);
    }
  }

  // Insert to DB
  const validSavedSignals = [];
  if (newSignals.length > 0) {
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
          sig.open_price, sig.high_price, sig.low_price, sig.close_price, sig.candle_time, sig.candle_date
        ];
        
        const res = await pool.query(query, values);
        if (res.rowCount > 0) {
          validSavedSignals.push(res.rows[0]);
        }
      } catch (err) {
        console.error("DB Insert Error for", sig.stock_symbol, ":", err.message);
      }
    }
  }

  return validSavedSignals;
}

module.exports = { scanStocks, pool };
