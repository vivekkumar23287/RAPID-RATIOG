import { NIFTY_50_STOCKS, getStockName } from "./stocks";
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
}

// Chartink NIFTY 50 watchlist ID is 33489
// Condition 1 (GAP UP): [=1] 15 minute Low Greater than 1 day ago High
const CHARTINK_CLAUSE_GAP_UP_NIFTY50 = "( {33489} ( [=1] 15 minute low > 1 day ago high ) )";
const CHARTINK_CLAUSE_GAP_UP_FALLBACK = "( [=1] 15 minute low > 1 day ago high )";

// Condition 2 (GAP DOWN): [=1] 15 minute High Less than 1 day ago Low
const CHARTINK_CLAUSE_GAP_DOWN_NIFTY50 = "( {33489} ( [=1] 15 minute high < 1 day ago low ) )";
const CHARTINK_CLAUSE_GAP_DOWN_FALLBACK = "( [=1] 15 minute high < 1 day ago low )";

// Set of verified Nifty 50 symbols for strict universe validation
const NIFTY_50_SYMBOLS = new Set(
  NIFTY_50_STOCKS
    .filter(s => s.symbol !== "NIFTY50" && s.symbol !== "BTC" && s.symbol !== "BTC-USD")
    .map(s => s.symbol.toUpperCase().replace(/\.NS$/, ""))
);

/**
 * Fetch CSRF token and session cookies from Chartink
 */
async function getChartinkSession(): Promise<{ csrfToken: string; cookies: string } | null> {
  const url = "https://chartink.com/screener";
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      console.warn(`[CHARTINK] Screener page responded with HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();

    // Extract CSRF token from <meta name="csrf-token" content="...">
    const tokenMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;

    if (!csrfToken) {
      console.warn("[CHARTINK] Failed to locate csrf-token meta tag in Chartink HTML.");
      return null;
    }

    // Extract set-cookie headers
    // When using native fetch in Node / Next.js, cookies can be retrieved from headers
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

    return { csrfToken, cookies: cookieString };
  } catch (err: any) {
    console.error("[CHARTINK] Error getting session:", err.message);
    return null;
  }
}

/**
 * Query Chartink screener endpoint with a specific scan clause
 */
async function queryChartinkScreener(
  clause: string,
  session: { csrfToken: string; cookies: string }
): Promise<ChartinkRawItem[] | null> {
  const processUrl = "https://chartink.com/screener/process";
  const body = new URLSearchParams({ scan_clause: clause });

  try {
    const res = await fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-csrf-token": session.csrfToken,
        "Cookie": session.cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://chartink.com",
        "Referer": "https://chartink.com/screener"
      },
      body: body.toString(),
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      console.warn(`[CHARTINK] Process endpoint responded with HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      return json.data;
    }

    return [];
  } catch (err: any) {
    console.error("[CHARTINK] Error executing scan clause:", err.message);
    return null;
  }
}

/**
 * Execute a single Chartink scanner condition (GAP UP or GAP DOWN)
 */
export async function executeChartinkScanner(
  signalType: "GAP_UP" | "GAP_DOWN",
  tradingDate: string
): Promise<ChartinkScanResult> {
  const session = await getChartinkSession();
  if (!session) {
    return {
      success: false,
      signals: [],
      error: "Unable to establish Chartink connection or obtain CSRF session token.",
      dataSource: "Chartink",
    };
  }

  const primaryClause = signalType === "GAP_UP" 
    ? CHARTINK_CLAUSE_GAP_UP_NIFTY50 
    : CHARTINK_CLAUSE_GAP_DOWN_NIFTY50;

  const fallbackClause = signalType === "GAP_UP" 
    ? CHARTINK_CLAUSE_GAP_UP_FALLBACK 
    : CHARTINK_CLAUSE_GAP_DOWN_FALLBACK;

  let rawItems = await queryChartinkScreener(primaryClause, session);

  // If primary Nifty50 segment query fails or yields empty, retry with fallback clause
  if (rawItems === null) {
    console.log(`[CHARTINK] Retrying ${signalType} with fallback clause...`);
    rawItems = await queryChartinkScreener(fallbackClause, session);
  }

  if (rawItems === null) {
    return {
      success: false,
      signals: [],
      error: `Chartink screener process query failed for ${signalType}.`,
      dataSource: "Chartink",
    };
  }

  // Filter strictly to Nifty 50 stocks, map to GapSignalRecord, and deduplicate
  const seen = new Set<string>();
  const signals: GapSignalRecord[] = [];

  for (const item of rawItems) {
    const rawSymbol = (item.nsecode || "").toUpperCase().trim();
    if (!rawSymbol) continue;

    // Must be in NIFTY 50 universe
    if (!NIFTY_50_SYMBOLS.has(rawSymbol)) continue;

    if (!seen.has(rawSymbol)) {
      seen.add(rawSymbol);
      const companyName = getStockName(rawSymbol) || item.name || rawSymbol;

      signals.push({
        company_name: companyName,
        nse_symbol: rawSymbol,
        signal_type: signalType,
        trading_date: tradingDate,
        candle_time: "09:15 - 09:30 AM",
        status: "CONFIRMED",
        data_source: "Chartink",
      });
    }
  }

  return {
    success: true,
    signals,
    dataSource: "Chartink",
    rawCount: rawItems.length,
  };
}

/**
 * Runs both Chartink Gap Up and Gap Down scanners independently,
 * validates against Nifty 50 universe, saves results in database,
 * and logs execution details.
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
}> {
  const marketTime = getISTMarketTime();
  const tradingDate = options.targetDate || marketTime.dateStr;

  // 1. Market day validation
  if (!options.forceScan && !marketTime.isTradingDay) {
    await logScanExecution({
      scan_type: "GAP_UP_DOWN_CHARTINK",
      trading_date: tradingDate,
      status: "MARKET_CLOSED",
      gap_up_count: 0,
      gap_down_count: 0,
      data_source: "Chartink",
      error_message: `Market is closed today (${marketTime.weekday}, Holiday: ${marketTime.isHoliday})`,
    });

    return {
      success: true,
      tradingDate,
      gapUps: [],
      gapDowns: [],
      error: `NSE market is closed today (${marketTime.isHoliday ? "Holiday" : marketTime.weekday}).`,
      status: "MARKET_CLOSED",
    };
  }

  // 2. Run Scanner 1 — GAP UP
  console.log(`[CHARTINK] Running Scanner 1 (GAP UP) for ${tradingDate}...`);
  const upResult = await executeChartinkScanner("GAP_UP", tradingDate);

  // 3. Run Scanner 2 — GAP DOWN
  console.log(`[CHARTINK] Running Scanner 2 (GAP DOWN) for ${tradingDate}...`);
  const downResult = await executeChartinkScanner("GAP_DOWN", tradingDate);

  const bothSucceeded = upResult.success && downResult.success;
  const executionStatus = bothSucceeded ? "SUCCESS" : "FAILED";
  const errorMessage = !bothSucceeded 
    ? [upResult.error, downResult.error].filter(Boolean).join(" | ")
    : null;

  const allSignals = [...upResult.signals, ...downResult.signals];

  // 4. Save to database if succeeded
  if (bothSucceeded) {
    await saveGapSignals(allSignals);
  }

  // 5. Log execution
  await logScanExecution({
    scan_type: "GAP_UP_DOWN_CHARTINK",
    trading_date: tradingDate,
    status: executionStatus,
    gap_up_count: upResult.signals.length,
    gap_down_count: downResult.signals.length,
    data_source: "Chartink",
    error_message: errorMessage,
    details: {
      isScheduled: options.isScheduled || false,
      rawUpCount: upResult.rawCount,
      rawDownCount: downResult.rawCount,
      gapUpSymbols: upResult.signals.map(s => s.nse_symbol),
      gapDownSymbols: downResult.signals.map(s => s.nse_symbol)
    }
  });

  return {
    success: bothSucceeded,
    tradingDate,
    gapUps: upResult.signals,
    gapDowns: downResult.signals,
    error: errorMessage || undefined,
    status: executionStatus,
  };
}
