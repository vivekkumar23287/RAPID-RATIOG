import { sql } from "@/lib/db";
import fs from "fs";
import path from "path";
import { SMCSignal, analyzeSMC } from "./smc-engine";

export interface SMCDbRecord {
  id?: number;
  company_name: string;
  nse_symbol: string;
  signal_type: string;
  direction: "BULLISH" | "BEARISH";
  category: "BOS" | "CHoCH" | "FVG" | "OB" | "LIQUIDITY";
  timeframe: string;
  price: number;
  candle_timestamp: number;
  trading_date: string;
  added_at: string;
  status: string;
  details?: Record<string, any>;
}

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "data");
const LOCAL_SMC_FILE = path.join(LOCAL_STORAGE_DIR, "new_trick_smc_signals.json");

function ensureDir() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

export function loadLocalSMCSignals(): SMCDbRecord[] {
  ensureDir();
  try {
    if (fs.existsSync(LOCAL_SMC_FILE)) {
      const raw = fs.readFileSync(LOCAL_SMC_FILE, "utf8");
      return JSON.parse(raw) || [];
    }
  } catch (_) {}
  return [];
}

export function saveLocalSMCSignals(signals: SMCDbRecord[]) {
  ensureDir();
  try {
    const existing = loadLocalSMCSignals();
    const seen = new Set<string>();
    const combined: SMCDbRecord[] = [];

    for (const s of [...signals, ...existing]) {
      const key = `${s.nse_symbol}|${s.timeframe}|${s.signal_type}|${s.direction}|${s.candle_timestamp}|${s.trading_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(s);
      }
    }

    fs.writeFileSync(LOCAL_SMC_FILE, JSON.stringify(combined, null, 2), "utf8");
  } catch (_) {}
}

export async function initSMCDB(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS new_trick_smc_signals (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        nse_symbol TEXT NOT NULL,
        signal_type VARCHAR(50) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        category VARCHAR(30) NOT NULL,
        timeframe VARCHAR(10) NOT NULL,
        price DECIMAL NOT NULL,
        candle_timestamp BIGINT NOT NULL,
        trading_date VARCHAR(20) NOT NULL,
        added_at VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(nse_symbol, timeframe, signal_type, direction, candle_timestamp, trading_date)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_smc_date ON new_trick_smc_signals(trading_date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_new_trick_smc_sym ON new_trick_smc_signals(nse_symbol);`;
  } catch (e: any) {
    console.warn("[SMC-DB] Table init warning:", e.message);
  }
}

export async function saveSMCSignals(signals: SMCDbRecord[]): Promise<number> {
  if (!signals || signals.length === 0) return 0;
  saveLocalSMCSignals(signals);

  try {
    await initSMCDB();
    for (const s of signals) {
      try {
        await sql`
          INSERT INTO new_trick_smc_signals (
            company_name, nse_symbol, signal_type, direction, category, timeframe,
            price, candle_timestamp, trading_date, added_at, status, details
          ) VALUES (
            ${s.company_name}, ${s.nse_symbol}, ${s.signal_type}, ${s.direction}, ${s.category},
            ${s.timeframe}, ${s.price}, ${s.candle_timestamp}, ${s.trading_date}, ${s.added_at},
            ${s.status || 'CONFIRMED'}, ${JSON.stringify(s.details || {})}
          )
          ON CONFLICT (nse_symbol, timeframe, signal_type, direction, candle_timestamp, trading_date)
          DO UPDATE SET
            company_name = EXCLUDED.company_name,
            price = EXCLUDED.price;
        `;
      } catch (_) {}
    }
  } catch (err: any) {
    console.warn("[SMC-DB] Save error:", err.message);
  }

  return signals.length;
}

export async function getSMCSignals(params: {
  date?: string;
  timeframe?: string;
  direction?: string;
  category?: string;
}): Promise<{
  date: string;
  signals: SMCDbRecord[];
}> {
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const targetDate = params.date || todayIST;
  let rows: SMCDbRecord[] = [];

  try {
    await initSMCDB();
    const dbRows = await sql`
      SELECT 
        id, company_name, nse_symbol, signal_type, direction, category,
        timeframe, price, candle_timestamp, trading_date, added_at, status, details
      FROM new_trick_smc_signals
      WHERE trading_date = ${targetDate}
      ORDER BY id DESC;
    `;
    if (dbRows && dbRows.length > 0) {
      rows = dbRows as SMCDbRecord[];
    }
  } catch (_) {}

  if (rows.length === 0) {
    const local = loadLocalSMCSignals();
    rows = local.filter(s => s.trading_date === targetDate);
  }

  // Apply filters
  if (params.timeframe && params.timeframe !== "ALL") {
    rows = rows.filter(r => r.timeframe === params.timeframe);
  }
  if (params.direction && params.direction !== "ALL") {
    rows = rows.filter(r => r.direction === params.direction);
  }
  if (params.category && params.category !== "ALL") {
    rows = rows.filter(r => r.category === params.category);
  }

  return { date: targetDate, signals: rows };
}
