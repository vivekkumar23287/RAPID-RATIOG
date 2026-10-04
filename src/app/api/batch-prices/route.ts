import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { NIFTY_50_STOCKS } from "@/lib/stocks";

const ADDITIONAL_SYMBOLS = [
  "NIFTY50", "INDIAVIX", "POLYCAB", "IDEA", "IEX", "DEEPAKNTR", "IFORGE", "COCHINSHIP",
  "TATAMOTORS", "TMCV", "TMPV", "DEEPAKNI",
  // Crypto
  "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD",
  "ADA-USD", "DOT-USD", "LINK-USD", "MATIC-USD", "SHIB-USD",
  "LTC-USD", "AVAX-USD", "USDT-USD"
];

const VALID_SYMBOLS = new Set([
  ...NIFTY_50_STOCKS.map(s => s.symbol.toUpperCase()),
  ...ADDITIONAL_SYMBOLS.map(s => s.toUpperCase())
]);

function toYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes("-USD")) return upper;
  if (upper === "NIFTY50") return "^NSEI";
  if (upper === "INDIAVIX") return "^INDIAVIX";
  if (upper === "TATAMOTORS" || upper === "TMCV" || upper === "TMPV") return "TMPV.NS";
  return `${upper}.NS`;
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

  const result: Record<string, any> = {};

  try {
    // Split into chunks and fetch ALL chunks in PARALLEL for speed
    const CHUNK_SIZE = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < validSymbols.length; i += CHUNK_SIZE) {
      chunks.push(validSymbols.slice(i, i + CHUNK_SIZE));
    }

    const chunkPromises = chunks.map(async (symbolsChunk) => {
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

          if (stockData && stockData.close && stockData.close.length > 0) {
            const validCloses = stockData.close.filter((c: number | null) => c !== null);
            if (validCloses.length > 0) {
              const currentPrice = validCloses[validCloses.length - 1];
              const previousClose = stockData.previousClose || currentPrice;
              const change = currentPrice - previousClose;
              const changePercent = previousClose ? (change / previousClose) * 100 : 0;

              chunkResult[symbol] = { currentPrice, change, changePercent };
            }
          }
        }
      } else {
        // Fallback to v7 quote endpoint
        const fallbackUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedSymbols}`;
        const fbRes = await fetch(fallbackUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
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

            chunkResult[ourSymbol] = {
              currentPrice: q.regularMarketPrice,
              change: q.regularMarketChange,
              changePercent: q.regularMarketChangePercent,
            };
          });
        }
      }

      return chunkResult;
    });

    // Wait for ALL chunks in parallel
    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(cr => Object.assign(result, cr));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Critical Direct Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
