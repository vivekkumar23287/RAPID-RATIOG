import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NIFTY_50_STOCKS as RAW_SYMBOLS } from "@/lib/stocks";

export const dynamic = "force-dynamic";

// Filter out BTC so scanner strictly scans NSE Nifty 50 stocks
const SCAN_SYMBOLS = RAW_SYMBOLS.filter(s => s.symbol.toUpperCase() !== "BTC");

interface LiveSignal {
  id?: number | string;
  stock_symbol: string;
  stock_name: string;
  signal_type: "OPEN = HIGH ↓" | "OPEN = LOW ↑";
  direction: "UP" | "DOWN";
  timeframe: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  candle_time: string;
  candle_date: string;
  created_at: string;
}

let cachedSignals: LiveSignal[] = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 20000; // 20 seconds cache

function getISTParts(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const day = parts.find(p => p.type === "day")?.value || "01";
  const month = parts.find(p => p.type === "month")?.value || "01";
  const year = parts.find(p => p.type === "year")?.value || "2026";
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
  const dayPeriod = (parts.find(p => p.type === "dayPeriod")?.value || "AM").toUpperCase();

  let h24 = hour;
  if (dayPeriod === "PM" && h24 < 12) h24 += 12;
  if (dayPeriod === "AM" && h24 === 12) h24 = 0;

  const totalMinutes = h24 * 60 + minute;
  // Indian market hours: 09:15 AM (555 min) to 03:30 PM (930 min) IST
  const isMarketHours = totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;

  const dateStr = `${day}/${month}/${year}`;
  const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${dayPeriod}`;

  return { dateStr, timeStr, totalMinutes, isMarketHours, h24, minute };
}

function getISTTimeString(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date).toUpperCase();
}

const fetchYahoo15mChart = async (symbol: string) => {
  const upper = symbol.toUpperCase();
  const yahooSymbol = upper === "NIFTY50" || upper === "NIFTY" ? "^NSEI" : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=2d&interval=15m&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 15 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

async function scanLiveOpenHighLow(): Promise<LiveSignal[]> {
  const scannedSignals: LiveSignal[] = [];
  const chunkSize = 15;

  for (let i = 0; i < SCAN_SYMBOLS.length; i += chunkSize) {
    const chunk = SCAN_SYMBOLS.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (item) => {
        try {
          const raw = await fetchYahoo15mChart(item.symbol);
          const result = raw?.chart?.result?.[0];
          if (!result || !result.timestamp || result.timestamp.length === 0) return [];

          const timestamps: number[] = result.timestamp;
          const quote = result.indicators?.quote?.[0];
          if (!quote) return [];

          // Group valid completed and current candles that fall within market hours
          const validCandles: {
            timestamp: number;
            dateStr: string;
            timeStr: string;
            open: number;
            high: number;
            low: number;
            close: number;
          }[] = [];

          for (let idx = 0; idx < timestamps.length; idx++) {
            const ts = timestamps[idx];
            const o = quote.open?.[idx];
            const h = quote.high?.[idx];
            const l = quote.low?.[idx];
            const c = quote.close?.[idx];

            if (o == null || h == null || l == null || c == null) continue;

            const ist = getISTParts(ts);
            // Must fall strictly between 09:15 AM and 03:30 PM IST
            if (!ist.isMarketHours) continue;

            validCandles.push({
              timestamp: ts,
              dateStr: ist.dateStr,
              timeStr: ist.timeStr,
              open: Number(o.toFixed(2)),
              high: Number(h.toFixed(2)),
              low: Number(l.toFixed(2)),
              close: Number(c.toFixed(2)),
            });
          }

          if (validCandles.length === 0) return [];

          // Identify the most recent active trading date
          const latestDate = validCandles[validCandles.length - 1].dateStr;
          const sessionCandles = validCandles.filter(c => c.dateStr === latestDate);

          const stockSignals: LiveSignal[] = [];

          for (const candle of sessionCandles) {
            let signalType: "OPEN = HIGH ↓" | "OPEN = LOW ↑" | null = null;
            let direction: "UP" | "DOWN" | null = null;

            // RULE 1: Candle High == Open (within 2 paise tolerance for decimal pricing)
            if (Math.abs(candle.high - candle.open) < 0.02) {
              signalType = "OPEN = HIGH ↓";
              direction = "DOWN";
            }
            // RULE 2: Candle Low == Open (within 2 paise tolerance)
            else if (Math.abs(candle.low - candle.open) < 0.02) {
              signalType = "OPEN = LOW ↑";
              direction = "UP";
            }

            if (signalType && direction) {
              const candleEndTs = candle.timestamp + 15 * 60;
              const candleTimeEnd = getISTTimeString(candleEndTs);
              const candleTime = `${candle.timeStr} - ${candleTimeEnd}`;

              stockSignals.push({
                stock_symbol: item.symbol,
                stock_name: item.name,
                signal_type: signalType,
                direction: direction,
                timeframe: "15m",
                open_price: candle.open,
                high_price: candle.high,
                low_price: candle.low,
                close_price: candle.close,
                candle_time: candleTime,
                candle_date: candle.dateStr,
                created_at: new Date().toISOString(),
              });
            }
          }

          return stockSignals;
        } catch {
          return [];
        }
      })
    );

    for (const group of results) {
      if (group && group.length > 0) {
        scannedSignals.push(...group);
      }
    }
  }

  return scannedSignals;
}

export async function GET() {
  const now = Date.now();

  // Return cached result if fresh
  if (cachedSignals.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: cachedSignals,
      count: cachedSignals.length,
      timestamp: new Date().toISOString(),
      fromCache: true,
    });
  }

  // 1. Fetch any stored signals from DB
  let dbSignals: any[] = [];
  try {
    const rows = await sql`
      SELECT
        id,
        stock_symbol,
        stock_name,
        signal_type,
        direction,
        timeframe,
        open_price,
        high_price,
        low_price,
        close_price,
        candle_time,
        candle_date,
        created_at
      FROM signals_history
      WHERE signal_type LIKE 'OPEN = %'
      ORDER BY id DESC
      LIMIT 200
    `;
    if (rows && rows.length > 0) {
      dbSignals = rows;
    }
  } catch (error: any) {
    console.warn("Signals DB read warning:", error?.message);
  }

  // 2. Scan live candles from Yahoo Finance across 09:15 AM to 03:30 PM IST
  let liveSignals: LiveSignal[] = [];
  try {
    liveSignals = await scanLiveOpenHighLow();
  } catch (liveErr: any) {
    console.warn("Live Open=High scanner warning:", liveErr?.message);
  }

  // 3. Merge live signals with DB signals, deduplicating by symbol, date, time, and signal_type
  const seenKeys = new Set<string>();
  const mergedSignals: LiveSignal[] = [];

  // Add live signals first (latest real-time data)
  for (const s of liveSignals) {
    const key = `${s.stock_symbol}_${s.candle_date}_${s.candle_time}_${s.signal_type}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedSignals.push(s);
    }
  }

  // Add stored DB signals
  for (const r of dbSignals) {
    const key = `${r.stock_symbol}_${r.candle_date}_${r.candle_time}_${r.signal_type}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedSignals.push({
        id: r.id,
        stock_symbol: r.stock_symbol,
        stock_name: r.stock_name,
        signal_type: r.signal_type,
        direction: r.direction,
        timeframe: r.timeframe || "15m",
        open_price: Number(r.open_price),
        high_price: Number(r.high_price),
        low_price: Number(r.low_price),
        close_price: Number(r.close_price),
        candle_time: r.candle_time,
        candle_date: r.candle_date,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      });
    }
  }

  // If live and DB both succeeded, optionally persist new live signals to DB in background
  if (liveSignals.length > 0) {
    (async () => {
      try {
        for (const s of liveSignals) {
          await sql`
            INSERT INTO signals_history (
              stock_symbol, stock_name, signal_type, direction, timeframe,
              open_price, high_price, low_price, close_price, candle_time, candle_date
            ) VALUES (
              ${s.stock_symbol}, ${s.stock_name}, ${s.signal_type}, ${s.direction}, ${s.timeframe},
              ${s.open_price}, ${s.high_price}, ${s.low_price}, ${s.close_price}, ${s.candle_time}, ${s.candle_date}
            )
          `;
        }
      } catch {
        // Silently skip if DB insert errors or DB is offline
      }
    })();
  }

  const resultList = mergedSignals.length > 0 ? mergedSignals : cachedSignals;

  if (resultList.length > 0) {
    cachedSignals = resultList;
    lastCacheTime = now;
  }

  return NextResponse.json({
    success: true,
    data: resultList,
    count: resultList.length,
    timestamp: new Date().toISOString(),
  });
}
