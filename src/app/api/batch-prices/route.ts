import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { NIFTY_50_STOCKS } from "@/lib/stocks";

// Crypto symbols must be fetched via the v7 quote API (spark doesn't support them)
const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  BTC: "BTC-USD",
};

const ADDITIONAL_SYMBOLS = [
  "NIFTY50", "INDIAVIX", "POLYCAB", "IDEA", "IEX", "DEEPAKNTR", "IFORGE", "COCHINSHIP",
  "TATAMOTORS", "TMCV", "TMPV", "DEEPAKNI", "BTC"
];

const VALID_SYMBOLS = new Set([
  ...NIFTY_50_STOCKS.map(s => s.symbol.toUpperCase()),
  ...ADDITIONAL_SYMBOLS.map(s => s.toUpperCase())
]);

function toYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper === "NIFTY50") return "^NSEI";
  if (upper === "INDIAVIX") return "^INDIAVIX";
  if (upper === "TATAMOTORS" || upper === "TMCV" || upper === "TMPV") return "TMPV.NS";
  return `${upper}.NS`;
}

/** Fetch crypto prices via Yahoo Finance v7 quote (reliable for BTC-USD etc.) */
async function fetchCryptoPrices(cryptoSymbols: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (cryptoSymbols.length === 0) return result;

  const yahooSymbols = cryptoSymbols.map(s => CRYPTO_SYMBOL_MAP[s.toUpperCase()] || `${s}-USD`);
  const encoded = yahooSymbols.map(s => encodeURIComponent(s)).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encoded}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return result;

    const data = await res.json();
    const quotes: any[] = data?.quoteResponse?.result || [];

    quotes.forEach((q: any) => {
      // Map back from Yahoo symbol (e.g. "BTC-USD") to our symbol ("BTC")
      const ourSymbol = cryptoSymbols.find(
        s => CRYPTO_SYMBOL_MAP[s.toUpperCase()] === q.symbol
      );
      if (ourSymbol && q.regularMarketPrice) {
        result[ourSymbol] = {
          currentPrice: parseFloat(q.regularMarketPrice.toFixed(2)),
          change: parseFloat((q.regularMarketChange || 0).toFixed(2)),
          changePercent: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
        };
      }
    });
  } catch (e) {
    console.warn("Crypto fetch error:", e);
  }

  return result;
}

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

  // Split into crypto (needs v7 quote) and regular NSE/index symbols (use spark)
  const cryptoSymbols = validSymbols.filter(s => CRYPTO_SYMBOL_MAP[s.toUpperCase()]);
  const nseSymbols = validSymbols.filter(s => !CRYPTO_SYMBOL_MAP[s.toUpperCase()]);

  const result: Record<string, any> = {};

  try {
    // Fetch crypto and NSE in parallel
    const [cryptoResult, ...chunkResults] = await Promise.all([
      fetchCryptoPrices(cryptoSymbols),
      ...buildNseChunkPromises(nseSymbols),
    ]);

    Object.assign(result, cryptoResult);
    chunkResults.forEach(cr => Object.assign(result, cr));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Critical Direct Fetch error:", error);
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
      // Fallback to v7 quote endpoint
      const fallbackUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedSymbols}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        const quotes = fbData?.quoteResponse?.result || [];

        quotes.forEach((q: any) => {
          const ourSymbol = symbolsChunk.find(s => {
            const upper = s.toUpperCase();
            if (upper === "NIFTY50") return q.symbol === "^NSEI";
            if (upper === "INDIAVIX") return q.symbol === "^INDIAVIX";
            if (upper === "M&M") return q.symbol === "M&M.NS" || q.symbol === "M%26M.NS";
            return q.symbol === `${upper}.NS` || q.symbol === upper;
          }) || q.symbol;

          if (q.regularMarketPrice) {
            chunkResult[ourSymbol] = {
              currentPrice: parseFloat(q.regularMarketPrice.toFixed(2)),
              change: parseFloat((q.regularMarketChange || 0).toFixed(2)),
              changePercent: parseFloat((q.regularMarketChangePercent || 0).toFixed(2)),
            };
          }
        });
      }
    }

    return chunkResult;
  });
}

