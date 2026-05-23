require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

let yahooFinancePromise;
function getYahooFinance() {
  if (!yahooFinancePromise) {
    yahooFinancePromise = import('yahoo-finance2').then(mod => mod.default);
  }
  return yahooFinancePromise;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SCAN_SYMBOLS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries' },
  { symbol: 'TCS', name: 'TCS' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'INFY', name: 'Infosys' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever' },
  { symbol: 'ITC', name: 'ITC' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'LT', name: 'Larsen & Toubro' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma' },
  { symbol: 'TITAN', name: 'Titan Company' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement' },
  { symbol: 'TATASTEEL', name: 'Tata Steel' },
  { symbol: 'NTPC', name: 'NTPC' },
  { symbol: 'HCLTECH', name: 'HCL Technologies' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra' },
  { symbol: 'POWERGRID', name: 'Power Grid' },
  { symbol: 'ONGC', name: 'ONGC' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports' },
  { symbol: 'WIPRO', name: 'Wipro' },
  { symbol: 'COALINDIA', name: 'Coal India' },
  { symbol: 'TECHM', name: 'Tech Mahindra' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { symbol: 'NESTLEIND', name: 'Nestle India' },
  { symbol: 'LTIM', name: 'LTIMindtree' },
  { symbol: 'HINDALCO', name: 'Hindalco' },
  { symbol: 'BRITANNIA', name: 'Britannia' },
  { symbol: 'GRASIM', name: 'Grasim' },
  { symbol: 'DRREDDY', name: 'Dr. Reddy\\'s' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors' },
  { symbol: 'SBILIFE', name: 'SBI Life' },
  { symbol: 'BPCL', name: 'BPCL' },
  { symbol: 'CIPLA', name: 'Cipla' },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto' },
  { symbol: 'DIVISLAB', name: 'Divi\\'s Lab' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp' },
  { symbol: 'UPL', name: 'UPL' },
  { symbol: 'GLAND', name: 'Gland Pharma' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer' },
  { symbol: 'TMCV', name: 'Tata Motors CV' },
  // Additional requested ones
  { symbol: 'POLYCAB', name: 'Polycab India' },
  { symbol: 'BHARATFORG', name: 'Bharat Forge (IFORGE)' },
  { symbol: 'IEX', name: 'Indian Energy Exchange' },
  { symbol: 'DEEPAKNTR', name: 'Deepak Nitrite' }
];

const INTERVALS = ['1m', '5m', '15m', '30m', '60m', '1d'];
const SLEEP_MS = 500; // Rate limiting

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndSaveHistoricalCharts() {
  console.log("Starting daily archiver for historical charts...");
  const yahooFinance = await getYahooFinance();

  const today = new Date();
  const optionsDate = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const dateParts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(today);
  const year = dateParts.find(p => p.type === 'year').value;
  const month = dateParts.find(p => p.type === 'month').value;
  const day = dateParts.find(p => p.type === 'day').value;
  const candleDateStr = `${year}-${month}-${day}`;

  for (const stock of SCAN_SYMBOLS) {
    let ticker = stock.symbol;
    if (ticker === 'M&M') ticker = 'M%26M';
    ticker = `${ticker}.NS`;

    for (const interval of INTERVALS) {
      try {
        await sleep(SLEEP_MS); // Prevent Yahoo rate limits
        const result = await yahooFinance.chart(ticker, { interval: interval, range: '1d' });
        
        if (result && result.meta && result.quotes && result.quotes.length > 0) {
          const validQuotes = result.quotes.filter(q => q.open !== null && q.high !== null && q.low !== null && q.close !== null);
          if (validQuotes.length > 0) {
              const candles = validQuotes.map(q => ({
                  time: Math.floor(q.date.getTime() / 1000),
                  open: q.open,
                  high: q.high,
                  low: q.low,
                  close: q.close
              }));

              const query = `
                  INSERT INTO historical_charts (symbol, candle_date, interval, chart_data)
                  VALUES ($1, $2, $3, $4)
                  ON CONFLICT (symbol, candle_date, interval) 
                  DO UPDATE SET chart_data = EXCLUDED.chart_data
              `;
              await pool.query(query, [stock.symbol, candleDateStr, interval, JSON.stringify(candles)]);
          }
        }
      } catch (err) {
        console.error(`Error fetching/saving ${ticker} at ${interval}:`, err.message);
      }
    }
    console.log(`Archived ${stock.symbol} for ${candleDateStr}`);
  }
  
  console.log("Historical chart archiver completed successfully.");
}

// Allow direct execution for testing
if (require.main === module) {
  fetchAndSaveHistoricalCharts().then(() => pool.end()).catch(e => {
      console.error(e);
      pool.end();
  });
}

module.exports = { fetchAndSaveHistoricalCharts };
