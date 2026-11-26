import { sql } from "./db";

export interface GapSignalRecord {
  id?: number;
  company_name: string;
  nse_symbol: string;
  signal_type: "GAP_UP" | "GAP_DOWN";
  prev_day_high?: number | null;
  prev_day_low?: number | null;
  first_candle_high?: number | null;
  first_candle_low?: number | null;
  trading_date: string; // YYYY-MM-DD
  candle_time?: string; // e.g. "09:15 - 09:30 AM"
  scan_time?: string;
  status?: string; // "CONFIRMED"
  data_source?: string; // "Chartink"
}

export interface ScanLogRecord {
  id?: number;
  scan_type: string;
  trading_date: string;
  scan_time?: string;
  status: "SUCCESS" | "RETRYING" | "FAILED" | "MARKET_CLOSED";
  gap_up_count: number;
  gap_down_count: number;
  data_source?: string;
  error_message?: string | null;
  details?: Record<string, any> | null;
}

let dbInitialized = false;

/**
 * Ensures New Trick tables exist in Neon PostgreSQL
 */
export async function initNewTrickDB(): Promise<void> {
  if (dbInitialized) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS new_trick_gap_signals (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        nse_symbol TEXT NOT NULL,
        signal_type VARCHAR(20) NOT NULL,
        prev_day_high DECIMAL,
        prev_day_low DECIMAL,
        first_candle_high DECIMAL,
        first_candle_low DECIMAL,
        trading_date VARCHAR(20) NOT NULL,
        candle_time VARCHAR(30) NOT NULL DEFAULT '09:15 - 09:30 AM',
        scan_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nse_symbol, signal_type, trading_date)
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_new_trick_date ON new_trick_gap_signals(trading_date);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_new_trick_symbol ON new_trick_gap_signals(nse_symbol);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS new_trick_scan_logs (
        id SERIAL PRIMARY KEY,
        scan_type VARCHAR(50) NOT NULL,
        trading_date VARCHAR(20) NOT NULL,
        scan_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL,
        gap_up_count INTEGER NOT NULL DEFAULT 0,
        gap_down_count INTEGER NOT NULL DEFAULT 0,
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink',
        error_message TEXT,
        details JSONB
      );
    `;

    dbInitialized = true;
  } catch (err: any) {
    console.error("[NEW-TRICK-DB] Failed to ensure tables exist:", err.message);
  }
}

/**
 * Save gap signals to database with duplicate prevention
 */
export async function saveGapSignals(signals: GapSignalRecord[]): Promise<number> {
  await initNewTrickDB();
  if (!signals || signals.length === 0) return 0;

  let insertedCount = 0;
  for (const s of signals) {
    try {
      await sql`
        INSERT INTO new_trick_gap_signals (
          company_name, nse_symbol, signal_type,
          prev_day_high, prev_day_low, first_candle_high, first_candle_low,
          trading_date, candle_time, status, data_source
        ) VALUES (
          ${s.company_name}, ${s.nse_symbol}, ${s.signal_type},
          ${s.prev_day_high ?? null}, ${s.prev_day_low ?? null},
          ${s.first_candle_high ?? null}, ${s.first_candle_low ?? null},
          ${s.trading_date}, ${s.candle_time || '09:15 - 09:30 AM'},
          ${s.status || 'CONFIRMED'}, ${s.data_source || 'Chartink'}
        )
        ON CONFLICT (nse_symbol, signal_type, trading_date)
        DO UPDATE SET
          company_name = EXCLUDED.company_name,
          prev_day_high = COALESCE(EXCLUDED.prev_day_high, new_trick_gap_signals.prev_day_high),
          prev_day_low = COALESCE(EXCLUDED.prev_day_low, new_trick_gap_signals.prev_day_low),
          first_candle_high = COALESCE(EXCLUDED.first_candle_high, new_trick_gap_signals.first_candle_high),
          first_candle_low = COALESCE(EXCLUDED.first_candle_low, new_trick_gap_signals.first_candle_low),
          scan_time = CURRENT_TIMESTAMP;
      `;
      insertedCount++;
    } catch (e: any) {
      console.warn(`[NEW-TRICK-DB] Warning inserting ${s.nse_symbol} (${s.signal_type}):`, e.message);
    }
  }

  return insertedCount;
}

/**
 * Log scan execution
 */
export async function logScanExecution(log: ScanLogRecord): Promise<void> {
  await initNewTrickDB();
  try {
    await sql`
      INSERT INTO new_trick_scan_logs (
        scan_type, trading_date, status,
        gap_up_count, gap_down_count, data_source,
        error_message, details
      ) VALUES (
        ${log.scan_type}, ${log.trading_date}, ${log.status},
        ${log.gap_up_count}, ${log.gap_down_count}, ${log.data_source || 'Chartink'},
        ${log.error_message || null}, ${JSON.stringify(log.details || {})}
      );
    `;
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Error logging scan execution:", err.message);
  }
}

/**
 * Fetch gap signals for a specific date or latest date
 */
export async function getGapSignals(params: {
  date?: string;
  signalType?: "GAP_UP" | "GAP_DOWN" | "ALL";
  search?: string;
}): Promise<{
  date: string;
  gapUps: GapSignalRecord[];
  gapDowns: GapSignalRecord[];
  totalUp: number;
  totalDown: number;
}> {
  await initNewTrickDB();

  let targetDate: string = params.date || "";
  if (!targetDate) {
    // Find the latest trading date available in signals
    const latestRow = await sql`
      SELECT trading_date FROM new_trick_gap_signals 
      ORDER BY trading_date DESC LIMIT 1
    `;
    if (latestRow.length > 0) {
      targetDate = latestRow[0].trading_date;
    } else {
      // Return today's IST date string as fallback
      const now = new Date();
      targetDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    }
  }

  let rows: any[] = [];
  try {
    rows = await sql`
      SELECT 
        id, company_name, nse_symbol, signal_type,
        prev_day_high, prev_day_low, first_candle_high, first_candle_low,
        trading_date, candle_time, scan_time, status, data_source
      FROM new_trick_gap_signals
      WHERE trading_date = ${targetDate}
      ORDER BY id ASC;
    `;
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Error fetching signals:", err.message);
  }

  // Filter in memory for search query if provided
  let filtered = rows;
  if (params.search && params.search.trim().length > 0) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter((r) =>
      r.company_name.toLowerCase().includes(q) || r.nse_symbol.toLowerCase().includes(q)
    );
  }

  const gapUps: GapSignalRecord[] = filtered.filter((r) => r.signal_type === "GAP_UP");
  const gapDowns: GapSignalRecord[] = filtered.filter((r) => r.signal_type === "GAP_DOWN");

  return {
    date: targetDate,
    gapUps,
    gapDowns,
    totalUp: gapUps.length,
    totalDown: gapDowns.length,
  };
}

/**
 * Get distinct available trading dates for filter dropdown
 */
export async function getAvailableTradingDates(): Promise<string[]> {
  await initNewTrickDB();
  try {
    const rows = await sql`
      SELECT DISTINCT trading_date FROM new_trick_gap_signals
      ORDER BY trading_date DESC
      LIMIT 60;
    `;
    return rows.map((r: any) => r.trading_date);
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Error fetching dates:", err.message);
    return [];
  }
}

/**
 * Get latest scan status details for the dashboard
 */
export async function getScannerStatusSummary(): Promise<{
  lastScanTime: string | null;
  lastScanStatus: string;
  nextScheduledScan: string;
  totalUpToday: number;
  totalDownToday: number;
  latestTradingDate: string;
  dataSource: string;
}> {
  await initNewTrickDB();

  // Next scheduled scan is 9:31 AM IST on next weekday
  const nextScheduled = computeNextScheduledTime();

  try {
    const latestLog = await sql`
      SELECT scan_time, status, gap_up_count, gap_down_count, trading_date, data_source
      FROM new_trick_scan_logs
      ORDER BY id DESC LIMIT 1;
    `;

    if (latestLog.length > 0) {
      const log = latestLog[0];
      return {
        lastScanTime: log.scan_time,
        lastScanStatus: log.status,
        nextScheduledScan: nextScheduled,
        totalUpToday: log.gap_up_count,
        totalDownToday: log.gap_down_count,
        latestTradingDate: log.trading_date,
        dataSource: log.data_source || "Chartink",
      };
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Error fetching status summary:", err.message);
  }

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return {
    lastScanTime: null,
    lastScanStatus: "READY",
    nextScheduledScan: nextScheduled,
    totalUpToday: 0,
    totalDownToday: 0,
    latestTradingDate: todayIST,
    dataSource: "Chartink",
  };
}

/**
 * Helper to compute next 9:31 AM IST weekday
 */
function computeNextScheduledTime(): string {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = istFormatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const hour = parseInt(map.hour || "0", 10);
  const minute = parseInt(map.minute || "0", 10);
  const weekday = map.weekday;

  const isPast931Today = (hour * 60 + minute) >= (9 * 60 + 31);
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";

  if (isWeekday && !isPast931Today) {
    return "Today at 09:31 AM IST";
  }

  if (weekday === "Fri") {
    return "Monday at 09:31 AM IST";
  } else if (weekday === "Sat") {
    return "Monday at 09:31 AM IST";
  } else if (weekday === "Sun") {
    return "Monday at 09:31 AM IST";
  }

  return "Tomorrow at 09:31 AM IST";
}
