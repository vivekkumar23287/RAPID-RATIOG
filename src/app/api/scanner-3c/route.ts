import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NIFTY_50_STOCKS as RAW_SYMBOLS } from "@/lib/stocks";

export const dynamic = "force-dynamic";

// Include all stocks, NIFTY50 index, and Bitcoin (BTC)
const SCAN_SYMBOLS = RAW_SYMBOLS;

const fetchYahoo15mCandles = async (symbol: string) => {
  const upper = symbol.toUpperCase();
  const yahooSymbol = upper === "NIFTY50" || upper === "NIFTY" 
    ? "^NSEI" 
    : upper === "BTC" || upper === "BTC-USD" 
    ? "BTC-USD" 
    : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=5d&interval=15m&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      next: { revalidate: 15 }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Fetch error for ${symbol}:`, error);
    return null;
  }
};

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  dateString: string;
  timeString: string;
}

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    const now = new Date();
    const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowISTString);
    const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, '0')}-${nowIST.getDate().toString().padStart(2, '0')}`;
    const nowTs = Math.floor(Date.now() / 1000);

    const { searchParams } = new URL(req.url);
    const singleSymbol = searchParams.get("symbol");

    // Only serve from static DB cache if market is completely closed (after 3:35 PM IST or weekends)
    const isMarketOpen = 
      nowIST.getDay() >= 1 && 
      nowIST.getDay() <= 5 && 
      ((nowIST.getHours() === 9 && nowIST.getMinutes() >= 15) || (nowIST.getHours() > 9 && nowIST.getHours() < 15) || (nowIST.getHours() === 15 && nowIST.getMinutes() <= 35));

    if (!singleSymbol && !isMarketOpen) {
      try {
        const cached = await sql`SELECT results FROM scanner_cache WHERE date_str = ${dateStr} AND scanner_type = 'scanner-3c'`;
        if (cached.length > 0) {
          return NextResponse.json(cached[0].results);
        }
      } catch {}
    }

    const symbolsToScan = singleSymbol
      ? SCAN_SYMBOLS.filter(s => s.symbol.toUpperCase() === singleSymbol.toUpperCase())
      : SCAN_SYMBOLS;

    if (symbolsToScan.length === 0) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    const chunkSize = 12;
    const allResults: any[] = [];

    for (let i = 0; i < symbolsToScan.length; i += chunkSize) {
      const chunk = symbolsToScan.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (item) => {
        try {
          const rawData = await fetchYahoo15mCandles(item.symbol);
          const result = rawData?.chart?.result?.[0];
          if (!result) return null;

          const meta = result.meta;
          const timestamps: number[] = result.timestamp || [];
          const quote = result.indicators?.quote?.[0];
          if (!quote || timestamps.length === 0) return null;

          // Group completed candles by IST date
          const candleGroups: { [date: string]: Candle[] } = {};
          const allCandlesByTs: { [ts: number]: Candle } = {};

          timestamps.forEach((ts: number, index: number) => {
            const o = quote.open?.[index];
            const h = quote.high?.[index];
            const l = quote.low?.[index];
            const c = quote.close?.[index];
            const v = quote.volume?.[index] || 0;

            if (
              o !== undefined && h !== undefined && l !== undefined && c !== undefined &&
              o !== null && h !== null && l !== null && c !== null
            ) {
              const candleDate = new Date(ts * 1000);
              const dateString = candleDate.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
              }).replace(/-/g, "/");

              const timeString = candleDate.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
              }).toUpperCase();

              const candleObj: Candle = {
                open: parseFloat(o.toFixed(2)),
                high: parseFloat(h.toFixed(2)),
                low: parseFloat(l.toFixed(2)),
                close: parseFloat(c.toFixed(2)),
                volume: v,
                timestamp: ts,
                dateString,
                timeString
              };

              allCandlesByTs[ts] = candleObj;

              // Rule: "Use completed 15-minute candles for the first three candles."
              // A 15-minute candle is completed if current time >= ts + 15 * 60
              const isCompleted = nowTs >= (ts + 15 * 60);

              if (isCompleted) {
                if (!candleGroups[dateString]) {
                  candleGroups[dateString] = [];
                }
                candleGroups[dateString].push(candleObj);
              }
            }
          });

          // Sort dates chronologically
          const sortedDates = Object.keys(candleGroups).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split("/").map(Number);
            const [dayB, monthB, yearB] = b.split("/").map(Number);
            return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
          });

          if (sortedDates.length === 0) return null;

          const isCrypto = item.symbol.toUpperCase() === "BTC" || item.symbol.toUpperCase() === "BTC-USD";
          let completedCandles: Candle[] = [];

          if (isCrypto) {
            // For 24/7 crypto, scan across all recent completed candles
            const allCompleted = Object.values(candleGroups).flat().sort((a, b) => a.timestamp - b.timestamp);
            completedCandles = allCompleted.slice(-40);
          } else {
            // Scan the latest session's completed candles
            const latestDate = sortedDates[sortedDates.length - 1];
            completedCandles = [...candleGroups[latestDate]].sort((a, b) => a.timestamp - b.timestamp);
            // If latest session has fewer than 3 candles (e.g. morning open), fall back to previous session
            if (completedCandles.length < 3 && sortedDates.length >= 2) {
              const prevDate = sortedDates[sortedDates.length - 2];
              completedCandles = [...candleGroups[prevDate]].sort((a, b) => a.timestamp - b.timestamp);
            }
          }

          if (completedCandles.length < 3) return null;

          // -------------------------------------------------------------
          // 3-CANDLE GAP STRATEGY LOGIC (Bullish & Bearish)
          // 1. Bullish 3-Candle Gap:
          //    - Candle 1: Green (c1.close > c1.open)
          //    - Candle 2: Any (bullish, bearish, or doji)
          //    - Candle 3: Green (c3.close > c3.open)
          //    - Gap Condition: c3.low > c1.high
          //    - Gap Points: c3.low - c1.high
          // 2. Bearish 3-Candle Gap:
          //    - Candle 1: Red (c1.close < c1.open)
          //    - Candle 2: Any (bullish, bearish, or doji)
          //    - Candle 3: Red (c3.close < c3.open)
          //    - Gap Condition: c3.high < c1.low
          //    - Gap Points: c1.low - c3.high
          // -------------------------------------------------------------
          let latestConfirmedSetup: any = null;

          for (let idx = 0; idx <= completedCandles.length - 3; idx++) {
            const c1 = completedCandles[idx];
            const c2 = completedCandles[idx + 1];
            const c3 = completedCandles[idx + 2];

            // Bullish Detection Rule:
            // Candle 1 Close > Candle 1 Open AND Candle 3 Close > Candle 3 Open AND Candle 3 Low > Candle 1 High
            const isBullish = (c1.close > c1.open) && (c3.close > c3.open) && (c3.low > c1.high);

            // Bearish Detection Rule:
            // Candle 1 Close < Candle 1 Open AND Candle 3 Close < Candle 3 Open AND Candle 3 High < Candle 1 Low
            const isBearish = (c1.close < c1.open) && (c3.close < c3.open) && (c3.high < c1.low);

            if (!isBullish && !isBearish) continue;

            const gapPoints = isBullish
              ? Number((c3.low - c1.high).toFixed(2))
              : Number((c1.low - c3.high).toFixed(2));

            latestConfirmedSetup = {
              c1,
              c2,
              c3,
              signal_type: isBullish ? "BULLISH 3-CANDLE GAP" : "BEARISH 3-CANDLE GAP",
              direction: isBullish ? "UP" : "DOWN",
              gap_points: gapPoints,
              c1_high: c1.high,
              c1_low: c1.low,
              c3_high: c3.high,
              c3_low: c3.low,
              detection_time: c3.timeString,
              candle_time: `${c1.timeString} - ${c3.timeString}`,
              candle_date: c3.dateString,
              trigger_price: c3.close,
            };
          }

          if (!latestConfirmedSetup) return null;

          const currentPrice = meta.regularMarketPrice ?? latestConfirmedSetup.trigger_price;
          const changePercent = meta.regularMarketChangePercent ?? 0;

          return {
            symbol: item.symbol,
            name: item.name,
            signal_type: latestConfirmedSetup.signal_type,
            direction: latestConfirmedSetup.direction,
            timeframe: "15m",
            gap_points: latestConfirmedSetup.gap_points,
            currentPrice,
            changePercent,
            trigger_price: latestConfirmedSetup.trigger_price,
            open_price: latestConfirmedSetup.trigger_price,
            high_price: Math.max(latestConfirmedSetup.c1_high, latestConfirmedSetup.c3_high),
            low_price: Math.min(latestConfirmedSetup.c1_low, latestConfirmedSetup.c3_low),
            close_price: latestConfirmedSetup.trigger_price,
            c1_high: latestConfirmedSetup.c1_high,
            c1_low: latestConfirmedSetup.c1_low,
            c3_high: latestConfirmedSetup.c3_high,
            c3_low: latestConfirmedSetup.c3_low,
            candle_time: latestConfirmedSetup.candle_time,
            detection_time: latestConfirmedSetup.detection_time,
            candle_date: latestConfirmedSetup.candle_date,
            confirmationTime: latestConfirmedSetup.detection_time,
            referenceRange: {
              high: latestConfirmedSetup.c1_high,
              low: latestConfirmedSetup.c1_low
            },
            candles: [
              latestConfirmedSetup.c1,
              latestConfirmedSetup.c2,
              latestConfirmedSetup.c3
            ]
          };
        } catch (err) {
          console.error(`Error processing 3C setup for ${item.symbol}:`, err);
          return null;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      allResults.push(...chunkResults.filter(Boolean));

      if (i + chunkSize < symbolsToScan.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    const matches = allResults.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
    const timeTaken = Date.now() - startTime;

    const responsePayload = {
      success: true,
      matchesCount: matches.length,
      matches,
      scannedCount: symbolsToScan.length,
      timestamp: new Date().toISOString(),
      timeTakenMs: timeTaken
    };

    // Cache results in DB if scanning full list
    if (!singleSymbol) {
      try {
        await sql`
          INSERT INTO scanner_cache (date_str, scanner_type, results)
          VALUES (${dateStr}, 'scanner-3c', ${JSON.stringify(responsePayload)})
          ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
        `;
      } catch {
        // Cache table might not exist or connection failed; ignore and proceed
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("Scanner-3C exception:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to run 3-candle gap scanner"
    }, { status: 500 });
  }
}
