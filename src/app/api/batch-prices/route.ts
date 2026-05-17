import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");

  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 });
  }

  const symbols = symbolsParam.split(",");
  const result: Record<string, any> = {};
  
  // DIRECT MODE: Bypassing database completely to fix N/A issue
  let symbolsToFetch = [...symbols];

  try {
    if (symbolsToFetch.length > 0) {
      const yahooSymbols = symbolsToFetch.map(s => {
        const upper = s.toUpperCase();
        if (upper.includes("-USD")) return upper;
        if (upper === "NIFTY50") return "^NSEI";
        if (upper === "INDIAVIX") return "^INDIAVIX";
        if (upper === "M&M") return "M&M.NS";
        if (upper === "ETERNAL") return "ETERNAL.NS";
        if (upper === "TMCV") return "TMCV.NS";
        return `${upper}.NS`;
      });

      const CHUNK_SIZE = 20;
      for (let i = 0; i < symbolsToFetch.length; i += CHUNK_SIZE) {
        const symbolsChunk = symbolsToFetch.slice(i, i + CHUNK_SIZE);
        const yahooChunk = yahooSymbols.slice(i, i + CHUNK_SIZE);
        
        const encodedSymbols = yahooChunk.map(s => encodeURIComponent(s)).join(",");
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodedSymbols}`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
          }
        });

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
                
                result[symbol] = {
                  currentPrice,
                  change,
                  changePercent
                };
              }
            }
          }
        } else {
          // Fallback to Quote API
          const fallbackUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedSymbols}`;
          const fbRes = await fetch(fallbackUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
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

              result[ourSymbol] = {
                currentPrice: q.regularMarketPrice,
                change: q.regularMarketChange,
                changePercent: q.regularMarketChangePercent
              };
            });
          }
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Critical Direct Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
