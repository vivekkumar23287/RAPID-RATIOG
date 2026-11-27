import {
  saveGapSignals,
  save3CGapSignals,
  logScanExecution,
  GapSignalRecord,
  ThreeCandleGapRecord,
} from "./new-trick-db";
import { getISTMarketTime } from "./nse-calendar";

export interface ChartinkRawItem {
  sr?: number;
  name: string;
  nsecode: string;
  per_chg?: number;
  close?: number;
  volume?: number;
}

export interface ChartinkScanResult {
  success: boolean;
  signals: GapSignalRecord[];
  error?: string;
  dataSource: string;
  rawCount?: number;
  httpStatus?: number;
}

// Chartink Watchlist ID for Futures segment is 33489
export const CHARTINK_CLAUSE_GAP_UP = "( {33489} ( [=1] 15 minute low > 1 day ago high ) )";
export const CHARTINK_CLAUSE_GAP_DOWN = "( {33489} ( [=1] 15 minute high < 1 day ago low ) )";

// Trick 2 — 3-Candle Gap Clauses (Futures segment 33489)
// Compares Candle 3 and Candle 1 (ignoring Candle 2)
export const CHARTINK_CLAUSE_3C_15M_BULLISH = "( {33489} ( [0] 15 minute low > [-2] 15 minute high ) )";
export const CHARTINK_CLAUSE_3C_15M_BEARISH = "( {33489} ( [0] 15 minute high < [-2] 15 minute low ) )";
export const CHARTINK_CLAUSE_3C_1H_BULLISH = "( {33489} ( [0] 1 hour low > [-2] 1 hour high ) )";
export const CHARTINK_CLAUSE_3C_1H_BEARISH = "( {33489} ( [0] 1 hour high < [-2] 1 hour low ) )";

// Cached session state with 5-minute TTL to eliminate redundant homepage fetches
interface CachedSession {
  csrfToken: string;
  cookies: string;
  expiresAt: number;
}
let cachedSession: CachedSession | null = null;

/**
 * Fetch or reuse CSRF token and session cookies from Chartink
 */
async function getChartinkSession(forceFresh = false): Promise<{ csrfToken: string; cookies: string } | null> {
  const now = Date.now();
  if (!forceFresh && cachedSession && cachedSession.expiresAt > now) {
    return { csrfToken: cachedSession.csrfToken, cookies: cachedSession.cookies };
  }

  const url = "https://chartink.com/screener";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      console.warn(`[CHARTINK] Screener homepage returned HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const tokenMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;

    if (!csrfToken) {
      console.warn("[CHARTINK] Failed to locate CSRF token in homepage HTML.");
      return null;
    }

    const rawCookies: string[] = [];
    const getSetCookie = (res.headers as any).getSetCookie?.bind(res.headers);
    if (typeof getSetCookie === "function") {
      rawCookies.push(...getSetCookie());
    } else {
      const singleCookie = res.headers.get("set-cookie");
      if (singleCookie) rawCookies.push(singleCookie);
    }

    const cookieString = rawCookies
      .map(c => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    // Cache session for 5 minutes
    cachedSession = {
      csrfToken,
      cookies: cookieString,
      expiresAt: now + 5 * 60 * 1000,
    };

    return { csrfToken, cookies: cookieString };
  } catch (err: any) {
    console.error("[CHARTINK] Error obtaining session:", err.message);
    cachedSession = null;
    return null;
  }
}

/**
 * Query Chartink screener endpoint with a specific scan clause
 */
export async function queryChartinkScreener(
  clause: string,
  session?: { csrfToken: string; cookies: string } | null
): Promise<{ success: boolean; data: ChartinkRawItem[]; error?: string; httpStatus?: number }> {
  try {
    const activeSession = session || (await getChartinkSession());
    if (!activeSession) {
      return { success: false, data: [], error: "Failed to initialize Chartink session" };
    }

    const res = await fetch("https://chartink.com/screener/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-csrf-token": activeSession.csrfToken,
        "Cookie": activeSession.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://chartink.com",
        "Referer": "https://chartink.com/screener",
      },
      body: new URLSearchParams({ scan_clause: clause }).toString(),
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { success: false, data: [], error: `HTTP ${res.status}: ${res.statusText}`, httpStatus: res.status };
    }

    const json = await res.json();
    const rawList = Array.isArray(json?.data) ? json.data : [];

    return { success: true, data: rawList, httpStatus: res.status };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

/**
 * Run Trick 1 (Gap Up & Down) concurrent scan
 */
export async function runFullChartinkScan(options: {
  isScheduled?: boolean;
  targetDate?: string;
  forceScan?: boolean;
} = {}): Promise<{
  success: boolean;
  tradingDate: string;
  gapUps: GapSignalRecord[];
  gapDowns: GapSignalRecord[];
  error?: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  durationMs: number;
}> {
  const startMs = Date.now();
  const ist = getISTMarketTime();
  const tradingDate = options.targetDate || ist.dateStr;

  console.log(`[CHARTINK] Starting fast concurrent scan for ${tradingDate} (Futures segment)...`);

  const session = await getChartinkSession();
  if (!session) {
    const err = "Chartink session could not be established.";
    await logScanExecution({
      scan_type: "GAP_UP_DOWN_FUTURES",
      trading_date: tradingDate,
      status: "FAILED",
      gap_up_count: 0,
      gap_down_count: 0,
      data_source: "Chartink Futures",
      error_message: err,
    });
    return {
      success: false,
      tradingDate,
      gapUps: [],
      gapDowns: [],
      error: err,
      status: "FAILED",
      durationMs: Date.now() - startMs,
    };
  }

  const [resUp, resDown] = await Promise.all([
    queryChartinkScreener(CHARTINK_CLAUSE_GAP_UP, session),
    queryChartinkScreener(CHARTINK_CLAUSE_GAP_DOWN, session),
  ]);

  const bothSucceeded = resUp.success && resDown.success;
  const executionStatus = bothSucceeded ? "SUCCESS" : (resUp.success || resDown.success ? "PARTIAL" : "FAILED");
  const errorMessage = !bothSucceeded ? [resUp.error, resDown.error].filter(Boolean).join(" | ") : null;

  const gapUps: GapSignalRecord[] = [];
  const gapDowns: GapSignalRecord[] = [];

  if (resUp.success) {
    for (const item of resUp.data) {
      const sym = (item.nsecode || item.name || "").trim().toUpperCase();
      if (sym) {
        gapUps.push({
          company_name: item.name || sym,
          nse_symbol: sym,
          signal_type: "GAP_UP",
          trading_date: tradingDate,
          candle_time: "09:15 - 09:30 AM",
          status: "CONFIRMED",
          data_source: "Chartink Futures",
          price: item.close ? Number(item.close) : null,
          change_percent: item.per_chg ? Number(item.per_chg) : null,
        });
      }
    }
  }

  if (resDown.success) {
    for (const item of resDown.data) {
      const sym = (item.nsecode || item.name || "").trim().toUpperCase();
      if (sym) {
        gapDowns.push({
          company_name: item.name || sym,
          nse_symbol: sym,
          signal_type: "GAP_DOWN",
          trading_date: tradingDate,
          candle_time: "09:15 - 09:30 AM",
          status: "CONFIRMED",
          data_source: "Chartink Futures",
          price: item.close ? Number(item.close) : null,
          change_percent: item.per_chg ? Number(item.per_chg) : null,
        });
      }
    }
  }

  const durationMs = Date.now() - startMs;
  console.log(`[CHARTINK] Fast concurrent scan completed in ${durationMs}ms: ${gapUps.length} Gap Ups, ${gapDowns.length} Gap Downs.`);

  if (bothSucceeded) {
    await saveGapSignals([...gapUps, ...gapDowns]);
  }

  await logScanExecution({
    scan_type: "GAP_UP_DOWN_FUTURES",
    trading_date: tradingDate,
    status: executionStatus,
    gap_up_count: gapUps.length,
    gap_down_count: gapDowns.length,
    data_source: "Chartink Futures",
    error_message: errorMessage,
    details: {
      segment: "Futures (33489)",
      durationMs,
      gapUpSymbols: gapUps.map(s => s.nse_symbol),
      gapDownSymbols: gapDowns.map(s => s.nse_symbol),
    }
  });

  return {
    success: bothSucceeded,
    tradingDate,
    gapUps,
    gapDowns,
    error: errorMessage || undefined,
    status: executionStatus,
    durationMs,
  };
}

/**
 * Run Trick 2 (3-Candle Gap) concurrent scan for 15m and 1h timeframes
 */
export async function run3CGapScan(options: {
  targetDate?: string;
  timeframe?: "15m" | "1h" | "ALL";
} = {}): Promise<{
  success: boolean;
  tradingDate: string;
  m15Up: ThreeCandleGapRecord[];
  m15Down: ThreeCandleGapRecord[];
  h1Up: ThreeCandleGapRecord[];
  h1Down: ThreeCandleGapRecord[];
  error?: string;
}> {
  const startMs = Date.now();
  const ist = getISTMarketTime();
  const tradingDate = options.targetDate || ist.dateStr;

  // Format Added At and Candle 3 Close time in Asia/Kolkata
  const nowIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  console.log(`[CHARTINK-3C] Running 3-Candle Gap scan for ${tradingDate} at ${nowIST}...`);

  const session = await getChartinkSession();
  if (!session) {
    return {
      success: false,
      tradingDate,
      m15Up: [],
      m15Down: [],
      h1Up: [],
      h1Down: [],
      error: "Chartink session unavailable",
    };
  }

  // Run all four queries concurrently
  const [res15Up, res15Down, res1hUp, res1hDown] = await Promise.all([
    queryChartinkScreener(CHARTINK_CLAUSE_3C_15M_BULLISH, session),
    queryChartinkScreener(CHARTINK_CLAUSE_3C_15M_BEARISH, session),
    queryChartinkScreener(CHARTINK_CLAUSE_3C_1H_BULLISH, session),
    queryChartinkScreener(CHARTINK_CLAUSE_3C_1H_BEARISH, session),
  ]);

  const mapToRecord = (item: ChartinkRawItem, dir: "BULLISH" | "BEARISH", tf: "15m" | "1h"): ThreeCandleGapRecord => {
    const sym = (item.nsecode || item.name || "").trim().toUpperCase();
    return {
      company_name: item.name || sym,
      nse_symbol: sym,
      direction: dir,
      timeframe: tf,
      candle3_close_time: nowIST,
      added_at: nowIST,
      trading_date: tradingDate,
      status: "CONFIRMED",
      data_source: "Chartink Futures",
      price: item.close ? Number(item.close) : null,
      change_percent: item.per_chg ? Number(item.per_chg) : null,
      is_new: true,
    };
  };

  const m15Up = (res15Up.data || []).map(i => mapToRecord(i, "BULLISH", "15m"));
  const m15Down = (res15Down.data || []).map(i => mapToRecord(i, "BEARISH", "15m"));
  const h1Up = (res1hUp.data || []).map(i => mapToRecord(i, "BULLISH", "1h"));
  const h1Down = (res1hDown.data || []).map(i => mapToRecord(i, "BEARISH", "1h"));

  const allRecords = [...m15Up, ...m15Down, ...h1Up, ...h1Down];
  if (allRecords.length > 0) {
    await save3CGapSignals(allRecords);
  }

  const durationMs = Date.now() - startMs;
  console.log(`[CHARTINK-3C] Completed in ${durationMs}ms: 15m Up=${m15Up.length}, 15m Down=${m15Down.length}, 1h Up=${h1Up.length}, 1h Down=${h1Down.length}`);

  return {
    success: res15Up.success && res15Down.success && res1hUp.success && res1hDown.success,
    tradingDate,
    m15Up,
    m15Down,
    h1Up,
    h1Down,
  };
}
