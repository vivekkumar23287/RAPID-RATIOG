import { NextResponse } from "next/server";
import { getSavedScannerFromDB, saveScannerToDB } from "@/lib/server-scanner-cache";
import { NIFTY_50_STOCKS } from "@/lib/stocks";

export const dynamic = "force-dynamic";

// Filter strictly to the 50 official Nifty 50 companies (exclude crypto and index)
const SCANNER_STOCKS = NIFTY_50_STOCKS.filter(
  (s) => s.symbol !== "NIFTY50" && s.symbol !== "BTC" && s.symbol !== "BTC-USD"
);

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  hour: number;
  minute: number;
}

/**
 * Returns current Indian Standard Time (IST) details
 */
function getISTNow() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short"
  });

  const parts = istFormatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = parseInt(map.hour || "0", 10);
  const minute = parseInt(map.minute || "0", 10);
  const totalMinutes = hour * 60 + minute;
  const isWeekday = map.weekday !== "Sat" && map.weekday !== "Sun";
  // 9:31 AM IST is 9 * 60 + 31 = 571 minutes from midnight
  const isPast931 = totalMinutes >= 571;

  return { dateStr, hour, minute, totalMinutes, isWeekday, isPast931, rawDate: now };
}

/**
 * Parse timestamp to IST date string and time parts
 */
function parseISTTimestamp(tsSec: number) {
  const d = new Date(tsSec * 1000);
  const istDateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const istTimeStr = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }); // HH:MM:SS
  const [hour, minute] = istTimeStr.split(":").map(Number);
  return { dateStr: istDateStr, hour, minute };
}

/**
 * Fetch 15-minute candles over a 5-day window from Yahoo Finance
 */
const fetchStock15m = async (symbol: string) => {
  const encodedSymbol = encodeURIComponent(`${symbol}.NS`);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=5d&interval=15m`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      next: { revalidate: 30 }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

/**
 * Helper to process array in batches
 */
async function processBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

export async function GET() {
  try {
    const istNow = getISTNow();

    // 1. Detection Time Rule:
    // On active trading weekdays before 9:31 AM IST, the first 15-minute candle (9:15-9:30 AM) is incomplete.
    // Do not generate or display final gap signals before 9:31 AM IST.
    if (istNow.isWeekday && !istNow.isPast931) {
      // Serve previously saved confirmed data from DB if available
      const previousConfirmed = await getSavedScannerFromDB("nse-gaps");
      if (previousConfirmed && (previousConfirmed.gapUps || previousConfirmed.gapDowns)) {
        return NextResponse.json({
          ...previousConfirmed,
          status: "Waiting for today's first 15-minute candle to close (09:31 AM IST)"
        });
      }
      return NextResponse.json({
        gapUps: [],
        gapDowns: [],
        status: "Waiting for today's first 15-minute candle to close (09:31 AM IST)",
        timestamp: istNow.rawDate.toISOString()
      });
    }

    // 2. Fast Path: Immediately serve saved pre-calculated results from database (<20ms, zero website calculation)
    const savedData = await getSavedScannerFromDB("nse-gaps", istNow.dateStr);
    if (savedData && (savedData.gapUps || savedData.gapDowns)) {
      return NextResponse.json(savedData);
    }

    // 3. Scan all 50 Nifty 50 stocks in batches of 10
    const rawResults = await processBatches(SCANNER_STOCKS, 10, async (item) => {
      try {
        const data = await fetchStock15m(item.symbol);
        const chartResult = data?.chart?.result?.[0];
        if (!chartResult) return null;

        const meta = chartResult.meta;
        const timestamps: number[] = chartResult.timestamp || [];
        const quote = chartResult.indicators?.quote?.[0];
        if (!quote || timestamps.length === 0) return null;

        // Group 15-minute candles by IST date
        const candleGroups: Record<string, CandleData[]> = {};

        timestamps.forEach((ts, idx) => {
          const o = quote.open?.[idx];
          const h = quote.high?.[idx];
          const l = quote.low?.[idx];
          const c = quote.close?.[idx];

          if (
            typeof o === "number" && typeof h === "number" &&
            typeof l === "number" && typeof c === "number" &&
            !isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c) &&
            o > 0 && h > 0 && l > 0 && c > 0
          ) {
            const { dateStr, hour, minute } = parseISTTimestamp(ts);
            if (!candleGroups[dateStr]) {
              candleGroups[dateStr] = [];
            }
            candleGroups[dateStr].push({
              open: o,
              high: h,
              low: l,
              close: c,
              timestamp: ts,
              hour,
              minute
            });
          }
        });

        // Sort session dates descending (e.g. ['2026-11-23', '2026-11-20', '2026-11-19'])
        const sortedDates = Object.keys(candleGroups).sort().reverse();
        if (sortedDates.length < 2) return null;

        const targetSessionDate = sortedDates[0];
        const prevTradingSessionDate = sortedDates[1];

        const targetCandles = candleGroups[targetSessionDate] || [];
        const prevSessionCandles = candleGroups[prevTradingSessionDate] || [];

        if (targetCandles.length === 0 || prevSessionCandles.length === 0) return null;

        // Previous Trading Session HIGH and LOW (handles weekends and holidays naturally)
        const prevHigh = Math.max(...prevSessionCandles.map(c => c.high));
        const prevLow = Math.min(...prevSessionCandles.map(c => c.low));

        if (!isFinite(prevHigh) || !isFinite(prevLow) || prevHigh <= 0 || prevLow <= 0) return null;

        // Find today's / target session's first 15-minute completed candle (9:15 AM - 9:30 AM IST)
        const firstCandle = targetCandles.find(c => c.hour === 9 && c.minute === 15) || targetCandles[0];
        if (!firstCandle) return null;

        // Strict inequalities:
        // GAP UP: Today's First 15-Min Candle LOW > Previous Trading Day HIGH
        // GAP DOWN: Today's First 15-Min Candle HIGH < Previous Trading Day LOW
        // Equality strictly does NOT qualify as a gap
        const isGapUp = firstCandle.low > prevHigh;
        const isGapDown = firstCandle.high < prevLow;

        // Stock cannot qualify if NO GAP
        if (!isGapUp && !isGapDown) {
          return null;
        }

        const currentPrice = meta.regularMarketPrice ?? firstCandle.close;
        const changePercent = meta.regularMarketChangePercent ?? 0;

        let gapPercent = 0;
        if (isGapUp) {
          gapPercent = Math.abs(((firstCandle.open - prevHigh) / prevHigh) * 100);
        } else if (isGapDown) {
          gapPercent = Math.abs(((prevLow - firstCandle.open) / prevLow) * 100);
        }

        return {
          symbol: item.symbol,
          name: item.name,
          price: currentPrice,
          changePercent,
          gapPercent,
          isGapUp,
          isGapDown,
          firstCandleLow: firstCandle.low,
          firstCandleHigh: firstCandle.high,
          prevHigh,
          prevLow,
          sessionDate: targetSessionDate,
          prevDate: prevTradingSessionDate
        };
      } catch (e) {
        console.error(`Error processing ${item.symbol}:`, e);
        return null;
      }
    });

    const processedStocks = rawResults.filter((s): s is NonNullable<typeof s> => s !== null);

    // Deduplicate by symbol
    const seenSymbols = new Set<string>();
    const uniqueStocks: typeof processedStocks = [];
    for (const stock of processedStocks) {
      if (!seenSymbols.has(stock.symbol)) {
        seenSymbols.add(stock.symbol);
        uniqueStocks.push(stock);
      }
    }

    const gapUps = uniqueStocks
      .filter(s => s.isGapUp)
      .sort((a, b) => b.gapPercent - a.gapPercent);

    const gapDowns = uniqueStocks
      .filter(s => s.isGapDown)
      .sort((a, b) => b.gapPercent - a.gapPercent);

    const responsePayload = {
      gapUps,
      gapDowns,
      totalScanned: SCANNER_STOCKS.length,
      timestamp: new Date().toISOString()
    };

    // Save pre-calculated results in database for instant future retrieval (<20ms load)
    await saveScannerToDB("nse-gaps", istNow.dateStr, responsePayload);

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("NSE Gaps calculations exception:", error);
    return NextResponse.json({
      gapUps: [],
      gapDowns: [],
      timestamp: new Date().toISOString(),
      error: "Failed to calculate gaps"
    }, { status: 500 });
  }
}
