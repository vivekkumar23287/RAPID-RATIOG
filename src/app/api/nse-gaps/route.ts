import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
    // 1. Enforce Time Restriction: Calculation should start only after 9:31 AM IST
    const now = new Date();
    const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowISTString);
    const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, '0')}-${nowIST.getDate().toString().padStart(2, '0')}`;
    
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS scanner_cache (
        id SERIAL PRIMARY KEY,
        date_str VARCHAR(20) NOT NULL,
        scanner_type VARCHAR(50) NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date_str, scanner_type)
      )
    `;

    // Try to get from DB first
    const cached = await sql`SELECT results FROM scanner_cache WHERE date_str = ${dateStr} AND scanner_type = 'nse-gaps'`;
    if (cached.length > 0) {
       return NextResponse.json(cached[0].results);
    }
    
    // Market opens at 9:15 AM. First 15-min candle fully completes at 9:30 AM. Allow 1 min for Yahoo delay.
    const isMarketOpenAndCandleClosed = nowIST.getHours() > 9 || (nowIST.getHours() === 9 && nowIST.getMinutes() >= 31);
    
    if (!isMarketOpenAndCandleClosed) {
      // Return yesterday's data instead of failing/empty, so clients always see latest processed data
      const latest = await sql`SELECT results FROM scanner_cache WHERE scanner_type = 'nse-gaps' ORDER BY date_str DESC LIMIT 1`;
      if (latest.length > 0) {
         return NextResponse.json(latest[0].results);
      }
      return NextResponse.json({
        gapUps: [],
        gapDowns: [],
        timestamp: new Date().toISOString(),
        message: "Waiting for the first 15-minute candle to close (9:31 AM IST)."
      });
    }

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

          // 2. Identify the 9:15 AM candle (First 15-min candle)
          const firstCandle = todayCandles.find(c => {
            const date = new Date(c.timestamp * 1000);
            const istDateString = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            const istDate = new Date(istDateString);
            return istDate.getHours() === 9 && istDate.getMinutes() === 15;
          });

          if (!firstCandle) return null;

          const currentPrice = meta.regularMarketPrice ?? firstCandle.close;
          const changePercent = meta.regularMarketChangePercent ?? 0;

          // 3. Apply the Strict True Gap Rules:
          // TRUE GAP UP: First 15-min candle's LOW is strictly higher than yesterday's FULL DAY HIGH.
          // It should NOT touch or go below yesterday's high.
          const isGapUp = firstCandle.low > yesterdayHigh;

          // TRUE GAP DOWN: First 15-min candle's HIGH is strictly lower than yesterday's FULL DAY LOW.
          // It should NOT touch or go above yesterday's low.
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

    const responsePayload = {
      gapUps,
      gapDowns,
      timestamp: new Date().toISOString()
    };
    
    // Save to DB so subsequent calls today don't recalculate
    await sql`
      INSERT INTO scanner_cache (date_str, scanner_type, results)
      VALUES (${dateStr}, 'nse-gaps', ${responsePayload as any})
      ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
    `;

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("NSE Gaps calculations exception:", error);
    return NextResponse.json({
      gapUps: [],
      gapDowns: [],
      timestamp: new Date().toISOString()
    });
  }
}
