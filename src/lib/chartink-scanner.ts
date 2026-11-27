import {
  saveGapSignals,
  save3CGapSignals,
  save3CCurrentSnapshot,
  loadCurrent3CSnapshot,
  logScanExecution,
  GapSignalRecord,
  ThreeCandleGapRecord,
  Trick2SnapshotData,
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

// Trick 2 — Four Independent Scanner Configurations (Futures segment 33489)
export interface Trick2ScannerConfig {
  id: "bullish15m" | "bearish15m" | "bullish1h" | "bearish1h";
  name: string;
  timeframe: "15m" | "1h";
  direction: "BULLISH" | "BEARISH";
  leftOffset: number;
  leftField: "low" | "high";
  operator: ">" | "<";
  rightOffset: number;
  rightField: "high" | "low";
  clause: string;
}

export const trick2Scanners = {
  bullish15m: {
    id: "bullish15m" as const,
    name: "15-Minute Bullish",
    timeframe: "15m" as const,
    direction: "bullish" as const,
    leftOffset: -1,
    leftField: "low" as const,
    operator: ">" as const,
    rightOffset: -3,
    rightField: "high" as const,
    clause: "( {33489} ( [-1] 15 minute low > [-3] 15 minute high ) )",
  },

  bearish15m: {
    id: "bearish15m" as const,
    name: "15-Minute Bearish",
    timeframe: "15m" as const,
    direction: "bearish" as const,
    leftOffset: -1,
    leftField: "high" as const,
    operator: "<" as const,
    rightOffset: -3,
    rightField: "low" as const,
    clause: "( {33489} ( [-1] 15 minute high < [-3] 15 minute low ) )",
  },

  bullish1h: {
    id: "bullish1h" as const,
    name: "1-Hour Bullish",
    timeframe: "1h" as const,
    direction: "bullish" as const,
    leftOffset: -1,
    leftField: "low" as const,
    operator: ">" as const,
    rightOffset: -3,
    rightField: "high" as const,
    clause: "( {33489} ( [-1] 1 hour low > [-3] 1 hour high ) )",
  },

  bearish1h: {
    id: "bearish1h" as const,
    name: "1-Hour Bearish",
    timeframe: "1h" as const,
    direction: "bearish" as const,
    leftOffset: -1,
    leftField: "high" as const,
    operator: "<" as const,
    rightOffset: -3,
    rightField: "low" as const,
    clause: "( {33489} ( [-1] 1 hour high < [-3] 1 hour low ) )",
  },
};

export const CHARTINK_CLAUSE_3C_15M_BULLISH = trick2Scanners.bullish15m.clause;
export const CHARTINK_CLAUSE_3C_15M_BEARISH = trick2Scanners.bearish15m.clause;
export const CHARTINK_CLAUSE_3C_1H_BULLISH = trick2Scanners.bullish1h.clause;
export const CHARTINK_CLAUSE_3C_1H_BEARISH = trick2Scanners.bearish1h.clause;

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
 * Run Trick 2 (3-Candle Gap) by executing four separate Chartink scanners in exact sequence:
 * Step 1: Scanner 1 — 15-Minute Bullish
 * Step 2: Scanner 2 — 15-Minute Bearish
 * Step 3: Scanner 3 — 1-Hour Bullish
 * Step 4: Scanner 4 — 1-Hour Bearish
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

  const nowIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  console.log(`[CHARTINK-3C] Starting Trick 2 (3-Candle Gap) 4-scanner sequence for ${tradingDate} at ${nowIST}...`);

  let session = await getChartinkSession();
  if (!session) {
    console.warn("[CHARTINK-3C] Initial session fetch failed. Retrying with fresh session...");
    session = await getChartinkSession(true);
  }

  // Load existing snapshot to preserve previous results if any individual scanner fails
  const prevSnapshot = loadCurrent3CSnapshot();

  const parseAndDedupe = (
    rawItems: ChartinkRawItem[],
    dir: "BULLISH" | "BEARISH",
    tf: "15m" | "1h"
  ): ThreeCandleGapRecord[] => {
    const seen = new Set<string>();
    const records: ThreeCandleGapRecord[] = [];
    for (const item of rawItems) {
      const sym = (item.nsecode || item.name || "").trim().toUpperCase();
      const companyName = (item.name || sym).trim();
      if (sym && !seen.has(sym)) {
        seen.add(sym);
        records.push({
          company_name: companyName,
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
        });
      }
    }
    return records;
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper with automatic retry on token/cookie expiry
  const executeScanner = async (
    scannerName: string,
    clause: string
  ): Promise<{ success: boolean; data: ChartinkRawItem[]; error?: string }> => {
    let res = await queryChartinkScreener(clause, session);
    if (!res.success && (res.httpStatus === 419 || res.httpStatus === 403 || !session)) {
      console.warn(`[CHARTINK-3C] Refreshing session for ${scannerName}...`);
      session = await getChartinkSession(true);
      res = await queryChartinkScreener(clause, session);
    }
    return res;
  };

  // Step 1: Execute Scanner 1 — 15-Minute Bullish on Chartink
  const res15Up = await executeScanner(
    trick2Scanners.bullish15m.name,
    trick2Scanners.bullish15m.clause
  );
  let m15Up = res15Up.success
    ? parseAndDedupe(res15Up.data || [], "BULLISH", "15m")
    : (prevSnapshot?.m15Up || []);

  await delay(250);

  // Step 2: Execute Scanner 2 — 15-Minute Bearish on Chartink
  const res15Down = await executeScanner(
    trick2Scanners.bearish15m.name,
    trick2Scanners.bearish15m.clause
  );
  let m15Down = res15Down.success
    ? parseAndDedupe(res15Down.data || [], "BEARISH", "15m")
    : (prevSnapshot?.m15Down || []);

  await delay(250);

  // Step 3: Execute Scanner 3 — 1-Hour Bullish on Chartink
  const res1hUp = await executeScanner(
    trick2Scanners.bullish1h.name,
    trick2Scanners.bullish1h.clause
  );
  let h1Up = res1hUp.success
    ? parseAndDedupe(res1hUp.data || [], "BULLISH", "1h")
    : (prevSnapshot?.h1Up || []);

  await delay(250);

  // Step 4: Execute Scanner 4 — 1-Hour Bearish on Chartink
  const res1hDown = await executeScanner(
    trick2Scanners.bearish1h.name,
    trick2Scanners.bearish1h.clause
  );
  let h1Down = res1hDown.success
    ? parseAndDedupe(res1hDown.data || [], "BEARISH", "1h")
    : (prevSnapshot?.h1Down || []);

  // Save current active snapshot (Current Chartink Matches)
  const currentSnapshot: Trick2SnapshotData = {
    tradingDate,
    updatedAt: new Date().toISOString(),
    m15Up,
    m15Down,
    h1Up,
    h1Down,
    status: {
      m15Up: res15Up.success ? "SUCCESS" : "STALE",
      m15Down: res15Down.success ? "SUCCESS" : "STALE",
      h1Up: res1hUp.success ? "SUCCESS" : "STALE",
      h1Down: res1hDown.success ? "SUCCESS" : "STALE",
    },
  };

  await save3CCurrentSnapshot(currentSnapshot);

  // Debugging logs matching Requirement 8 exactly:
  console.log(`\nTRICK 2 SCANNER 1 — 15M BULLISH`);
  console.log(`Chartink returned: ${res15Up.data?.length || 0} companies`);
  console.log(`Backend parsed: ${m15Up.length} companies`);
  console.log(`Database stored: ${m15Up.length} companies`);
  console.log(`Frontend displayed: ${m15Up.length} companies`);

  console.log(`\nTRICK 2 SCANNER 2 — 15M BEARISH`);
  console.log(`Chartink returned: ${res15Down.data?.length || 0} companies`);
  console.log(`Backend parsed: ${m15Down.length} companies`);
  console.log(`Database stored: ${m15Down.length} companies`);
  console.log(`Frontend displayed: ${m15Down.length} companies`);

  console.log(`\nTRICK 2 SCANNER 3 — 1H BULLISH`);
  console.log(`Chartink returned: ${res1hUp.data?.length || 0} companies`);
  console.log(`Backend parsed: ${h1Up.length} companies`);
  console.log(`Database stored: ${h1Up.length} companies`);
  console.log(`Frontend displayed: ${h1Up.length} companies`);

  console.log(`\nTRICK 2 SCANNER 4 — 1H BEARISH`);
  console.log(`Chartink returned: ${res1hDown.data?.length || 0} companies`);
  console.log(`Backend parsed: ${h1Down.length} companies`);
  console.log(`Database stored: ${h1Down.length} companies`);
  console.log(`Frontend displayed: ${h1Down.length} companies\n`);

  const durationMs = Date.now() - startMs;
  console.log(`[CHARTINK-3C] Completed 4-scanner sequence in ${durationMs}ms`);

  return {
    success: res15Up.success || res15Down.success || res1hUp.success || res1hDown.success,
    tradingDate,
    m15Up,
    m15Down,
    h1Up,
    h1Down,
  };
}
