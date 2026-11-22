/**
 * scanner-service.ts
 *
 * Unified Background Scanner Engine for NSE Tricks.
 *
 * Implements:
 *   1. Trick 1: True Gap Scanner (Gap Up / Gap Down)
 *   2. Trick 2: 5-Candle Mother Range Setup
 *   3. Trick 3: 15-Minute 3-Candle Bullish Breakout Setup
 *   4. Trick 4: Live 15-Min Open=High (Bearish) & Open=Low (Bullish) Signals
 *   5. Trick 5: RSI 60 Bullish Momentum Breakout (15M with 1H Confirmation)
 *
 * Architecture:
 *   - Heavy market data fetching and pattern math happen in the background.
 *   - Completed results are stored in Neon PostgreSQL (table: scanner_cache).
 *   - The Tricks page opens instantly by reading pre-calculated data in < 30ms.
 */

import { sql } from "./db";
import { NIFTY_50_STOCKS as RAW_SYMBOLS } from "./stocks";

// Filter out BTC so scanner strictly scans NSE stocks and NIFTY50 index
const SCAN_SYMBOLS = RAW_SYMBOLS.filter((s) => s.symbol.toUpperCase() !== "BTC");

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  dateString: string;
  timeString: string;
}

export interface LiveSignal {
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

export interface AllTricksResult {
  success: boolean;
  gaps: {
    gapUps: any[];
    gapDowns: any[];
    timestamp: string;
    message?: string;
  };
  motherRange: {
    matches: any[];
    matchesCount: number;
    scannedCount: number;
    timestamp: string;
  };
  breakouts: {
    matches: any[];
    matchesCount: number;
    scannedCount: number;
    timestamp: string;
  };
  rsi: {
    matches: any[];
    confirmed1H: any[];
    breakouts15M: any[];
    allStocks?: any[];
    matchesCount: number;
    confirmed1HCount: number;
    breakout15MCount: number;
    timestamp: string;
  };
  signals: LiveSignal[];
  lastUpdated: string;
  durationMs: number;
}

// ── In-Memory Server Cache for Ultra-Fast API Responses ─────────────────────────
let memoryCache: { data: AllTricksResult; cachedAt: number } | null = null;
const MEMORY_CACHE_TTL_MS = 25000; // 25 seconds in-memory cache

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getISTNow(): { nowIST: Date; dateStr: string; timeStr: string; isMarketHours: boolean } {
  const now = new Date();
  const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const nowIST = new Date(nowISTString);
  const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, "0")}-${nowIST.getDate().toString().padStart(2, "0")}`;
  const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

  const day = nowIST.getDay();
  const hour = nowIST.getHours();
  const minute = nowIST.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  const totalMinutes = hour * 60 + minute;
  const isMarketHours = isWeekday && totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 35;

  return { nowIST, dateStr, timeStr, isMarketHours };
}

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

  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value || "AM").toUpperCase();

  let h24 = hour;
  if (dayPeriod === "PM" && h24 < 12) h24 += 12;
  if (dayPeriod === "AM" && h24 === 12) h24 = 0;

  const totalMinutes = h24 * 60 + minute;
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

// ── Wilder's RSI Calculation ──────────────────────────────────────────────────
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
      candle: candles[i],
    });
  }

  return result;
}

// ── RSI-Based Moving Average ──────────────────────────────────────────────────
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
        candle: rsiSeries[i].candle,
      });
    } else {
      let sum = 0;
      for (let j = i - length + 1; j <= i; j++) {
        sum += rsiSeries[j].rsi;
      }
      result.push({
        rsi: rsiSeries[i].rsi,
        ma: parseFloat((sum / length).toFixed(2)),
        candle: rsiSeries[i].candle,
      });
    }
  }
  return result;
}

// ── Aggregate 15m Candles to 1-Hour Candles ──────────────────────────────────
function aggregateTo1HourCandles(candles15m: Candle[]): Candle[] {
  if (!candles15m || candles15m.length === 0) return [];
  const hourBuckets: { [key: string]: Candle[] } = {};

  candles15m.forEach((c) => {
    const dt = new Date(c.timestamp * 1000);
    const dateStr = c.dateString;
    const istHours = dt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false });
    const key = `${dateStr}_${istHours}`;
    if (!hourBuckets[key]) hourBuckets[key] = [];
    hourBuckets[key].push(c);
  });

  const hourCandles: Candle[] = [];
  Object.keys(hourBuckets).forEach((key) => {
    const list = hourBuckets[key];
    if (list.length === 0) return;
    const open = list[0].open;
    const close = list[list.length - 1].close;
    const high = Math.max(...list.map((x) => x.high));
    const low = Math.min(...list.map((x) => x.low));
    const volume = list.reduce((acc, x) => acc + x.volume, 0);
    hourCandles.push({
      open,
      high,
      low,
      close,
      volume,
      timestamp: list[0].timestamp,
      dateString: list[0].dateString,
      timeString: list[0].timeString,
    });
  });

  return hourCandles.sort((a, b) => a.timestamp - b.timestamp);
}

// ── Fetch 15m Candles from Yahoo Finance with Timeout ─────────────────────────
async function fetchYahoo15mCandles(symbol: string, range: string = "5d"): Promise<any> {
  const upper = symbol.toUpperCase();
  const yahooSymbol = upper === "NIFTY50" || upper === "NIFTY" ? "^NSEI" : `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=15m&includePrePost=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 15 },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ── Parse Yahoo Candle Data ───────────────────────────────────────────────────
interface ParsedStockData {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  changePercent: number;
  candles: Candle[];
  completedCandles: Candle[];
  candleGroupsByDate: { [date: string]: Candle[] };
  sortedDates: string[];
}

function parseYahooChart(symbolInfo: { symbol: string; name: string; sector?: string }, rawData: any, nowTs: number): ParsedStockData | null {
  const result = rawData?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta;
  const timestamps: number[] = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return null;

  const candles: Candle[] = [];
  const candleGroupsByDate: { [date: string]: Candle[] } = {};

  timestamps.forEach((ts: number, index: number) => {
    const o = quote.open?.[index];
    const h = quote.high?.[index];
    const l = quote.low?.[index];
    const c = quote.close?.[index];
    const v = quote.volume?.[index] || 0;

    if (o != null && h != null && l != null && c != null) {
      const candleDate = new Date(ts * 1000);
      const dateString = candleDate
        .toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/-/g, "/");

      const timeString = candleDate
        .toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toUpperCase();

      const candle: Candle = {
        open: parseFloat(o.toFixed(2)),
        high: parseFloat(h.toFixed(2)),
        low: parseFloat(l.toFixed(2)),
        close: parseFloat(c.toFixed(2)),
        volume: v,
        timestamp: ts,
        dateString,
        timeString,
      };

      candles.push(candle);

      if (!candleGroupsByDate[dateString]) {
        candleGroupsByDate[dateString] = [];
      }
      candleGroupsByDate[dateString].push(candle);
    }
  });

  if (candles.length === 0) return null;

  const sortedDates = Object.keys(candleGroupsByDate).sort((a, b) => {
    const [dayA, monthA, yearA] = a.split("/").map(Number);
    const [dayB, monthB, yearB] = b.split("/").map(Number);
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
  });

  const completedCandles = candles.filter((c) => nowTs >= c.timestamp + 15 * 60);
  const currentPrice = meta.regularMarketPrice ?? candles[candles.length - 1].close;
  const changePercent = meta.regularMarketChangePercent ?? 0;

  return {
    symbol: symbolInfo.symbol,
    name: symbolInfo.name,
    sector: symbolInfo.sector || "Nifty 50",
    currentPrice,
    changePercent,
    candles,
    completedCandles,
    candleGroupsByDate,
    sortedDates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN SCANNERS
// ─────────────────────────────────────────────────────────────────────────────

// ── Trick 1: True Gap Scanner (Gap Up / Gap Down) ────────────────────────────
function calculateTrick1Gaps(parsedStocks: ParsedStockData[]): { gapUps: any[]; gapDowns: any[] } {
  const gapUps: any[] = [];
  const gapDowns: any[] = [];

  for (const item of parsedStocks) {
    if (item.symbol === "NIFTY50") continue;
    if (item.sortedDates.length < 2) continue;

    const todayDate = item.sortedDates[item.sortedDates.length - 1];
    const yesterdayDate = item.sortedDates[item.sortedDates.length - 2];

    const todayCandles = item.candleGroupsByDate[todayDate] || [];
    const yesterdayCandles = item.candleGroupsByDate[yesterdayDate] || [];
    if (todayCandles.length === 0 || yesterdayCandles.length === 0) continue;

    const yesterdayHigh = Math.max(...yesterdayCandles.map((c) => c.high));
    const yesterdayLow = Math.min(...yesterdayCandles.map((c) => c.low));
    if (!isFinite(yesterdayHigh) || !isFinite(yesterdayLow)) continue;

    const firstCandle = todayCandles[0];
    if (!firstCandle) continue;

    const isGapUp = firstCandle.low > yesterdayHigh;
    const isGapDown = firstCandle.high < yesterdayLow;

    let gapPercent = 0;
    if (isGapUp) {
      gapPercent = ((firstCandle.open - yesterdayHigh) / yesterdayHigh) * 100;
      gapUps.push({
        symbol: item.symbol,
        name: item.name,
        price: item.currentPrice,
        changePercent: item.changePercent,
        gapPercent: Math.abs(parseFloat(gapPercent.toFixed(2))),
        isGapUp: true,
        isGapDown: false,
      });
    } else if (isGapDown) {
      gapPercent = ((firstCandle.open - yesterdayLow) / yesterdayLow) * 100;
      gapDowns.push({
        symbol: item.symbol,
        name: item.name,
        price: item.currentPrice,
        changePercent: item.changePercent,
        gapPercent: Math.abs(parseFloat(gapPercent.toFixed(2))),
        isGapUp: false,
        isGapDown: true,
      });
    }
  }

  gapUps.sort((a, b) => b.gapPercent - a.gapPercent);
  gapDowns.sort((a, b) => b.gapPercent - a.gapPercent);

  return { gapUps, gapDowns };
}

// ── Trick 2: 5-Candle Mother Range Setup ─────────────────────────────────────
function calculateTrick2MotherRange(parsedStocks: ParsedStockData[]): any[] {
  const matches: any[] = [];

  for (const item of parsedStocks) {
    if (item.sortedDates.length < 2) continue;

    let todayIndex = -1;
    for (let d = item.sortedDates.length - 1; d >= 0; d--) {
      const dStr = item.sortedDates[d];
      if (item.candleGroupsByDate[dStr]?.length >= 3 && d >= 1) {
        const prevDStr = item.sortedDates[d - 1];
        if (item.candleGroupsByDate[prevDStr]?.length >= 2) {
          todayIndex = d;
          break;
        }
      }
    }
    if (todayIndex === -1) continue;

    const todayDate = item.sortedDates[todayIndex];
    const yesterdayDate = item.sortedDates[todayIndex - 1];

    const todayCandles = [...(item.candleGroupsByDate[todayDate] || [])].sort((a, b) => a.timestamp - b.timestamp);
    const yesterdayCandles = [...(item.candleGroupsByDate[yesterdayDate] || [])].sort((a, b) => a.timestamp - b.timestamp);

    const C1 = yesterdayCandles[yesterdayCandles.length - 2];
    const C2 = yesterdayCandles[yesterdayCandles.length - 1];
    const C3 = todayCandles[0];
    const C4 = todayCandles[1];
    const C5 = todayCandles[2];

    if (!C1 || !C2 || !C3 || !C4 || !C5) continue;

    const isHighSatisfied = C1.high < C3.high && C2.high < C3.high && C4.high < C3.high && C5.high < C3.high;
    const isLowSatisfied = C1.low > C3.low && C2.low > C3.low && C4.low > C3.low && C5.low > C3.low;
    const isSetupMatched = isHighSatisfied && isLowSatisfied;

    if (isSetupMatched) {
      matches.push({
        symbol: item.symbol,
        name: item.name,
        currentPrice: item.currentPrice,
        changePercent: item.changePercent,
        isSetupMatched: true,
        dateDetected: todayDate,
        timeDetected: "10:00 AM (IST)",
        totalVolume: todayCandles.reduce((sum, c) => sum + c.volume, 0),
        candles: [C1, C2, C3, C4, C5],
        motherCandleRange: {
          high: C3.high,
          low: C3.low,
          open: C3.open,
          close: C3.close,
        },
      });
    }
  }

  return matches.sort((a, b) => b.changePercent - a.changePercent);
}

// ── Trick 3: 15-Minute 3-Candle Bullish Breakout Setup ───────────────────────
function calculateTrick3Breakouts(parsedStocks: ParsedStockData[], nowTs: number): any[] {
  const matches: any[] = [];

  for (const item of parsedStocks) {
    if (item.sortedDates.length === 0) continue;
    const latestDate = item.sortedDates[item.sortedDates.length - 1];
    const sessionCandles = (item.candleGroupsByDate[latestDate] || []).sort((a, b) => a.timestamp - b.timestamp);
    if (sessionCandles.length < 3) continue;

    const allCandlesByTs = new Map<number, Candle>();
    item.candles.forEach((c) => allCandlesByTs.set(c.timestamp, c));

    let latestConfirmedSetup: any = null;

    for (let idx = 0; idx <= sessionCandles.length - 3; idx++) {
      const c1 = sessionCandles[idx];
      const c2 = sessionCandles[idx + 1];
      const c3 = sessionCandles[idx + 2];

      // 1. C1 must be RED (close < open)
      if (c1.close >= c1.open) continue;

      // 2. C2 must be GREEN and HIGH > c1.high
      if (c2.close <= c2.open || c2.high <= c1.high) continue;

      // 3. C3 must be GREEN and HIGH > c2.high
      if (c3.close <= c3.open || c3.high <= c2.high) continue;

      // 4. Candle 4 verification
      const c4StartTs = c3.timestamp + 15 * 60;
      const elapsedSec = nowTs - c4StartTs;
      const c4Candle = allCandlesByTs.get(c4StartTs);
      const isCompletedPastCandle = c4Candle != null && nowTs >= c4StartTs + 15 * 60;

      // In-progress candle must have elapsed at least 5 minutes
      if (!isCompletedPastCandle && elapsedSec < 5 * 60) {
        continue;
      }

      const c4Open = c4Candle ? c4Candle.open : c3.close;
      const c4CurrentPrice = c4Candle ? c4Candle.close : item.currentPrice;
      const isC4Green = c4CurrentPrice > c4Open;

      if (!isC4Green) continue;

      const c4StartDate = new Date(c4StartTs * 1000);
      const c4StartTimeStr = c4StartDate
        .toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toUpperCase();

      const c4EndDate = new Date((c4StartTs + 15 * 60) * 1000);
      const c4EndTimeStr = c4EndDate
        .toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toUpperCase();

      latestConfirmedSetup = {
        c1,
        c2,
        c3,
        c4: c4Candle || null,
        c4StartTs,
        candleTime: `${c4StartTimeStr} - ${c4EndTimeStr}`,
        candleDate: latestDate,
        confirmationTime: c4StartTimeStr,
        referenceRange: { high: c1.high, low: c1.low },
        breakoutLevels: { c2High: c2.high, c3High: c3.high },
        triggerPrice: c4CurrentPrice,
      };
    }

    if (latestConfirmedSetup) {
      matches.push({
        symbol: item.symbol,
        name: item.name,
        signal_type: "3-CANDLE BUY BREAKOUT",
        direction: "UP",
        timeframe: "15m",
        currentPrice: item.currentPrice,
        changePercent: item.changePercent,
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
          ...(latestConfirmedSetup.c4 ? [latestConfirmedSetup.c4] : []),
        ],
      });
    }
  }

  return matches.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
}

// ── Trick 4: Live 15-Min Open=High & Open=Low Signals ────────────────────────
function calculateTrick4Signals(parsedStocks: ParsedStockData[]): LiveSignal[] {
  const signals: LiveSignal[] = [];

  for (const item of parsedStocks) {
    if (item.symbol === "NIFTY50") continue;
    if (item.sortedDates.length === 0) continue;

    const latestDate = item.sortedDates[item.sortedDates.length - 1];
    const sessionCandles = item.candleGroupsByDate[latestDate] || [];

    for (const candle of sessionCandles) {
      const ist = getISTParts(candle.timestamp);
      if (!ist.isMarketHours) continue;

      let signalType: "OPEN = HIGH ↓" | "OPEN = LOW ↑" | null = null;
      let direction: "UP" | "DOWN" | null = null;

      if (Math.abs(candle.high - candle.open) < 0.02) {
        signalType = "OPEN = HIGH ↓";
        direction = "DOWN";
      } else if (Math.abs(candle.low - candle.open) < 0.02) {
        signalType = "OPEN = LOW ↑";
        direction = "UP";
      }

      if (signalType && direction) {
        const candleEndTs = candle.timestamp + 15 * 60;
        const candleTimeEnd = getISTTimeString(candleEndTs);
        const candleTime = `${candle.timeString} - ${candleTimeEnd}`;

        signals.push({
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
          candle_date: ist.dateStr,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  return signals.sort((a, b) => (b.id ? Number(b.id) : 0) - (a.id ? Number(a.id) : 0));
}

// ── Trick 5: RSI 60 Bullish Momentum Breakout Scanner ───────────────────────
function calculateTrick5RSI(parsedStocks: ParsedStockData[]): {
  matches: any[];
  confirmed1H: any[];
  breakouts15M: any[];
  allStocks: any[];
} {
  const confirmed1H: any[] = [];
  const breakouts15M: any[] = [];
  const allStocks: any[] = [];

  for (const item of parsedStocks) {
    if (item.candles.length < 25) continue;

    const rsi15mSeries = calculateWilderRSI(item.candles, 23);
    if (rsi15mSeries.length === 0) continue;

    const rsi15mWithMA = calculateRSIMA(rsi15mSeries, 14);
    const latestPoint = rsi15mWithMA[rsi15mWithMA.length - 1];
    const prevPoint = rsi15mWithMA.length > 1 ? rsi15mWithMA[rsi15mWithMA.length - 2] : latestPoint;

    const latestRsi = latestPoint.rsi;
    const latestMa = latestPoint.ma;
    const prevRsi = prevPoint.rsi;
    const latestCandle = latestPoint.candle;

    const hourCandles = aggregateTo1HourCandles(item.candles);
    const rsi1hSeries = calculateWilderRSI(hourCandles, 23);
    const latestRsi1H = rsi1hSeries.length > 0 ? rsi1hSeries[rsi1hSeries.length - 1].rsi : latestRsi;

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
      sector: item.sector,
      currentPrice: item.currentPrice,
      changePercent: item.changePercent,
      rsi: latestRsi,
      ma: latestMa,
      rsi1h: latestRsi1H,
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
      candle: latestCandle,
    };

    allStocks.push(stockResult);

    if (setupTag === "1H_CONFIRMED") {
      confirmed1H.push(stockResult);
    } else if (setupTag === "15M_BREAKOUT") {
      breakouts15M.push(stockResult);
    }
  }

  confirmed1H.sort((a, b) => b.rsi - a.rsi);
  breakouts15M.sort((a, b) => b.rsi - a.rsi);
  allStocks.sort((a, b) => b.rsi - a.rsi);

  const matches = [...confirmed1H, ...breakouts15M];

  return { matches, confirmed1H, breakouts15M, allStocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED SCANNER RUNNER
// ─────────────────────────────────────────────────────────────────────────────

let isScanRunning = false;

/**
 * Runs all 5 NSE scanner calculations against live market data once,
 * stores the completed results in Neon PostgreSQL `scanner_cache`,
 * and updates `signals_history`.
 */
export async function runAllScanners(): Promise<AllTricksResult> {
  if (isScanRunning) {
    if (memoryCache) return memoryCache.data;
  }
  isScanRunning = true;

  const startTime = Date.now();
  const nowTs = Math.floor(startTime / 1000);
  const { dateStr, timeStr } = getISTNow();

  try {
    console.log(`[SCANNER-SERVICE] 🔄 Starting unified scan across ${SCAN_SYMBOLS.length} stocks...`);

    // Fetch 15m candles in controlled chunks of 10 to prevent rate-limits
    const chunkSize = 10;
    const parsedStocks: ParsedStockData[] = [];

    for (let i = 0; i < SCAN_SYMBOLS.length; i += chunkSize) {
      const chunk = SCAN_SYMBOLS.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (s) => {
        const raw = await fetchYahoo15mCandles(s.symbol, "5d");
        return parseYahooChart(s, raw, nowTs);
      });

      const results = await Promise.all(chunkPromises);
      results.forEach((r) => {
        if (r) parsedStocks.push(r);
      });

      if (i + chunkSize < SCAN_SYMBOLS.length) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    console.log(`[SCANNER-SERVICE] ✅ Fetched candle data for ${parsedStocks.length} stocks.`);

    // Run all 5 scanner calculations simultaneously in memory
    const gaps = calculateTrick1Gaps(parsedStocks);
    const motherMatches = calculateTrick2MotherRange(parsedStocks);
    const breakoutMatches = calculateTrick3Breakouts(parsedStocks, nowTs);
    const signals = calculateTrick4Signals(parsedStocks);
    const rsiResults = calculateTrick5RSI(parsedStocks);

    const durationMs = Date.now() - startTime;
    const timestampISO = new Date().toISOString();

    const unifiedResult: AllTricksResult = {
      success: true,
      gaps: {
        gapUps: gaps.gapUps,
        gapDowns: gaps.gapDowns,
        timestamp: timestampISO,
      },
      motherRange: {
        matches: motherMatches,
        matchesCount: motherMatches.length,
        scannedCount: parsedStocks.length,
        timestamp: timestampISO,
      },
      breakouts: {
        matches: breakoutMatches,
        matchesCount: breakoutMatches.length,
        scannedCount: parsedStocks.length,
        timestamp: timestampISO,
      },
      rsi: {
        matches: rsiResults.matches,
        confirmed1H: rsiResults.confirmed1H,
        breakouts15M: rsiResults.breakouts15M,
        allStocks: rsiResults.allStocks,
        matchesCount: rsiResults.matches.length,
        confirmed1HCount: rsiResults.confirmed1H.length,
        breakout15MCount: rsiResults.breakouts15M.length,
        timestamp: timestampISO,
      },
      signals,
      lastUpdated: `${dateStr} ${timeStr} IST`,
      durationMs,
    };

    // Update in-memory cache
    memoryCache = { data: unifiedResult, cachedAt: Date.now() };

    // Persist to Neon PostgreSQL scanner_cache table asynchronously
    persistToNeonDB(dateStr, unifiedResult, signals).catch((err) => {
      console.warn("[SCANNER-SERVICE] DB write error (will retry next cycle):", err.message);
    });

    return unifiedResult;
  } catch (error: any) {
    console.error("[SCANNER-SERVICE] Scanner execution error:", error);
    // Return stale cache if available
    if (memoryCache) return memoryCache.data;
    throw error;
  } finally {
    isScanRunning = false;
  }
}

/**
 * Persists results to Neon DB with backward-compatible types
 */
async function persistToNeonDB(dateStr: string, result: AllTricksResult, signals: LiveSignal[]): Promise<void> {
  try {
    // 1. Unified cache
    await sql`
      INSERT INTO scanner_cache (date_str, scanner_type, results)
      VALUES (${dateStr}, 'all-tricks', ${JSON.stringify(result)})
      ON CONFLICT (date_str, scanner_type)
      DO UPDATE SET results = EXCLUDED.results, created_at = CURRENT_TIMESTAMP
    `;

    // 2. Individual legacy caches for backward compatibility
    await Promise.allSettled([
      sql`
        INSERT INTO scanner_cache (date_str, scanner_type, results)
        VALUES (${dateStr}, 'nse-gaps', ${JSON.stringify(result.gaps)})
        ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
      `,
      sql`
        INSERT INTO scanner_cache (date_str, scanner_type, results)
        VALUES (${dateStr}, 'scanner-5c', ${JSON.stringify({
          success: true,
          matchesCount: result.motherRange.matchesCount,
          matches: result.motherRange.matches,
          scannedCount: result.motherRange.scannedCount,
          timestamp: result.motherRange.timestamp,
        })})
        ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
      `,
      sql`
        INSERT INTO scanner_cache (date_str, scanner_type, results)
        VALUES (${dateStr}, 'scanner-3c', ${JSON.stringify({
          success: true,
          matchesCount: result.breakouts.matchesCount,
          matches: result.breakouts.matches,
          scannedCount: result.breakouts.scannedCount,
          timestamp: result.breakouts.timestamp,
        })})
        ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
      `,
      sql`
        INSERT INTO scanner_cache (date_str, scanner_type, results)
        VALUES (${dateStr}, 'scanner-rsi', ${JSON.stringify({
          success: true,
          matchesCount: result.rsi.matchesCount,
          confirmed1HCount: result.rsi.confirmed1HCount,
          breakout15MCount: result.rsi.breakout15MCount,
          matches: result.rsi.matches,
          confirmed1H: result.rsi.confirmed1H,
          breakouts15M: result.rsi.breakouts15M,
          allStocks: result.rsi.allStocks,
          timestamp: result.rsi.timestamp,
        })})
        ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
      `,
    ]);

    // 3. Insert new signals into signals_history
    if (signals && signals.length > 0) {
      for (const sig of signals) {
        try {
          await sql`
            INSERT INTO signals_history (
              stock_symbol, stock_name, signal_type, direction, timeframe,
              open_price, high_price, low_price, close_price, candle_time, candle_date
            ) VALUES (
              ${sig.stock_symbol}, ${sig.stock_name}, ${sig.signal_type}, ${sig.direction}, ${sig.timeframe},
              ${sig.open_price}, ${sig.high_price}, ${sig.low_price}, ${sig.close_price}, ${sig.candle_time}, ${sig.candle_date}
            )
            ON CONFLICT (stock_symbol, candle_time) DO NOTHING
          `;
        } catch {
          // Ignore individual duplicate conflict
        }
      }
    }

    console.log(`[SCANNER-SERVICE] 💾 Saved all scanner results to Neon DB for ${dateStr}.`);
  } catch (err: any) {
    console.warn("[SCANNER-SERVICE] Error persisting to DB:", err.message);
  }
}

/**
 * Fast read from Neon PostgreSQL scanner_cache table.
 * Takes 15-30ms from DB, or < 1ms from server memory.
 */
export async function getCachedTricksFromDB(): Promise<AllTricksResult | null> {
  // Check fast in-memory cache first
  if (memoryCache && Date.now() - memoryCache.cachedAt < MEMORY_CACHE_TTL_MS) {
    return memoryCache.data;
  }

  try {
    const rows = await sql`
      SELECT results, created_at
      FROM scanner_cache
      WHERE scanner_type = 'all-tricks'
      ORDER BY id DESC
      LIMIT 1
    `;

    if (rows && rows.length > 0 && rows[0].results) {
      const data = rows[0].results as AllTricksResult;
      memoryCache = { data, cachedAt: Date.now() };
      return data;
    }
  } catch (err: any) {
    console.warn("[SCANNER-SERVICE] Failed to read from DB cache:", err.message);
  }

  // If memory cache exists (even stale), return it
  if (memoryCache) return memoryCache.data;

  return null;
}
