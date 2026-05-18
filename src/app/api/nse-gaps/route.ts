import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Predefined list of active high-volume NSE Nifty stocks to monitor
const SCANNER_SYMBOLS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "TCS" },
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
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" }
];


const fetchStockData = async (symbol: string) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?range=3d&interval=15m`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    },
    next: { revalidate: 10 } // Cache charts for 10 seconds to protect API
  });
  if (!res.ok) return null;
  return res.json();
};

export async function GET() {
  try {
    const rawResults = await Promise.all(
      SCANNER_SYMBOLS.map(async (item) => {
        try {
          const data = await fetchStockData(item.symbol);
          const chartResult = data?.chart?.result?.[0];
          if (!chartResult) return null;

          const meta = chartResult.meta;
          const timestamps = chartResult.timestamp || [];
          const quote = chartResult.indicators?.quote?.[0];
          if (!quote || timestamps.length === 0) return null;

          // Group candles by Indian calendar date string
          const candleGroups: { 
            [date: string]: { high: number; low: number; open: number; close: number; timestamp: number }[] 
          } = {};

          timestamps.forEach((ts: number, index: number) => {
            const o = quote.open?.[index];
            const h = quote.high?.[index];
            const l = quote.low?.[index];
            const c = quote.close?.[index];

            if (o !== undefined && h !== undefined && l !== undefined && c !== undefined && o !== null && h !== null && l !== null && c !== null) {
              const date = new Date(ts * 1000);
              const dateString = date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
              const cleanDateString = dateString.replace(/-/g, "/");

              if (!candleGroups[cleanDateString]) {
                candleGroups[cleanDateString] = [];
              }
              candleGroups[cleanDateString].push({ open: o, high: h, low: l, close: c, timestamp: ts });
            }
          });

          // Sort dates descending so newest date is dates[0]
          const sortedDates = Object.keys(candleGroups).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split("/").map(Number);
            const [dayB, monthB, yearB] = b.split("/").map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateB.getTime() - dateA.getTime();
          });

          if (sortedDates.length < 2) return null;

          const todayDate = sortedDates[0];
          const yesterdayDate = sortedDates[1];

          const todayCandles = candleGroups[todayDate] || [];
          const yesterdayCandles = candleGroups[yesterdayDate] || [];

          if (todayCandles.length === 0 || yesterdayCandles.length === 0) return null;

          // 1. Calculate Yesterday's Session High and Low
          const yesterdayHigh = Math.max(...yesterdayCandles.map(c => c.high));
          const yesterdayLow = Math.min(...yesterdayCandles.map(c => c.low));

          if (!isFinite(yesterdayHigh) || !isFinite(yesterdayLow)) return null;

          // 2. Identify the first 15-minute candle of today (sort ascending by timestamp)
          const sortedTodayCandles = [...todayCandles].sort((a, b) => a.timestamp - b.timestamp);
          const firstCandle = sortedTodayCandles[0];
          if (!firstCandle) return null;

          const currentPrice = meta.regularMarketPrice ?? firstCandle.close;
          const changePercent = meta.regularMarketChangePercent ?? 0;

          // 3. Apply the User's strict Breakout Rules:
          // GAP UP BREAKOUT: First 15-min candle's low is strictly higher than yesterday's session high
          const isGapUp = firstCandle.low > yesterdayHigh;

          // GAP DOWN BREAKDOWN: First 15-min candle's high is strictly lower than yesterday's session low
          const isGapDown = firstCandle.high < yesterdayLow;

          let gapPercent = 0;
          if (isGapUp) {
            gapPercent = ((firstCandle.open - yesterdayHigh) / yesterdayHigh) * 100;
          } else if (isGapDown) {
            gapPercent = ((firstCandle.open - yesterdayLow) / yesterdayLow) * 100;
          }

          return {
            symbol: item.symbol,
            name: item.name,
            price: currentPrice,
            changePercent,
            gapPercent: Math.abs(gapPercent), // Present as a positive percentage size for visual consistency
            isGapUp,
            isGapDown
          };
        } catch (e) {
          console.error(`Error processing ${item.symbol}:`, e);
          return null;
        }
      })
    );

    const processedStocks = rawResults.filter((s): s is NonNullable<typeof s> => s !== null);

    const gapUps = processedStocks
      .filter(s => s.isGapUp)
      .sort((a, b) => b.gapPercent - a.gapPercent);

    const gapDowns = processedStocks
      .filter(s => s.isGapDown)
      .sort((a, b) => b.gapPercent - a.gapPercent);

    return NextResponse.json({
      gapUps,
      gapDowns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("NSE Gaps calculations exception:", error);
    return NextResponse.json({
      gapUps: [],
      gapDowns: [],
      timestamp: new Date().toISOString()
    });
  }
}
