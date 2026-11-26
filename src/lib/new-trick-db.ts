import { sql } from "./db";
import fs from "fs";
import path from "path";

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
  data_source?: string; // "Chartink Futures"
  price?: number | null;
  change_percent?: number | null;
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

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "data");
const LOCAL_SIGNALS_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_gap_signals.json");
const LOCAL_LOGS_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_scan_logs.json");

// In-memory cache for ultra-fast access
let memorySignalsCache: GapSignalRecord[] = [];
let memoryLogsCache: ScanLogRecord[] = [];
let dbInitialized = false;

// Ensure local backup storage exists
function ensureLocalDir() {
  try {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
    }
  } catch (_) {}
}

function loadLocalSignals(): GapSignalRecord[] {
  ensureLocalDir();
  try {
    if (fs.existsSync(LOCAL_SIGNALS_FILE)) {
      const raw = fs.readFileSync(LOCAL_SIGNALS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error reading local signals:", e.message);
  }
  return [];
}

function saveLocalSignals(signals: GapSignalRecord[]) {
  ensureLocalDir();
  try {
    const existing = loadLocalSignals();
    const seen = new Set<string>();
    const combined: GapSignalRecord[] = [];

    // Prioritize new signals
    for (const s of [...signals, ...existing]) {
      const key = `${s.nse_symbol}|${s.signal_type}|${s.trading_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(s);
      }
    }

    fs.writeFileSync(LOCAL_SIGNALS_FILE, JSON.stringify(combined, null, 2), "utf8");
    memorySignalsCache = combined;
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error writing local signals:", e.message);
  }
}

function loadLocalLogs(): ScanLogRecord[] {
  ensureLocalDir();
  try {
    if (fs.existsSync(LOCAL_LOGS_FILE)) {
      const raw = fs.readFileSync(LOCAL_LOGS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

function saveLocalLog(log: ScanLogRecord) {
  ensureLocalDir();
  try {
    const existing = loadLocalLogs();
    existing.unshift({
      ...log,
      scan_time: log.scan_time || new Date().toISOString()
    });
    // Keep last 100 logs
    const trimmed = existing.slice(0, 100);
    fs.writeFileSync(LOCAL_LOGS_FILE, JSON.stringify(trimmed, null, 2), "utf8");
    memoryLogsCache = trimmed;
  } catch (_) {}
}

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
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink Futures',
        price DECIMAL,
        change_percent DECIMAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nse_symbol, signal_type, trading_date)
      );
    `;

    try {
      await sql`ALTER TABLE new_trick_gap_signals ADD COLUMN IF NOT EXISTS price DECIMAL;`;
      await sql`ALTER TABLE new_trick_gap_signals ADD COLUMN IF NOT EXISTS change_percent DECIMAL;`;
    } catch (_) {}

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
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink Futures',
        error_message TEXT,
        details JSONB
      );
    `;

    dbInitialized = true;
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB table check skipped/offline (using local fallback store):", err.message);
  }
}

/**
 * Save gap signals to database with duplicate prevention & resilient local backup
 */
export async function saveGapSignals(signals: GapSignalRecord[]): Promise<number> {
  if (!signals || signals.length === 0) return 0;

  // 1. Always save to resilient local storage first so data is never lost
  saveLocalSignals(signals);

  // 2. Attempt Neon DB insert
  let insertedCount = 0;
  try {
    await initNewTrickDB();
    for (const s of signals) {
      try {
        await sql`
          INSERT INTO new_trick_gap_signals (
            company_name, nse_symbol, signal_type,
            prev_day_high, prev_day_low, first_candle_high, first_candle_low,
            trading_date, candle_time, status, data_source,
            price, change_percent
          ) VALUES (
            ${s.company_name}, ${s.nse_symbol}, ${s.signal_type},
            ${s.prev_day_high ?? null}, ${s.prev_day_low ?? null},
            ${s.first_candle_high ?? null}, ${s.first_candle_low ?? null},
            ${s.trading_date}, ${s.candle_time || '09:15 - 09:30 AM'},
            ${s.status || 'CONFIRMED'}, ${s.data_source || 'Chartink Futures'},
            ${s.price ?? null}, ${s.change_percent ?? null}
          )
          ON CONFLICT (nse_symbol, signal_type, trading_date)
          DO UPDATE SET
            company_name = EXCLUDED.company_name,
            prev_day_high = COALESCE(EXCLUDED.prev_day_high, new_trick_gap_signals.prev_day_high),
            prev_day_low = COALESCE(EXCLUDED.prev_day_low, new_trick_gap_signals.prev_day_low),
            first_candle_high = COALESCE(EXCLUDED.first_candle_high, new_trick_gap_signals.first_candle_high),
            first_candle_low = COALESCE(EXCLUDED.first_candle_low, new_trick_gap_signals.first_candle_low),
            price = COALESCE(EXCLUDED.price, new_trick_gap_signals.price),
            change_percent = COALESCE(EXCLUDED.change_percent, new_trick_gap_signals.change_percent),
            scan_time = CURRENT_TIMESTAMP;
        `;
        insertedCount++;
      } catch (e: any) {
        console.warn(`[NEW-TRICK-DB] Warning inserting ${s.nse_symbol} (${s.signal_type}):`, e.message);
      }
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB insert failed (saved to local backup):", err.message);
  }

  return signals.length;
}

/**
 * Log scan execution
 */
export async function logScanExecution(log: ScanLogRecord): Promise<void> {
  // Always save locally first
  saveLocalLog(log);

  try {
    await initNewTrickDB();
    await sql`
      INSERT INTO new_trick_scan_logs (
        scan_type, trading_date, status,
        gap_up_count, gap_down_count, data_source,
        error_message, details
      ) VALUES (
        ${log.scan_type}, ${log.trading_date}, ${log.status},
        ${log.gap_up_count}, ${log.gap_down_count}, ${log.data_source || 'Chartink Futures'},
        ${log.error_message || null}, ${JSON.stringify(log.details || {})}
      );
    `;
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Error logging to Neon DB (saved locally):", err.message);
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
  let rows: GapSignalRecord[] = [];
  let targetDate: string = params.date || "";

  // 1. Try Neon DB
  try {
    await initNewTrickDB();
    if (!targetDate) {
      const latestRow = await sql`
        SELECT trading_date FROM new_trick_gap_signals 
        ORDER BY trading_date DESC LIMIT 1
      `;
      if (latestRow.length > 0) {
        targetDate = latestRow[0].trading_date;
      }
    }

    if (targetDate) {
      const dbRows = await sql`
        SELECT 
          id, company_name, nse_symbol, signal_type,
          prev_day_high, prev_day_low, first_candle_high, first_candle_low,
          trading_date, candle_time, scan_time, status, data_source,
          price, change_percent
        FROM new_trick_gap_signals
        WHERE trading_date = ${targetDate}
        ORDER BY id ASC;
      `;
      if (dbRows && dbRows.length > 0) {
        rows = dbRows as GapSignalRecord[];
      }
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB read failed, falling back to local file store:", err.message);
  }

  // 2. If Neon DB returned no rows or is offline, use local backup store
  if (rows.length === 0) {
    const localSignals = loadLocalSignals();
    if (localSignals.length > 0) {
      if (!targetDate) {
        // Find latest date in local signals
        const dates = [...new Set(localSignals.map(s => s.trading_date))].sort().reverse();
        targetDate = dates[0] || "";
      }
      rows = localSignals.filter(s => s.trading_date === targetDate);
    }
  }

  if (!targetDate) {
    const now = new Date();
    targetDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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
  try {
    await initNewTrickDB();
    const rows = await sql`
      SELECT DISTINCT trading_date FROM new_trick_gap_signals
      ORDER BY trading_date DESC
      LIMIT 60;
    `;
    if (rows && rows.length > 0) {
      return rows.map((r: any) => r.trading_date);
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB dates query failed, using local dates:", err.message);
  }

  const localSignals = loadLocalSignals();
  const dates = [...new Set(localSignals.map(s => s.trading_date))].sort().reverse();
  return dates.slice(0, 60);
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
  errorMessage: string | null;
}> {
  const nextScheduled = computeNextScheduledTime();

  // 1. Try Neon DB
  try {
    await initNewTrickDB();
    const latestLog = await sql`
      SELECT scan_time, status, gap_up_count, gap_down_count, trading_date, data_source, error_message
      FROM new_trick_scan_logs
      ORDER BY id DESC LIMIT 1;
    `;

    if (latestLog && latestLog.length > 0) {
      const log = latestLog[0];
      return {
        lastScanTime: log.scan_time,
        lastScanStatus: log.status,
        nextScheduledScan: nextScheduled,
        totalUpToday: log.gap_up_count,
        totalDownToday: log.gap_down_count,
        latestTradingDate: log.trading_date,
        dataSource: log.data_source || "Chartink Futures",
        errorMessage: log.error_message || null,
      };
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB log query failed, using local log:", err.message);
  }

  // 2. Fallback to local logs
  const localLogs = loadLocalLogs();
  if (localLogs.length > 0) {
    const log = localLogs[0];
    return {
      lastScanTime: log.scan_time || null,
      lastScanStatus: log.status,
      nextScheduledScan: nextScheduled,
      totalUpToday: log.gap_up_count,
      totalDownToday: log.gap_down_count,
      latestTradingDate: log.trading_date,
      dataSource: log.data_source || "Chartink Futures",
      errorMessage: log.error_message || null,
    };
  }

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return {
    lastScanTime: null,
    lastScanStatus: "READY",
    nextScheduledScan: nextScheduled,
    totalUpToday: 0,
    totalDownToday: 0,
    latestTradingDate: todayIST,
    dataSource: "Chartink Futures",
    errorMessage: null,
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

  if (weekday === "Fri" || weekday === "Sat" || weekday === "Sun") {
    return "Monday at 09:31 AM IST";
  }

  return "Tomorrow at 09:31 AM IST";
}
