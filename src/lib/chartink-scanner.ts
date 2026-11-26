import { saveGapSignals, logScanExecution, GapSignalRecord } from "./new-trick-db";
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
 * Query Chartink screener endpoint with a specific scan clause (with timeout)
 */
async function queryChartinkScreener(
  clause: string,
  session: { csrfToken: string; cookies: string }
): Promise<{ data: ChartinkRawItem[] | null; httpStatus: number; error?: string }> {
  const processUrl = "https://chartink.com/screener/process";
  const body = new URLSearchParams({ scan_clause: clause });

  try {
    const res = await fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-csrf-token": session.csrfToken,
        "Cookie": session.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://chartink.com",
        "Referer": "https://chartink.com/screener"
      },
      body: body.toString(),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      // Invalidate cached session on auth error
      if (res.status === 419 || res.status === 401 || res.status === 403) {
        cachedSession = null;
      }
      return { data: null, httpStatus: res.status, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      return { data: json.data, httpStatus: res.status };
    }

    return { data: [], httpStatus: res.status };
  } catch (err: any) {
    return { data: null, httpStatus: 0, error: err.message };
  }
}

/**
 * Runs both Chartink Gap Up and Gap Down scanners CONCURRENTLY for maximum speed (~1.2s total),
 * saves results in database, and logs execution details.
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
  status: "SUCCESS" | "RETRYING" | "FAILED" | "MARKET_CLOSED";
  durationMs?: number;
}> {
  const startMs = Date.now();
  const marketTime = getISTMarketTime();
  const tradingDate = options.targetDate || marketTime.dateStr;

  // 1. Market day validation
  if (!options.forceScan && !marketTime.isTradingDay) {
    await logScanExecution({
      scan_type: "GAP_UP_DOWN_FUTURES",
      trading_date: tradingDate,
      status: "MARKET_CLOSED",
      gap_up_count: 0,
      gap_down_count: 0,
      data_source: "Chartink Futures",
      error_message: `Market closed today (${marketTime.weekday})`,
    });

    return {
      success: true,
      tradingDate,
      gapUps: [],
      gapDowns: [],
      status: "MARKET_CLOSED",
      durationMs: Date.now() - startMs,
    };
  }

  // 2. Fetch session (reused if fresh)
  let session = await getChartinkSession(false);
  if (!session) {
    return {
      success: false,
      tradingDate,
      gapUps: [],
      gapDowns: [],
      error: "Unable to establish Chartink connection",
      status: "FAILED",
      durationMs: Date.now() - startMs,
    };
  }

  // 3. Execute both Gap Up and Gap Down scans CONCURRENTLY
  const [upResponse, downResponse] = await Promise.all([
    queryChartinkScreener(CHARTINK_CLAUSE_GAP_UP, session),
    queryChartinkScreener(CHARTINK_CLAUSE_GAP_DOWN, session)
  ]);

  // If session expired (HTTP 419), retry once with fresh session
  if (upResponse.httpStatus === 419 || downResponse.httpStatus === 419) {
    session = await getChartinkSession(true);
    if (session) {
      const [upRetry, downRetry] = await Promise.all([
        queryChartinkScreener(CHARTINK_CLAUSE_GAP_UP, session),
        queryChartinkScreener(CHARTINK_CLAUSE_GAP_DOWN, session)
      ]);
      Object.assign(upResponse, upRetry);
      Object.assign(downResponse, downRetry);
    }
  }

  const bothSucceeded = upResponse.data !== null && downResponse.data !== null;
  const executionStatus = bothSucceeded ? "SUCCESS" : "FAILED";
  const errorMessage = !bothSucceeded 
    ? [upResponse.error, downResponse.error].filter(Boolean).join(" | ")
    : null;

  // 4. Map signals cleanly
  const gapUps: GapSignalRecord[] = [];
  const seenUp = new Set<string>();
  if (upResponse.data) {
    for (const item of upResponse.data) {
      const sym = (item.nsecode || "").toUpperCase().trim();
      if (sym && !seenUp.has(sym)) {
        seenUp.add(sym);
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

  const gapDowns: GapSignalRecord[] = [];
  const seenDown = new Set<string>();
  if (downResponse.data) {
    for (const item of downResponse.data) {
      const sym = (item.nsecode || "").toUpperCase().trim();
      if (sym && !seenDown.has(sym)) {
        seenDown.add(sym);
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

  // 5. Save to database & local backup only if scan succeeded
  if (bothSucceeded) {
    await saveGapSignals([...gapUps, ...gapDowns]);
  }

  // 6. Log execution
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
