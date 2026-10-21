import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NIFTY_50_STOCKS as RAW_SYMBOLS } from "@/lib/stocks";

export const dynamic = "force-dynamic";

// Filter out BTC so scanner strictly scans NSE stocks and NIFTY50 index
const SCAN_SYMBOLS = RAW_SYMBOLS.filter(s => s.symbol.toUpperCase() !== "BTC");

const fetchYahoo15mCandles = async (symbol: string) => {
  const upper = symbol.toUpperCase();
  const yahooSymbol = upper === "NIFTY50" || upper === "NIFTY" ? "^NSEI" : `${symbol}.NS`;
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
      } catch (_) {}
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

          // Scan the latest session's completed candles
          const latestDate = sortedDates[sortedDates.length - 1];
          const completedCandles = [...candleGroups[latestDate]].sort((a, b) => a.timestamp - b.timestamp);

          if (completedCandles.length < 3) return null;

          // -------------------------------------------------------------
          // 3-CANDLE BREAKOUT STRATEGY LOGIC
          // 1. Candle 1: Red reference candle (close < open)
          // 2. Candle 2: Green candle (close > open) & c2.high > c1.high
          // 3. Candle 3: Green candle (close > open) & c3.high > c2.high
          // 4. Candle 4: Signal triggers only when Candle 4 begins!
          // -------------------------------------------------------------
          let latestConfirmedSetup: any = null;

          for (let idx = 0; idx <= completedCandles.length - 3; idx++) {
            const c1 = completedCandles[idx];
            const c2 = completedCandles[idx + 1];
            const c3 = completedCandles[idx + 2];

            // Condition 1: Candle 1 must be RED
            const isC1Red = c1.close < c1.open;
            if (!isC1Red) continue;

            // Condition 2: Candle 2 must be GREEN and HIGH > c1.high
            const isC2Green = c2.close > c2.open;
            const isC2Breakout = c2.high > c1.high;
            if (!isC2Green || !isC2Breakout) continue;

            // Condition 3: Candle 3 must be GREEN and HIGH > c2.high
            const isC3Green = c3.close > c3.open;
            const isC3Breakout = c3.high > c2.high;
            if (!isC3Green || !isC3Breakout) continue;

            // Condition 4: Candle 4 verification (must check for 5 to 8 min and confirm it is a GREEN candle)
            // Candle 3 ends at c3.timestamp + 15 * 60, which is precisely when Candle 4 begins.
            const c4StartTs = c3.timestamp + 15 * 60;
            const elapsedSec = nowTs - c4StartTs;
            const c4Candle = allCandlesByTs[c4StartTs];
            const isCompletedPastCandle = c4Candle != null && nowTs >= (c4StartTs + 15 * 60);

            // 1. Must check for at least 5 to 8 minutes into Candle 4
            // If Candle 4 is currently in progress, at least 5 minutes (300 seconds) must have elapsed
            if (!isCompletedPastCandle && elapsedSec < 5 * 60) {
              // Wait 5 to 8 minutes before adding company name
              continue;
            }

            // 2. Check if Candle 4 has become a GREEN candle
            const c4Open = c4Candle ? c4Candle.open : c3.close;
            const c4CurrentPrice = c4Candle ? c4Candle.close : meta.regularMarketPrice ?? c3.close;
            const isC4Green = c4CurrentPrice > c4Open;

            if (!isC4Green) {
              // Candle 4 is RED or flat — do not add company name
              continue;
            }

            const c4StartDate = new Date(c4StartTs * 1000);
            const c4StartTimeStr = c4StartDate.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            }).toUpperCase();

            const c4EndDate = new Date((c4StartTs + 15 * 60) * 1000);
            const c4EndTimeStr = c4EndDate.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true
            }).toUpperCase();

            latestConfirmedSetup = {
              c1,
              c2,
              c3,
              c4: c4Candle || null,
              c4StartTs,
              candleTime: `${c4StartTimeStr} - ${c4EndTimeStr}`,
              candleDate: latestDate,
              confirmationTime: c4StartTimeStr,
              referenceRange: {
                high: c1.high,
                low: c1.low
              },
              breakoutLevels: {
                c2High: c2.high,
                c3High: c3.high
              },
              triggerPrice: c4CurrentPrice,
            };
          }

          if (!latestConfirmedSetup) return null;

          const currentPrice = meta.regularMarketPrice ?? latestConfirmedSetup.triggerPrice;
          const changePercent = meta.regularMarketChangePercent ?? 0;

          return {
            symbol: item.symbol,
            name: item.name,
            signal_type: "3-CANDLE BUY BREAKOUT",
            direction: "UP",
            timeframe: "15m",
            currentPrice,
            changePercent,
            open_price: latestConfirmedSetup.triggerPrice,
            high_price: latestConfirmedSetup.breakoutLevels.c3High,
            low_price: latestConfirmedSetup.referenceRange.low,
            close_price: latestConfirmedSetup.triggerPrice,
            candle_time: latestConfirmedSetup.candleTime,
            candle_date: latestConfirmedSetup.candleDate,
            confirmationTime: latestConfirmedSetup.confirmationTime,
            referenceRange: latestConfirmedSetup.referenceRange,
            breakoutLevels: latestConfirmedSetup.breakoutLevels,
            candles: [
              latestConfirmedSetup.c1,
              latestConfirmedSetup.c2,
              latestConfirmedSetup.c3,
              ...(latestConfirmedSetup.c4 ? [latestConfirmedSetup.c4] : [])
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
      } catch (cacheErr) {
        // Cache table might not exist or connection failed; ignore and proceed
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("Scanner-3C exception:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to run 3-candle breakout scanner"
    }, { status: 500 });
  }
}
