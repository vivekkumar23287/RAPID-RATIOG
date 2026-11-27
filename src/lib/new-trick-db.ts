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

export interface ThreeCandleGapRecord {
  id?: number;
  company_name: string;
  nse_symbol: string;
  direction: "BULLISH" | "BEARISH";
  timeframe: "15m" | "1h";
  candle3_close_time: string; // e.g. "09:45 AM"
  trading_date: string; // YYYY-MM-DD
  added_at?: string; // e.g. "09:46 AM"
  scan_time?: string;
  status?: string;
  data_source?: string;
  price?: number | null;
  change_percent?: number | null;
  is_new?: boolean;
}

export interface Trick2SnapshotData {
  tradingDate: string;
  updatedAt: string;
  m15Up: ThreeCandleGapRecord[];
  m15Down: ThreeCandleGapRecord[];
  h1Up: ThreeCandleGapRecord[];
  h1Down: ThreeCandleGapRecord[];
  status?: {
    m15Up: "SUCCESS" | "STALE" | "FAILED";
    m15Down: "SUCCESS" | "STALE" | "FAILED";
    h1Up: "SUCCESS" | "STALE" | "FAILED";
    h1Down: "SUCCESS" | "STALE" | "FAILED";
  };
}

export interface ScanLogRecord {
  id?: number;
  scan_type: string;
  trading_date: string;
  scan_time?: string;
  status: "SUCCESS" | "RETRYING" | "FAILED" | "MARKET_CLOSED" | "PARTIAL";
  gap_up_count: number;
  gap_down_count: number;
  data_source?: string;
  error_message?: string | null;
  details?: Record<string, any> | null;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "data");
const LOCAL_SIGNALS_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_gap_signals.json");
const LOCAL_3C_SIGNALS_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_3c_signals.json");
const LOCAL_3C_CURRENT_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_3c_current.json");
const LOCAL_LOGS_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_scan_logs.json");

// In-memory cache for ultra-fast access
let memorySignalsCache: GapSignalRecord[] = [];
let memory3CSignalsCache: ThreeCandleGapRecord[] = [];
let memory3CCurrentCache: ThreeCandleGapRecord[] = [];
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

function loadLocal3CSignals(): ThreeCandleGapRecord[] {
  ensureLocalDir();
  try {
    if (fs.existsSync(LOCAL_3C_SIGNALS_FILE)) {
      const raw = fs.readFileSync(LOCAL_3C_SIGNALS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error reading local 3C signals:", e.message);
  }
  return [];
}

export function loadCurrent3CSnapshot(): Trick2SnapshotData | null {
  ensureLocalDir();
  try {
    if (fs.existsSync(LOCAL_3C_CURRENT_FILE)) {
      const raw = fs.readFileSync(LOCAL_3C_CURRENT_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.tradingDate) {
        return parsed as Trick2SnapshotData;
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          tradingDate: parsed[0].trading_date,
          updatedAt: new Date().toISOString(),
          m15Up: parsed.filter((r: any) => r.timeframe === "15m" && r.direction === "BULLISH"),
          m15Down: parsed.filter((r: any) => r.timeframe === "15m" && r.direction === "BEARISH"),
          h1Up: parsed.filter((r: any) => r.timeframe === "1h" && r.direction === "BULLISH"),
          h1Down: parsed.filter((r: any) => r.timeframe === "1h" && r.direction === "BEARISH"),
          status: {
            m15Up: "SUCCESS",
            m15Down: "SUCCESS",
            h1Up: "SUCCESS",
            h1Down: "SUCCESS",
          },
        };
      }
    }
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error reading current 3C snapshot:", e.message);
  }
  return null;
}

export function loadCurrent3CSignals(): ThreeCandleGapRecord[] {
  const snapshot = loadCurrent3CSnapshot();
  if (snapshot) {
    return [
      ...(snapshot.m15Up || []),
      ...(snapshot.m15Down || []),
      ...(snapshot.h1Up || []),
      ...(snapshot.h1Down || []),
    ];
  }
  return [];
}

export async function save3CCurrentSnapshot(snapshot: Trick2SnapshotData): Promise<void> {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_3C_CURRENT_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error writing current 3C snapshot:", e.message);
  }

  // Also preserve all detected signals in cumulative historical local store
  const allRecords = [
    ...(snapshot.m15Up || []),
    ...(snapshot.m15Down || []),
    ...(snapshot.h1Up || []),
    ...(snapshot.h1Down || []),
  ];
  if (allRecords.length > 0) {
    saveLocal3CSignals(allRecords);
  }

  // Persist to Neon DB
  try {
    await initNewTrickDB();
    const scannerDatasets = [
      { id: "bullish15m", records: snapshot.m15Up || [] },
      { id: "bearish15m", records: snapshot.m15Down || [] },
      { id: "bullish1h", records: snapshot.h1Up || [] },
      { id: "bearish1h", records: snapshot.h1Down || [] },
    ];

    for (const sc of scannerDatasets) {
      if (sc.records.length > 0) {
        try {
          await sql`
            DELETE FROM new_trick_3c_current
            WHERE scanner_id = ${sc.id} AND trading_date = ${snapshot.tradingDate};
          `;
        } catch (_) {}

        for (const r of sc.records) {
          try {
            await sql`
              INSERT INTO new_trick_3c_current (
                scanner_id, company_name, nse_symbol, direction, timeframe,
                trading_date, candle3_close_time, status, data_source, price, change_percent
              ) VALUES (
                ${sc.id}, ${r.company_name}, ${r.nse_symbol}, ${r.direction}, ${r.timeframe},
                ${r.trading_date}, ${r.candle3_close_time}, 'CURRENT', 'Chartink Futures',
                ${r.price ?? null}, ${r.change_percent ?? null}
              )
              ON CONFLICT (scanner_id, nse_symbol, trading_date)
              DO UPDATE SET
                company_name = EXCLUDED.company_name,
                price = EXCLUDED.price,
                change_percent = EXCLUDED.change_percent,
                updated_at = CURRENT_TIMESTAMP;
            `;
          } catch (_) {}
        }
      }
    }

    // Cumulative historical insert
    for (const r of allRecords) {
      try {
        await sql`
          INSERT INTO new_trick_3c_signals (
            company_name, nse_symbol, direction, timeframe, candle3_close_time,
            trading_date, added_at, status, data_source, price, change_percent
          ) VALUES (
            ${r.company_name}, ${r.nse_symbol}, ${r.direction}, ${r.timeframe}, ${r.candle3_close_time},
            ${r.trading_date}, ${r.added_at}, ${r.status || 'CONFIRMED'}, ${r.data_source || 'Chartink Futures'},
            ${r.price ?? null}, ${r.change_percent ?? null}
          )
          ON CONFLICT (nse_symbol, direction, timeframe, candle3_close_time, trading_date)
          DO UPDATE SET
            company_name = EXCLUDED.company_name,
            price = COALESCE(EXCLUDED.price, new_trick_3c_signals.price),
            change_percent = COALESCE(EXCLUDED.change_percent, new_trick_3c_signals.change_percent),
            scan_time = CURRENT_TIMESTAMP;
        `;
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB 3C snapshot sync error (saved locally):", err.message);
  }
}

function saveCurrent3CSignals(signals: ThreeCandleGapRecord[]) {
  ensureLocalDir();
  try {
    fs.writeFileSync(LOCAL_3C_CURRENT_FILE, JSON.stringify(signals, null, 2), "utf8");
    memory3CCurrentCache = signals;
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error writing current 3C signals:", e.message);
  }
}

function saveLocal3CSignals(signals: ThreeCandleGapRecord[]) {
  ensureLocalDir();
  try {
    const existing = loadLocal3CSignals();
    const seen = new Set<string>();
    const combined: ThreeCandleGapRecord[] = [];

    for (const s of [...signals, ...existing]) {
      const key = `${s.nse_symbol}|${s.direction}|${s.timeframe}|${s.candle3_close_time}|${s.trading_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(s);
      }
    }

    fs.writeFileSync(LOCAL_3C_SIGNALS_FILE, JSON.stringify(combined, null, 2), "utf8");
    memory3CSignalsCache = combined;
  } catch (e: any) {
    console.warn("[NEW-TRICK-LOCAL] Error writing local 3C signals:", e.message);
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
    // Trick 1: Gap Up & Gap Down table
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

    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_date ON new_trick_gap_signals(trading_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_symbol ON new_trick_gap_signals(nse_symbol);`;

    // Trick 2: 3-Candle Gap table
    await sql`
      CREATE TABLE IF NOT EXISTS new_trick_3c_signals (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        nse_symbol TEXT NOT NULL,
        direction VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        candle3_close_time VARCHAR(50) NOT NULL,
        trading_date VARCHAR(20) NOT NULL,
        added_at VARCHAR(30),
        scan_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink Futures',
        price DECIMAL,
        change_percent DECIMAL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nse_symbol, direction, timeframe, candle3_close_time, trading_date)
      );
    `;

    try {
      await sql`ALTER TABLE new_trick_3c_signals ADD COLUMN IF NOT EXISTS added_at VARCHAR(30);`;
    } catch (_) {}

    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_3c_date ON new_trick_3c_signals(trading_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_3c_tf ON new_trick_3c_signals(timeframe, direction);`;

    // Trick 2: Current active snapshot table
    await sql`
      CREATE TABLE IF NOT EXISTS new_trick_3c_current (
        id SERIAL PRIMARY KEY,
        scanner_id VARCHAR(30) NOT NULL,
        company_name TEXT NOT NULL,
        nse_symbol TEXT NOT NULL,
        direction VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        trading_date VARCHAR(20) NOT NULL,
        candle3_close_time VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'CURRENT',
        data_source VARCHAR(50) NOT NULL DEFAULT 'Chartink Futures',
        price DECIMAL,
        change_percent DECIMAL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(scanner_id, nse_symbol, trading_date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_3c_cur_date ON new_trick_3c_current(trading_date, scanner_id);`;

    // Scan logs table
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
 * Save Trick 1 gap signals to database with duplicate prevention & resilient local backup
 */
export async function saveGapSignals(signals: GapSignalRecord[]): Promise<number> {
  if (!signals || signals.length === 0) return 0;

  // 1. Always save to resilient local storage first so data is never lost
  saveLocalSignals(signals);

  // 2. Attempt Neon DB insert
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
 * Save Trick 2 3-Candle Gap signals to database with duplicate prevention & resilient local backup
 */
export async function save3CGapSignals(signals: ThreeCandleGapRecord[]): Promise<number> {
  if (!signals || signals.length === 0) return 0;

  // Format Added At in IST if not present
  const nowIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  const processedSignals = signals.map(s => ({
    ...s,
    added_at: s.added_at || nowIST
  }));

  // 1. Save to cumulative historical storage
  saveLocal3CSignals(processedSignals);

  // 2. Save to current verified snapshot view
  saveCurrent3CSignals(processedSignals);

  // 2. Attempt Neon DB insert
  try {
    await initNewTrickDB();
    for (const s of processedSignals) {
      try {
        await sql`
          INSERT INTO new_trick_3c_signals (
            company_name, nse_symbol, direction, timeframe, candle3_close_time,
            trading_date, added_at, status, data_source, price, change_percent
          ) VALUES (
            ${s.company_name}, ${s.nse_symbol}, ${s.direction}, ${s.timeframe}, ${s.candle3_close_time},
            ${s.trading_date}, ${s.added_at}, ${s.status || 'CONFIRMED'}, ${s.data_source || 'Chartink Futures'},
            ${s.price ?? null}, ${s.change_percent ?? null}
          )
          ON CONFLICT (nse_symbol, direction, timeframe, candle3_close_time, trading_date)
          DO UPDATE SET
            company_name = EXCLUDED.company_name,
            price = COALESCE(EXCLUDED.price, new_trick_3c_signals.price),
            change_percent = COALESCE(EXCLUDED.change_percent, new_trick_3c_signals.change_percent),
            scan_time = CURRENT_TIMESTAMP;
        `;
      } catch (e: any) {
        console.warn(`[NEW-TRICK-DB] Warning inserting 3C ${s.nse_symbol} (${s.timeframe} ${s.direction}):`, e.message);
      }
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB 3C insert failed (saved to local backup):", err.message);
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
 * Fetch Trick 1 gap signals
 */
export async function getGapSignals(params: {
  date?: string;
  signalType?: "GAP_UP" | "GAP_DOWN" | "ALL";
  search?: string;
}): Promise<{
  date: string;
  isToday: boolean;
  isPending: boolean;
  gapUps: GapSignalRecord[];
  gapDowns: GapSignalRecord[];
  totalUp: number;
  totalDown: number;
}> {
  let rows: GapSignalRecord[] = [];
  // Calculate today in Asia/Kolkata
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const targetDate: string = params.date || todayIST;
  const isToday = targetDate === todayIST;

  // 1. Try Neon DB
  try {
    await initNewTrickDB();
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
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB read failed, falling back to local file store:", err.message);
  }

  // 2. Fallback to local backup store strictly for targetDate
  if (rows.length === 0) {
    const localSignals = loadLocalSignals();
    if (localSignals.length > 0) {
      rows = localSignals.filter(s => s.trading_date === targetDate);
    }
  }

  // Determine if today's scan is pending
  const isPending = isToday && rows.length === 0;

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
    isToday,
    isPending,
    gapUps,
    gapDowns,
    totalUp: gapUps.length,
    totalDown: gapDowns.length,
  };
}

/**
 * Fetch Trick 2: 3-Candle Gap signals (15m Up/Down, 1h Up/Down)
 * Returns the current active snapshot of qualifying companies matching the latest Chartink scan,
 * while preserving historical signals in cumulative storage.
 */
export async function get3CGapSignals(params: {
  date?: string;
}): Promise<{
  date: string;
  isToday: boolean;
  isPending: boolean;
  m15Up: ThreeCandleGapRecord[];
  m15Down: ThreeCandleGapRecord[];
  h1Up: ThreeCandleGapRecord[];
  h1Down: ThreeCandleGapRecord[];
}> {
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const targetDate: string = params.date || todayIST;
  const isToday = targetDate === todayIST;

  // 1. Check current verified snapshot first
  const currentSnapshot = loadCurrent3CSnapshot();
  if (currentSnapshot && currentSnapshot.tradingDate === targetDate) {
    const isPending = isToday && (
      (currentSnapshot.m15Up?.length || 0) +
      (currentSnapshot.m15Down?.length || 0) +
      (currentSnapshot.h1Up?.length || 0) +
      (currentSnapshot.h1Down?.length || 0) === 0
    );
    return {
      date: targetDate,
      isToday,
      isPending,
      m15Up: currentSnapshot.m15Up || [],
      m15Down: currentSnapshot.m15Down || [],
      h1Up: currentSnapshot.h1Up || [],
      h1Down: currentSnapshot.h1Down || [],
    };
  }

  // 2. If not in local snapshot file, check Neon DB new_trick_3c_current
  try {
    await initNewTrickDB();
    const curRows = await sql`
      SELECT company_name, nse_symbol, direction, timeframe, candle3_close_time,
             trading_date, price, change_percent, scanner_id
      FROM new_trick_3c_current
      WHERE trading_date = ${targetDate}
      ORDER BY id ASC;
    `;
    if (curRows && curRows.length > 0) {
      const m15Up = (curRows as any[]).filter(r => r.scanner_id === "bullish15m");
      const m15Down = (curRows as any[]).filter(r => r.scanner_id === "bearish15m");
      const h1Up = (curRows as any[]).filter(r => r.scanner_id === "bullish1h");
      const h1Down = (curRows as any[]).filter(r => r.scanner_id === "bearish1h");

      return {
        date: targetDate,
        isToday,
        isPending: false,
        m15Up,
        m15Down,
        h1Up,
        h1Down,
      };
    }
  } catch (err: any) {
    console.warn("[NEW-TRICK-DB] Neon DB current 3C read failed:", err.message);
  }

  // 3. Fallback to cumulative records (for historical dates)
  let rows: ThreeCandleGapRecord[] = [];
  try {
    await initNewTrickDB();
    const dbRows = await sql`
      SELECT 
        id, company_name, nse_symbol, direction, timeframe, candle3_close_time,
        trading_date, added_at, scan_time, status, data_source, price, change_percent
      FROM new_trick_3c_signals
      WHERE trading_date = ${targetDate}
      ORDER BY id DESC;
    `;
    if (dbRows && dbRows.length > 0) {
      rows = dbRows as ThreeCandleGapRecord[];
    }
  } catch (_) {}

  if (rows.length === 0) {
    const local = loadLocal3CSignals();
    if (local.length > 0) {
      rows = local.filter(s => s.trading_date === targetDate);
    }
  }

  const isPending = isToday && rows.length === 0;

  // Group by category, deduplicated by symbol
  const filterByTfAndDir = (tf: "15m" | "1h", dir: "BULLISH" | "BEARISH") => {
    const matched = rows.filter(r => r.timeframe === tf && r.direction === dir);
    const seen = new Set<string>();
    const res: ThreeCandleGapRecord[] = [];
    for (const item of matched) {
      if (!seen.has(item.nse_symbol)) {
        seen.add(item.nse_symbol);
        res.push(item);
      }
    }
    return res;
  };

  const m15Up = filterByTfAndDir("15m", "BULLISH");
  const m15Down = filterByTfAndDir("15m", "BEARISH");
  const h1Up = filterByTfAndDir("1h", "BULLISH");
  const h1Down = filterByTfAndDir("1h", "BEARISH");

  return {
    date: targetDate,
    isToday,
    isPending,
    m15Up,
    m15Down,
    h1Up,
    h1Down,
  };
}

/**
 * Get distinct available trading dates
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
