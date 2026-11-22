import { sql } from "@/lib/db";

interface MemoryCacheEntry {
  data: any;
  timestamp: number;
}

// In-memory cache to eliminate repeated DB roundtrips for the same scanner data
const serverMemoryStore = new Map<string, MemoryCacheEntry>();
const MEMORY_CACHE_TTL_MS = 30000; // 30 seconds

export function getMemoryScannerCache(scannerType: string): any | null {
  const entry = serverMemoryStore.get(scannerType);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MEMORY_CACHE_TTL_MS) {
    return entry.data; // Return stale data while revalidating
  }
  return entry.data;
}

export function setMemoryScannerCache(scannerType: string, data: any): void {
  serverMemoryStore.set(scannerType, { data, timestamp: Date.now() });
}

/**
 * Retrieve saved pre-calculated scanner data from PostgreSQL / Neon DB (scanner_cache table).
 * Ensures ZERO calculations run on the website when visitors load pages.
 */
export async function getSavedScannerFromDB(scannerType: string, dateStr?: string): Promise<any | null> {
  // 1. Fast path: server memory cache
  const mem = getMemoryScannerCache(scannerType);
  if (mem) return mem;

  // 2. Database path: fetch saved results from Neon DB
  try {
    if (dateStr) {
      const todayRows = await sql`
        SELECT results FROM scanner_cache 
        WHERE scanner_type = ${scannerType} AND date_str = ${dateStr}
        LIMIT 1
      `;
      if (todayRows.length > 0 && todayRows[0].results) {
        setMemoryScannerCache(scannerType, todayRows[0].results);
        return todayRows[0].results;
      }
    }

    // Fallback: get the most recent saved calculation from scanner_cache
    const latestRows = await sql`
      SELECT results FROM scanner_cache 
      WHERE scanner_type = ${scannerType}
      ORDER BY id DESC LIMIT 1
    `;
    if (latestRows.length > 0 && latestRows[0].results) {
      setMemoryScannerCache(scannerType, latestRows[0].results);
      return latestRows[0].results;
    }
  } catch (err: any) {
    console.warn(`[SERVER-CACHE] DB read warning for ${scannerType}:`, err.message);
  }

  return null;
}

/**
 * Save pre-calculated scanner results to PostgreSQL / Neon DB (scanner_cache table).
 */
export async function saveScannerToDB(scannerType: string, dateStr: string, results: any): Promise<void> {
  setMemoryScannerCache(scannerType, results);
  try {
    await sql`
      INSERT INTO scanner_cache (date_str, scanner_type, results)
      VALUES (${dateStr}, ${scannerType}, ${JSON.stringify(results)})
      ON CONFLICT (date_str, scanner_type) 
      DO UPDATE SET results = EXCLUDED.results
    `;
  } catch (err: any) {
    console.warn(`[SERVER-CACHE] DB write error for ${scannerType}:`, err.message);
  }
}
