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

// Wilder's RSI calculation with customizable period (default: 23)
function calculateWilderRSI(candles: Candle[], period: number = 23): { rsi: number; candle: Candle }[] {
  if (candles.length <= period) return [];
  const result: { rsi: number; candle: Candle }[] = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    result.push({
      rsi: parseFloat(rsi.toFixed(2)),
      candle: candles[i]
    });
  }

  return result;
}

// Calculate RSI-based Moving Average (default: 14 length)
function calculateRSIMA(
  rsiSeries: { rsi: number; candle: Candle }[],
  length: number = 14
): { rsi: number; ma: number; candle: Candle }[] {
  if (rsiSeries.length === 0) return [];
  const result = [];
  for (let i = 0; i < rsiSeries.length; i++) {
    if (i < length - 1) {
      result.push({
        rsi: rsiSeries[i].rsi,
        ma: rsiSeries[i].rsi,
        candle: rsiSeries[i].candle
      });
    } else {
      let sum = 0;
      for (let j = i - length + 1; j <= i; j++) {
        sum += rsiSeries[j].rsi;
      }
      result.push({
        rsi: rsiSeries[i].rsi,
        ma: parseFloat((sum / length).toFixed(2)),
        candle: rsiSeries[i].candle
      });
    }
  }
  return result;
}

// Aggregate 15m candles into 1-Hour candles for higher timeframe confirmation
function aggregateTo1HourCandles(candles15m: Candle[]): Candle[] {
  if (!candles15m || candles15m.length === 0) return [];
  const hourBuckets: { [key: string]: Candle[] } = {};

  candles15m.forEach(c => {
    const dt = new Date(c.timestamp * 1000);
    const dateStr = c.dateString;
    // Bucket into hourly intervals
    const istHours = dt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false });
    const key = `${dateStr}_${istHours}`;
    if (!hourBuckets[key]) hourBuckets[key] = [];
    hourBuckets[key].push(c);
  });

  const hourCandles: Candle[] = [];
  Object.keys(hourBuckets).forEach(key => {
    const list = hourBuckets[key];
    if (list.length === 0) return;
    const open = list[0].open;
    const close = list[list.length - 1].close;
    const high = Math.max(...list.map(x => x.high));
    const low = Math.min(...list.map(x => x.low));
    const volume = list.reduce((acc, x) => acc + x.volume, 0);
    hourCandles.push({
      open,
      high,
      low,
      close,
      volume,
      timestamp: list[0].timestamp,
      dateString: list[0].dateString,
      timeString: list[0].timeString
    });
  });

  return hourCandles.sort((a, b) => a.timestamp - b.timestamp);
}

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    const now = new Date();
    const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowISTString);
    const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, '0')}-${nowIST.getDate().toString().padStart(2, '0')}`;

    const { searchParams } = new URL(req.url);
    const singleSymbol = searchParams.get("symbol");
    const forceSync = searchParams.get("sync") === "true";

    const isMarketOpen =
      nowIST.getDay() >= 1 &&
      nowIST.getDay() <= 5 &&
      ((nowIST.getHours() === 9 && nowIST.getMinutes() >= 15) || (nowIST.getHours() > 9 && nowIST.getHours() < 15) || (nowIST.getHours() === 15 && nowIST.getMinutes() <= 35));

    // Check DB cache if not market open and not force sync
    if (!singleSymbol && !isMarketOpen && !forceSync) {
      try {
        const cached = await sql`SELECT results FROM scanner_cache WHERE date_str = ${dateStr} AND scanner_type = 'scanner-rsi'`;
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
    const allStockRsiData: any[] = [];
    const confirmed1HMatches: any[] = [];
    const breakout15MMatches: any[] = [];

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

          const validCandles: Candle[] = [];

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

              validCandles.push({
                open: parseFloat(o.toFixed(2)),
                high: parseFloat(h.toFixed(2)),
                low: parseFloat(l.toFixed(2)),
                close: parseFloat(c.toFixed(2)),
                volume: v,
                timestamp: ts,
                dateString,
                timeString
              });
            }
          });

          if (validCandles.length < 25) return null;

          validCandles.sort((a, b) => a.timestamp - b.timestamp);

          // 1. Calculate 15M RSI (period 23) & MA (length 14)
          const rsi15mSeries = calculateWilderRSI(validCandles, 23);
          if (rsi15mSeries.length === 0) return null;

          const rsi15mWithMA = calculateRSIMA(rsi15mSeries, 14);
          const latestPoint = rsi15mWithMA[rsi15mWithMA.length - 1];
          const prevPoint = rsi15mWithMA.length > 1 ? rsi15mWithMA[rsi15mWithMA.length - 2] : latestPoint;

          const latestRsi = latestPoint.rsi; // Yellow line
          const latestMa = latestPoint.ma;   // Green line
          const prevRsi = prevPoint.rsi;
          const latestCandle = latestPoint.candle;

          // 2. Calculate 1-Hour RSI (period 23)
          const hourCandles = aggregateTo1HourCandles(validCandles);
          const rsi1hSeries = calculateWilderRSI(hourCandles, 23);
          const latestRsi1H = rsi1hSeries.length > 0 ? rsi1hSeries[rsi1hSeries.length - 1].rsi : latestRsi;

          const currentPrice = meta.regularMarketPrice ?? latestCandle.close;
          const changePercent = meta.regularMarketChangePercent ?? 0;

          // Strategy Criteria:
          // Yellow line (RSI 23) crosses or holds above 60
          const isCrossAbove60 = latestRsi >= 60;
          const isAboveMA = latestRsi >= latestMa;
          const is1HConfirmed = latestRsi1H >= 60;
          const isFreshCross = prevRsi < 60 && latestRsi >= 60;

          let signalType = "NEUTRAL";
          let direction = "NEUTRAL";
          let statusDescription = "RSI Normal Range (< 60)";
          let setupTag = "NONE";

          if (isCrossAbove60 && is1HConfirmed) {
            signalType = "RSI 60 BREAKOUT (1H CONFIRMED)";
            direction = "UP";
            statusDescription = "Strong Upside Confirmed: 15M (>60) and 1H (>60) Aligned";
            setupTag = "1H_CONFIRMED";
          } else if (isCrossAbove60) {
            signalType = "RSI 60 BREAKOUT (15M)";
            direction = "UP";
            statusDescription = "15M Bullish Momentum: Yellow RSI crossed above 60";
            setupTag = "15M_BREAKOUT";
          } else if (latestRsi >= 55) {
            signalType = "RSI APPROACHING 60";
            direction = "UP";
            statusDescription = "Approaching 60 Bullish Trigger Zone";
            setupTag = "NEAR_60";
          } else if (latestRsi <= 40) {
            signalType = "RSI WEAK (< 40)";
            direction = "DOWN";
            statusDescription = "Bearish / Sub-40 Weak Momentum";
            setupTag = "BEARISH";
          }

          const stockResult = {
            symbol: item.symbol,
            name: item.name,
            sector: item.sector || "Nifty 50",
            currentPrice,
            changePercent,
            rsi: latestRsi,       // Yellow line value
            ma: latestMa,         // Green line value
            rsi1h: latestRsi1H,   // 1-Hour RSI value
            prevRsi,
            rsiTrend: latestRsi >= prevRsi ? "RISING" : "FALLING",
            isCrossAbove60,
            isAboveMA,
            is1HConfirmed,
            isFreshCross,
            signalType,
            direction,
            statusDescription,
            setupTag,
            timeDetected: latestCandle.timeString,
            dateDetected: latestCandle.dateString,
            candle: latestCandle
          };

          return stockResult;
        } catch (err) {
          console.error(`Error processing RSI for ${item.symbol}:`, err);
          return null;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      chunkResults.forEach(res => {
        if (!res) return;
        allStockRsiData.push(res);
        if (res.isCrossAbove60) {
          if (res.is1HConfirmed) {
            confirmed1HMatches.push(res);
          } else {
            breakout15MMatches.push(res);
          }
        }
      });
    }

    // Sort: 1H confirmed first, then by highest RSI
    confirmed1HMatches.sort((a, b) => b.rsi - a.rsi);
    breakout15MMatches.sort((a, b) => b.rsi - a.rsi);

    const matches = [...confirmed1HMatches, ...breakout15MMatches];

    const responsePayload = {
      success: true,
      strategy: {
        name: "RSI 60 Bullish Momentum Breakout",
        rsiLength: 23,
        maLength: 14,
        rsiColor: "Yellow (#FACC15)",
        maColor: "Green (#22C55E)",
        triggerLevel: 60,
        confirmationTimeframe: "1-Hour (1H)"
      },
      matchesCount: matches.length,
      confirmed1HCount: confirmed1HMatches.length,
      breakout15MCount: breakout15MMatches.length,
      matches,
      confirmed1H: confirmed1HMatches,
      breakouts15M: breakout15MMatches,
      allStocks: allStockRsiData.sort((a, b) => b.rsi - a.rsi),
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime
    };

    // Cache results in DB if market is closed or on weekend
    if (!singleSymbol && !isMarketOpen) {
      try {
        await sql`
          INSERT INTO scanner_cache (date_str, scanner_type, results)
          VALUES (${dateStr}, 'scanner-rsi', ${JSON.stringify(responsePayload)})
          ON CONFLICT (date_str, scanner_type)
          DO UPDATE SET results = EXCLUDED.results, created_at = CURRENT_TIMESTAMP
        `;
      } catch (cacheErr) {
        console.warn("RSI Scanner Cache save error:", cacheErr);
      }
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("RSI Scanner error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to scan RSI" },
      { status: 500 }
    );
  }
}
