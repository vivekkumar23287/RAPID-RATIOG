import { NextResponse } from "next/server";
import { NIFTY_50_STOCKS } from "@/lib/stocks";

// Symbols that use v8/chart or special APIs (indexes, crypto)
const SPECIAL_SYMBOL_MAP: Record<string, string> = {
  BTC:       "BTC-USD",
  "BTC-USD": "BTC-USD",
  NIFTY:     "^NSEI",
  NIFTY50:   "^NSEI",
  "^NSEI":   "^NSEI",
  INDIAVIX:  "^INDIAVIX",
  "^INDIAVIX": "^INDIAVIX",
};

const ADDITIONAL_SYMBOLS = [
  "NIFTY", "NIFTY50", "INDIAVIX", "POLYCAB", "IDEA", "IEX", "DEEPAKNTR", "IFORGE", "COCHINSHIP",
  "TATAMOTORS", "TMCV", "TMPV", "DEEPAKNI", "BTC", "BTC-USD"
];

const VALID_SYMBOLS = new Set([
  ...NIFTY_50_STOCKS.map(s => s.symbol.toUpperCase()),
  ...ADDITIONAL_SYMBOLS.map(s => s.toUpperCase())
]);

function toYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper === "NIFTY" || upper === "NIFTY50" || upper === "^NSEI") return "^NSEI";
  if (upper === "INDIAVIX" || upper === "^INDIAVIX") return "^INDIAVIX";
  if (upper === "BTC" || upper === "BTC-USD") return "BTC-USD";
  if (upper === "TATAMOTORS" || upper === "TMCV" || upper === "TMPV") return "TMPV.NS";
  return `${upper}.NS`;
}

/** Fetch prices for special symbols (indexes, crypto) via Yahoo Finance v8 chart + Binance fallback */
async function fetchSpecialPrices(specialSymbols: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (specialSymbols.length === 0) return result;

  await Promise.all(
    specialSymbols.map(async (rawSymbol) => {
      const upper = rawSymbol.toUpperCase();
      const yahooSymbol = SPECIAL_SYMBOL_MAP[upper] || (upper === "BTC" ? "BTC-USD" : `${upper}-USD`);

      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
          },
          next: { revalidate: 5 },
        });

        if (res.ok) {
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta && meta.regularMarketPrice != null && meta.regularMarketPrice > 0) {
            const currentPrice = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
            const change = meta.fulldayChange ?? (currentPrice - prevClose);
            const changePercent = meta.fulldayChangePercent ?? meta.regularMarketChangePercent ?? (prevClose ? (change / prevClose) * 100 : 0);

            result[rawSymbol] = {
              currentPrice: parseFloat(currentPrice.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
            };
            return;
          }
        }
      } catch (e) {
        console.warn(`Special symbol chart fetch error for ${rawSymbol}:`, e);
      }

      // Binance Fallback specifically for BTC
      if (upper === "BTC" || upper === "BTC-USD") {
        try {
          const binanceRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT", {
            next: { revalidate: 5 },
          });
          if (binanceRes.ok) {
            const bData = await binanceRes.json();
            const price = parseFloat(bData.lastPrice);
            const change = parseFloat(bData.priceChange);
            const changePercent = parseFloat(bData.priceChangePercent);
            if (!isNaN(price) && price > 0) {
              result[rawSymbol] = {
                currentPrice: parseFloat(price.toFixed(2)),
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2)),
              };
            }
          }
        } catch (bErr) {
          console.warn("Binance fallback failed for BTC:", bErr);
        }
      }
    })
  );

  return result;
}

// Global in-memory server cache for live prices (10-second TTL)
const serverPriceCache = new Map<string, { data: any; timestamp: number }>();
const SERVER_CACHE_TTL_MS = 10000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");

  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 });
  }

  const requestedSymbols = symbolsParam.split(",").filter(Boolean);

  // Validate all symbols against the allowlist
  const validSymbols = requestedSymbols.filter(s => VALID_SYMBOLS.has(s.toUpperCase()));
  if (validSymbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols provided" }, { status: 400 });
  }

  const now = Date.now();
  const result: Record<string, any> = {};
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const sym of validSymbols) {
    const upper = sym.toUpperCase();
    const cached = serverPriceCache.get(upper);
    if (cached && now - cached.timestamp < SERVER_CACHE_TTL_MS) {
      result[sym] = cached.data;
    } else {
      symbolsToFetch.push(sym);
    }
  }

  // If all requested symbols are fresh in cache, return immediately (<1ms)
  if (symbolsToFetch.length === 0) {
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" }
    });
  }

  // Split remaining symbols: special symbols (indexes, crypto) vs NSE stocks
  const specialSymbols = symbolsToFetch.filter(s => SPECIAL_SYMBOL_MAP[s.toUpperCase()]);
  const nseSymbols = symbolsToFetch.filter(s => !SPECIAL_SYMBOL_MAP[s.toUpperCase()]);

  try {
    // Fetch special (indexes+crypto) and NSE in parallel
    const [specialResult, ...chunkResults] = await Promise.all([
      fetchSpecialPrices(specialSymbols),
      ...buildNseChunkPromises(nseSymbols),
    ]);

    const freshData: Record<string, any> = {};
    Object.assign(freshData, specialResult);
    chunkResults.forEach(cr => Object.assign(freshData, cr));

    // Update in-memory cache
    Object.entries(freshData).forEach(([sym, val]) => {
      serverPriceCache.set(sym.toUpperCase(), { data: val, timestamp: now });
      result[sym] = val;
    });

    // For any symbol that failed to fetch fresh, fallback to existing cached value if present
    for (const sym of symbolsToFetch) {
      if (!result[sym]) {
        const cached = serverPriceCache.get(sym.toUpperCase());
        if (cached) result[sym] = cached.data;
      }
    }

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" }
    });
  } catch (error) {
    console.error("Critical Direct Fetch error:", error);
    // Return whatever cached data we have instead of complete failure
    if (Object.keys(result).length > 0) {
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}

function buildNseChunkPromises(nseSymbols: string[]): Promise<Record<string, any>>[] {
  if (nseSymbols.length === 0) return [];

  const CHUNK_SIZE = 20;
  const chunks: string[][] = [];
  for (let i = 0; i < nseSymbols.length; i += CHUNK_SIZE) {
    chunks.push(nseSymbols.slice(i, i + CHUNK_SIZE));
  }

  return chunks.map(async (symbolsChunk) => {
    const yahooChunk = symbolsChunk.map(toYahooSymbol);
    const encodedSymbols = yahooChunk.map(s => encodeURIComponent(s)).join(",");
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodedSymbols}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    const chunkResult: Record<string, any> = {};

    if (response.ok) {
      const data = await response.json();
      for (let j = 0; j < symbolsChunk.length; j++) {
        const symbol = symbolsChunk[j];
        const ySymbol = yahooChunk[j];
        const stockData = data[ySymbol];

        if (stockData) {
          let currentPrice = stockData.fulldayPrice ?? stockData.regularMarketPrice;
          if ((currentPrice == null || currentPrice === 0) && Array.isArray(stockData.close)) {
            const validCloses = stockData.close.filter((c: number | null) => c !== null);
            if (validCloses.length > 0) {
              currentPrice = validCloses[validCloses.length - 1];
            }
          }

          if (currentPrice != null && currentPrice > 0) {
            const previousClose = stockData.previousClose || stockData.chartPreviousClose || currentPrice;
            const change = stockData.fulldayChange ?? (currentPrice - previousClose);
            const changePercent = stockData.fulldayChangePercent ?? (previousClose ? (change / previousClose) * 100 : 0);

            chunkResult[symbol] = {
              currentPrice: parseFloat(currentPrice.toFixed(2)),
              change: parseFloat(change.toFixed(2)),
              changePercent: parseFloat(changePercent.toFixed(2)),
            };
          }
        }
      }
    } else {
      // Fallback: fetch individually via v8 chart endpoint
      await Promise.all(
        symbolsChunk.map(async (symbol, idx) => {
          try {
            const ySymbol = yahooChunk[idx];
            const fallbackUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=1d&interval=1d`;
            const fbRes = await fetch(fallbackUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
            });
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              const meta = fbData?.chart?.result?.[0]?.meta;
              if (meta && meta.regularMarketPrice != null) {
                const currentPrice = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
                const change = meta.fulldayChange ?? (currentPrice - prevClose);
                const changePercent = meta.fulldayChangePercent ?? meta.regularMarketChangePercent ?? (prevClose ? (change / prevClose) * 100 : 0);

                chunkResult[symbol] = {
                  currentPrice: parseFloat(currentPrice.toFixed(2)),
                  change: parseFloat(change.toFixed(2)),
                  changePercent: parseFloat(changePercent.toFixed(2)),
                };
              }
            }
          } catch {}
        })
      );
    }

    return chunkResult;
  });
}

