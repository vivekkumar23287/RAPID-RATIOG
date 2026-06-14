

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

const BATCH_1 = ALL_SYMBOLS.slice(0, 25);
const BATCH_2 = ALL_SYMBOLS.slice(25);

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
  
  return {
    hours: parseInt(hourStr === '24' ? '0' : hourStr, 10),
    minutes: parseInt(minStr, 10),
  };
}

function isWeekdayIST(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(date);
  return !['Sat', 'Sun'].includes(weekday);
}

function isMarketHoursIST(unixSeconds) {
  const { hours, minutes } = getISTHourMinute(unixSeconds);
  const totalMinutes = hours * 60 + minutes;
  const MARKET_OPEN  = 9 * 60 + 15;   
  const LAST_CANDLE  = 15 * 60 + 15;  
  return totalMinutes >= MARKET_OPEN && totalMinutes <= LAST_CANDLE;
}

function isCandleCompleted(candleStartUnixSeconds) {
  const candleEndMs = (candleStartUnixSeconds + 15 * 60) * 1000;
  return Date.now() >= candleEndMs;
}

function alignTo15Min(unixSeconds) {
  return Math.floor(unixSeconds / 900) * 900;
}

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

function getISTTimeString(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date).toUpperCase();
}

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

      
      if (rawOpen == null || rawHigh == null || rawLow == null || rawClose == null) continue;

      
      const ts = alignTo15Min(timestamps[i]);

      
      if (!isWeekdayIST(ts)) continue;

      
      if (!isMarketHoursIST(ts)) continue;

      
      if (!isCandleCompleted(ts)) continue;

      const open  = Number(rawOpen.toFixed(2));
      const high  = Number(rawHigh.toFixed(2));
      const low   = Number(rawLow.toFixed(2));
      const close = Number(rawClose.toFixed(2));

      
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

    
    quotes.sort((a, b) => a.timestamp - b.timestamp);

    return { quotes, meta: result.meta };
  } catch (error) {
    console.error(`[CANDLE IMPORT] Error fetching ${symbol}:`, error.message);
    return { quotes: [], meta: null };
  }
}

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
    
    await new Promise(r => setTimeout(r, 300));
  }

  const imported = Object.keys(results).length;
  console.log(`[CANDLE IMPORT] ${batchName} complete: ${imported}/${symbols.length} stocks imported`);
  return results;
}

async function importAllCandles() {
  const startTime = Date.now();
  console.log('');
  console.log('[CANDLE IMPORT] ══════════════════════════════════════════');
  console.log('[CANDLE IMPORT] Starting candle import at ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('[CANDLE IMPORT] ══════════════════════════════════════════');

  
  const batch1 = await importBatch(BATCH_1, 'Batch 1 (1-25)');

  
  await new Promise(r => setTimeout(r, 1000));

  
  const batch2 = await importBatch(BATCH_2, 'Batch 2 (26-50+)');

  
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
  
  getISTHourMinute,
  getISTDateString,
  getISTTimeString,
  isWeekdayIST,
  isMarketHoursIST,
  isCandleCompleted,
  alignTo15Min,
};
