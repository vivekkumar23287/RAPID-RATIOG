/**
 * candle-importer.js
 * 
 * Properly fetches 15-min candles from Yahoo Finance with strict filtering:
 * - Only Mon-Fri (trading days)
 * - Only 9:15 AM to 3:30 PM IST (market hours)
 * - Only COMPLETED candles (candle end time has passed)
 * - Aligned to exact 15-minute boundaries
 * - Split into 2 batches of ~25 to avoid rate limiting
 * 
 * The scanner MUST wait for this import to finish before running tricks.
 */

// ─────────────────────────────────────────────────────────────
// STOCK LIST — All 50 Nifty 50 + Extra Active Stocks
// ─────────────────────────────────────────────────────────────
const ALL_SYMBOLS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "POLYCAB", name: "Polycab India" },
  { symbol: "TATAMOTORS", name: "Tata Motors" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
  { symbol: "ITC", name: "ITC Limited" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "AXISBANK", name: "Axis Bank" },
  { symbol: "WIPRO", name: "Wipro" },
  { symbol: "HCLTECH", name: "HCL Technologies" },
  { symbol: "MARUTI", name: "Maruti Suzuki" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  { symbol: "ADANIENT", name: "Adani Enterprises" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical" },
  { symbol: "TITAN", name: "Titan Company" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement" },
  { symbol: "TATASTEEL", name: "Tata Steel" },
  { symbol: "NTPC", name: "NTPC" },
  // ──── BATCH SPLIT ──── (First 25 above, next 25+ below)
  { symbol: "JSWSTEEL", name: "JSW Steel" },
  { symbol: "ASIANPAINT", name: "Asian Paints" },
  { symbol: "M&M", name: "Mahindra & Mahindra" },
  { symbol: "POWERGRID", name: "Power Grid Corp" },
  { symbol: "ONGC", name: "ONGC" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ" },
  { symbol: "COALINDIA", name: "Coal India" },
  { symbol: "TECHM", name: "Tech Mahindra" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank" },
  { symbol: "NESTLEIND", name: "Nestle India" },
  { symbol: "LTIM", name: "LTI Mindtree" },
  { symbol: "HINDALCO", name: "Hindalco Industries" },
  { symbol: "BRITANNIA", name: "Britannia Industries" },
  { symbol: "GRASIM", name: "Grasim Industries" },
  { symbol: "DRREDDY", name: "Dr. Reddy's" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals" },
  { symbol: "EICHERMOT", name: "Eicher Motors" },
  { symbol: "SBILIFE", name: "SBI Life Insurance" },
  { symbol: "BPCL", name: "BPCL" },
  { symbol: "CIPLA", name: "Cipla" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products" },
  { symbol: "TATAPOWER", name: "Tata Power" },
  // Extra active stocks
  { symbol: "DLF", name: "DLF Limited" },
  { symbol: "BHEL", name: "BHEL" },
  { symbol: "CANBK", name: "Canara Bank" },
  { symbol: "PNB", name: "Punjab National Bank" },
  { symbol: "IRCTC", name: "IRCTC" },
  { symbol: "UNIONBANK", name: "Union Bank of India" },
  { symbol: "FEDERALBNK", name: "Federal Bank" },
  { symbol: "SAIL", name: "Steel Authority of India" },
  { symbol: "GMRAIRPORT", name: "GMR Airports" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank" },
  { symbol: "IOC", name: "Indian Oil Corp" },
];

// Split into 2 batches of ~25
const BATCH_1 = ALL_SYMBOLS.slice(0, 25);
const BATCH_2 = ALL_SYMBOLS.slice(25);


// ─────────────────────────────────────────────────────────────
// IST TIMEZONE UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Get IST hour and minute from a Unix timestamp (seconds).
 * Uses Intl API — reliable across all environments.
 */
function getISTHourMinute(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hourStr = parts.find(p => p.type === 'hour')?.value || '0';
  const minStr  = parts.find(p => p.type === 'minute')?.value || '0';
  // Intl can return "24" for midnight in some locales — not a concern during market hours
  return {
    hours: parseInt(hourStr === '24' ? '0' : hourStr, 10),
    minutes: parseInt(minStr, 10),
  };
}

/**
 * Check if a Unix timestamp falls on a weekday (Mon-Fri) in IST.
 */
function isWeekdayIST(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(date);
  return !['Sat', 'Sun'].includes(weekday);
}

/**
 * Check if a candle's START time falls within NSE market hours.
 * Market hours: 9:15 AM to 3:30 PM IST.
 * Valid 15-min candle start times: 9:15, 9:30, 9:45, ..., 15:15
 * (The last candle 15:15-15:30 is the final candle of the day.)
 */
function isMarketHoursIST(unixSeconds) {
  const { hours, minutes } = getISTHourMinute(unixSeconds);
  const totalMinutes = hours * 60 + minutes;
  const MARKET_OPEN  = 9 * 60 + 15;   // 9:15 AM  = 555 min
  const LAST_CANDLE  = 15 * 60 + 15;  // 3:15 PM  = 915 min (last candle start)
  return totalMinutes >= MARKET_OPEN && totalMinutes <= LAST_CANDLE;
}

/**
 * Check if a 15-minute candle is fully COMPLETED.
 * A candle starting at time T is complete when NOW >= T + 15 minutes.
 */
function isCandleCompleted(candleStartUnixSeconds) {
  const candleEndMs = (candleStartUnixSeconds + 15 * 60) * 1000;
  return Date.now() >= candleEndMs;
}

/**
 * Align a Unix timestamp (seconds) to the nearest 15-minute floor boundary.
 * e.g., 09:17:32 → 09:15:00, 10:03:12 → 10:00:00
 */
function alignTo15Min(unixSeconds) {
  return Math.floor(unixSeconds / 900) * 900;
}

/**
 * Get IST date string (DD/MM/YYYY) for a Unix timestamp.
 */
function getISTDateString(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const day   = parts.find(p => p.type === 'day')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const year  = parts.find(p => p.type === 'year')?.value;
  return `${day}/${month}/${year}`;
}

/**
 * Get IST time string (e.g., "09:15 AM") for a Unix timestamp.
 */
function getISTTimeString(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date).toUpperCase();
}


// ─────────────────────────────────────────────────────────────
// YAHOO FINANCE FETCHER
// ─────────────────────────────────────────────────────────────

/**
 * Fetch raw chart data from Yahoo Finance.
 * Uses 2-day range to ensure we always have enough completed candles.
 */
async function fetchFromYahoo(ticker, range = '2d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=15m&range=${range}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${response.status} for ${ticker}`);
  }
  return response.json();
}


// ─────────────────────────────────────────────────────────────
// CORE: FETCH + FILTER CLEAN CANDLES
// ─────────────────────────────────────────────────────────────

/**
 * Fetch 15-min candles for a single symbol, applying strict filters:
 *   1. Align to 15-min boundary
 *   2. Must be a weekday in IST
 *   3. Must be within market hours (9:15 AM - 3:15 PM start time)
 *   4. Must be a COMPLETED candle (end time has passed)
 *   5. Merge duplicates at the same aligned timestamp
 *
 * Returns: { quotes: [...], meta: {...} }
 *   Each quote: { timestamp, date, dateStr, timeStr, open, high, low, close, volume }
 */
async function fetchCleanCandles(symbol) {
  try {
    const ticker = symbol === 'NIFTY50' ? '^NSEI' : `${symbol}.NS`;
    const data = await fetchFromYahoo(ticker, '2d');

    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      return { quotes: [], meta: null };
    }

    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];
    const quotes = [];

    for (let i = 0; i < timestamps.length; i++) {
      const rawOpen  = q.open[i];
      const rawHigh  = q.high[i];
      const rawLow   = q.low[i];
      const rawClose = q.close[i];
      const rawVol   = q.volume?.[i] || 0;

      // Skip null/invalid candles
      if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null) continue;

      // Align timestamp to 15-minute boundary
      const ts = alignTo15Min(timestamps[i]);

      // FILTER 1: Must be a weekday (Mon-Fri in IST)
      if (!isWeekdayIST(ts)) continue;

      // FILTER 2: Must be within market hours (9:15 AM - 3:15 PM IST candle start)
      if (!isMarketHoursIST(ts)) continue;

      // FILTER 3: Must be a COMPLETED candle (current time >= candle end)
      if (!isCandleCompleted(ts)) continue;

      const open  = Number(rawOpen.toFixed(2));
      const high  = Number(rawHigh.toFixed(2));
      const low   = Number(rawLow.toFixed(2));
      const close = Number(rawClose.toFixed(2));

      // Check for duplicate aligned timestamp (merge if needed)
      const existing = quotes.find(c => c.timestamp === ts);
      if (existing) {
        existing.high   = Math.max(existing.high, high);
        existing.low    = Math.min(existing.low, low);
        existing.close  = close;
        existing.volume += rawVol;
        continue;
      }

      quotes.push({
        timestamp: ts,
        date: new Date(ts * 1000),
        dateStr: getISTDateString(ts),
        timeStr: getISTTimeString(ts),
        open,
        high,
        low,
        close,
        volume: rawVol,
      });
    }

    // Sort chronologically (ascending)
    quotes.sort((a, b) => a.timestamp - b.timestamp);

    return { quotes, meta: result.meta };
  } catch (error) {
    console.error(`[CANDLE IMPORT] Error fetching ${symbol}:`, error.message);
    return { quotes: [], meta: null };
  }
}


// ─────────────────────────────────────────────────────────────
// BATCH IMPORT
// ─────────────────────────────────────────────────────────────

/**
 * Import candles for a batch of symbols with rate-limiting delay.
 * Returns: { [symbol]: { quotes, meta, name } }
 */
async function importBatch(symbols, batchName) {
  console.log(`[CANDLE IMPORT] ${batchName}: Importing ${symbols.length} stocks...`);
  const results = {};

  for (const stock of symbols) {
    const { quotes, meta } = await fetchCleanCandles(stock.symbol);
    if (quotes.length > 0) {
      results[stock.symbol] = { quotes, meta, name: stock.name };
      console.log(`  ✓ ${stock.symbol}: ${quotes.length} clean candles (last: ${quotes[quotes.length - 1].timeStr} ${quotes[quotes.length - 1].dateStr})`);
    } else {
      console.log(`  ✗ ${stock.symbol}: No valid candles`);
    }
    // 300ms delay between requests to respect Yahoo rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  const imported = Object.keys(results).length;
  console.log(`[CANDLE IMPORT] ${batchName} complete: ${imported}/${symbols.length} stocks imported`);
  return results;
}


/**
 * MAIN: Import all candles in 2 batches + Nifty 50 index.
 *
 * Flow:
 *   1. Import Batch 1 (first 25 stocks)
 *   2. Brief pause
 *   3. Import Batch 2 (remaining stocks)
 *   4. Import Nifty 50 index
 *   5. Return all clean candles for the scanner
 *
 * Returns: { [symbol]: { quotes, meta, name } }
 */
async function importAllCandles() {
  const startTime = Date.now();
  console.log('');
  console.log('[CANDLE IMPORT] ══════════════════════════════════════════');
  console.log('[CANDLE IMPORT] Starting candle import at ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('[CANDLE IMPORT] ══════════════════════════════════════════');

  // Batch 1: First 25 stocks
  const batch1 = await importBatch(BATCH_1, 'Batch 1 (1-25)');

  // Pause between batches to avoid rate throttling
  await new Promise(r => setTimeout(r, 1000));

  // Batch 2: Remaining stocks
  const batch2 = await importBatch(BATCH_2, 'Batch 2 (26-50+)');

  // Nifty 50 Index
  console.log('[CANDLE IMPORT] Importing NIFTY 50 index...');
  const niftyResult = await fetchCleanCandles('NIFTY50');

  const allCandles = { ...batch1, ...batch2 };
  if (niftyResult.quotes.length > 0) {
    allCandles['NIFTY50'] = { quotes: niftyResult.quotes, meta: niftyResult.meta, name: 'Nifty 50 Index' };
    console.log(`  ✓ NIFTY50: ${niftyResult.quotes.length} clean candles`);
  } else {
    console.log('  ✗ NIFTY50: No valid candles');
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalStocks = Object.keys(allCandles).length;
  console.log('');
  console.log(`[CANDLE IMPORT] ✅ DONE: ${totalStocks} stocks imported in ${totalTime}s`);
  console.log('[CANDLE IMPORT] ══════════════════════════════════════════');
  console.log('');

  return allCandles;
}


module.exports = {
  importAllCandles,
  fetchCleanCandles,
  ALL_SYMBOLS,
  BATCH_1,
  BATCH_2,
  // Export utilities for testing
  getISTHourMinute,
  getISTDateString,
  getISTTimeString,
  isWeekdayIST,
  isMarketHoursIST,
  isCandleCompleted,
  alignTo15Min,
};
