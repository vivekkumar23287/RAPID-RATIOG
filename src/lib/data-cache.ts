/**
 * data-cache.ts
 *
 * Client-side in-memory cache and prefetching engine.
 * Eliminates redundant network requests, powers instant page transitions,
 * and coordinates initial application loading readiness.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Default cache TTLs (in milliseconds)
const TTL_BATCH_PRICES = 15000;   // 15 seconds for live stock quotes
const TTL_STOCK_DATA   = 30000;   // 30 seconds for candle data
const TTL_TRICKS_DATA  = 120000;  // 2 minutes for sheet tricks

export function getFromCache<T>(key: string, maxAgeMs: number = TTL_BATCH_PRICES): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    return entry.data; // Return stale data for instant display while revalidating
  }
  return entry.data;
}

export function isCacheFresh(key: string, maxAgeMs: number = TTL_BATCH_PRICES): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp <= maxAgeMs;
}

export function saveToCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

// ── Application Readiness Coordination ──────────────────────────────────────────

let isReady = false;
const readyCallbacks: Array<() => void> = [];

export function markAppReady(): void {
  if (isReady) return;
  isReady = true;
  if (typeof window !== "undefined") {
    (window as any).__RAPID_APP_READY__ = true;
    window.dispatchEvent(new CustomEvent("rapid:app-ready"));
  }
  readyCallbacks.forEach((cb) => {
    try { cb(); } catch (e) { console.warn("Ready callback error:", e); }
  });
  readyCallbacks.length = 0;
}

export function onAppReady(callback: () => void): () => void {
  if (isReady || (typeof window !== "undefined" && (window as any).__RAPID_APP_READY__)) {
    callback();
    return () => {};
  }
  readyCallbacks.push(callback);
  const handler = () => callback();
  if (typeof window !== "undefined") {
    window.addEventListener("rapid:app-ready", handler, { once: true });
  }
  return () => {
    const idx = readyCallbacks.indexOf(callback);
    if (idx !== -1) readyCallbacks.splice(idx, 1);
    if (typeof window !== "undefined") {
      window.removeEventListener("rapid:app-ready", handler);
    }
  };
}

export function isAppReady(): boolean {
  return isReady || (typeof window !== "undefined" && Boolean((window as any).__RAPID_APP_READY__));
}

// ── Prefetching & Cached Fetch Utilities ───────────────────────────────────────

/**
 * Fetch batch prices with in-memory caching and stale-while-revalidate
 */
export async function fetchBatchPricesCached(
  symbols: string[],
  forceFresh: boolean = false
): Promise<Record<string, { currentPrice: number; change: number; changePercent: number }>> {
  const sortedSymbols = [...symbols].sort();
  const cacheKey = `batch_prices_${sortedSymbols.join(",")}`;

  if (!forceFresh) {
    const cached = getFromCache<Record<string, any>>(cacheKey, TTL_BATCH_PRICES);
    if (cached && isCacheFresh(cacheKey, TTL_BATCH_PRICES)) {
      return cached;
    }
  }

  try {
    const encoded = encodeURIComponent(symbols.join(","));
    const res = await fetch(`/api/batch-prices?symbols=${encoded}`);
    if (res.ok) {
      const data = await res.json();
      saveToCache(cacheKey, data);
      // Also cache individual symbols for fine-grained lookup
      Object.entries(data).forEach(([sym, val]) => {
        saveToCache(`price_${sym.toUpperCase()}`, val);
      });
      return data;
    }
  } catch (err) {
    console.warn("[data-cache] Batch prices fetch error:", err);
  }

  // Return stale if available
  const stale = getFromCache<Record<string, any>>(cacheKey, 3600000);
  return stale || {};
}

/**
 * Fetch and cache stock candle chart data
 */
export async function fetchStockDataCached(
  symbol: string,
  range: string = "1y",
  interval: string = "1d",
  dateParam?: string
): Promise<any> {
  const upper = symbol.toUpperCase();
  const cacheKey = `stock_data_${upper}_${range}_${interval}_${dateParam || ""}`;

  const cached = getFromCache<any>(cacheKey, TTL_STOCK_DATA);
  if (cached && isCacheFresh(cacheKey, TTL_STOCK_DATA)) {
    return cached;
  }

  try {
    const dParam = dateParam ? `&date=${dateParam}` : "";
    const res = await fetch(`/api/stock-data?symbol=${encodeURIComponent(upper)}&range=${range}&interval=${interval}${dParam}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        saveToCache(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`[data-cache] Stock data fetch error for ${upper}:`, err);
  }

  return cached || null;
}

/**
 * Fetch and cache sheet tricks data
 */
export async function fetchTricksDataCached(forceFresh: boolean = false): Promise<any> {
  const cacheKey = "tricks_export_data";

  if (!forceFresh) {
    const cached = getFromCache<any>(cacheKey, TTL_TRICKS_DATA);
    if (cached && isCacheFresh(cacheKey, TTL_TRICKS_DATA)) {
      return cached;
    }
  }

  try {
    const url = forceFresh ? "/api/export-tricks?format=json&sync=true" : "/api/export-tricks?format=json";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      saveToCache(cacheKey, data);
      return data;
    }
  } catch (err) {
    console.warn("[data-cache] Tricks data fetch error:", err);
  }

  return getFromCache<any>(cacheKey, 3600000) || null;
}

// ── Smart Prefetch Actions ───────────────────────────────────────────────────

let isNiftyPrefetching = false;
export function prefetchAllNiftyPrices(): void {
  if (isNiftyPrefetching) return;
  const cacheKey = "batch_prices_all_nifty";
  if (isCacheFresh(cacheKey, TTL_BATCH_PRICES)) return;

  isNiftyPrefetching = true;
  import("./stocks").then(({ NIFTY_50_STOCKS }) => {
    const symbols = NIFTY_50_STOCKS.map((s) => s.symbol);
    fetchBatchPricesCached(symbols).finally(() => {
      isNiftyPrefetching = false;
    });
  }).catch(() => {
    isNiftyPrefetching = false;
  });
}

export function prefetchStockCandles(symbol: string): void {
  if (!symbol) return;
  const upper = symbol.toUpperCase();
  const cacheKey = `stock_data_${upper}_1y_1d_`;
  if (isCacheFresh(cacheKey, TTL_STOCK_DATA)) return;

  // Background fetch
  fetchStockDataCached(upper, "1y", "1d");
}

export function prefetchSheetTricks(): void {
  const cacheKey = "tricks_export_data";
  if (isCacheFresh(cacheKey, TTL_TRICKS_DATA)) return;
  fetchTricksDataCached();
}

// ── Tricks Page Scanner Prefetch & Cache ─────────────────────────────────────

const TTL_TRICKS_PAGE = 30000; // 30s cache for Tricks scanner results

export function getCachedTricksPage(): any | null {
  return getFromCache<any>("tricks_page_data", 3600000);
}

export async function fetchTricksPageCached(forceFresh: boolean = false): Promise<any> {
  const cacheKey = "tricks_page_data";

  if (!forceFresh) {
    const cached = getFromCache<any>(cacheKey, TTL_TRICKS_PAGE);
    if (cached && isCacheFresh(cacheKey, TTL_TRICKS_PAGE)) {
      return cached;
    }
  }

  try {
    const url = forceFresh ? "/api/tricks?sync=true" : "/api/tricks";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        saveToCache(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    console.warn("[data-cache] Tricks page fetch error:", err);
  }

  return getFromCache<any>(cacheKey, 3600000) || null;
}

export function prefetchTricksPage(): void {
  const cacheKey = "tricks_page_data";
  if (isCacheFresh(cacheKey, TTL_TRICKS_PAGE)) return;
  fetchTricksPageCached();
}
