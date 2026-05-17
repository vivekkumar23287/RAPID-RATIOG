import { NextResponse } from "next/server";

// Predefined list of active high-volume NSE Nifty stocks to monitor
const SCANNER_SYMBOLS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "TCS" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "POLYCAB", name: "Polycab India" },
  { symbol: "TATAMOTORS", name: "Tata Motors" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
  { symbol: "ITC", name: "ITC Limited" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "AXISBANK", name: "Axis Bank" },
  { symbol: "WIPRO", name: "Wipro" },
  { symbol: "HCLTECH", name: "HCL Technologies" },
  { symbol: "MARUTI", name: "Maruti Suzuki" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" }
];

export async function GET() {
  try {
    const yahooSymbols = SCANNER_SYMBOLS.map(s => `${s.symbol}.NS`).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 10 } // Cache response for 10 seconds to protect API from abuse
    });

    if (!response.ok) {
      throw new Error("Yahoo Finance quote API request failed");
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];
    
    const processedStocks: {
      symbol: string;
      name: string;
      price: number;
      changePercent: number;
      gapPercent: number;
    }[] = [];

    SCANNER_SYMBOLS.forEach(item => {
      const qSymbol = `${item.symbol}.NS`;
      const quote = quotes.find((q: any) => q.symbol === qSymbol);

      if (quote) {
        const price = quote.regularMarketPrice ?? 0;
        const open = quote.regularMarketOpen ?? price;
        const prevClose = quote.regularMarketPreviousClose ?? price;
        const changePercent = quote.regularMarketChangePercent ?? 0;

        // Calculate exact mathematical open gap: ((Open - PrevClose) / PrevClose) * 100
        let gapPercent = 0;
        if (prevClose > 0) {
          gapPercent = ((open - prevClose) / prevClose) * 100;
        }

        processedStocks.push({
          symbol: item.symbol,
          name: item.name,
          price,
          changePercent,
          gapPercent
        });
      } else {
        // Fallback placeholder in case Yahoo doesn't return that specific stock
        processedStocks.push({
          symbol: item.symbol,
          name: item.name,
          price: 0,
          changePercent: 0,
          gapPercent: 0
        });
      }
    });

    // 1. GAP UP CRITERIA: A positive gap (gapPercent >= 0.25%)
    const gapUps = processedStocks
      .filter(s => s.gapPercent >= 0.20)
      .sort((a, b) => b.gapPercent - a.gapPercent);

    // 2. GAP DOWN CRITERIA: A negative gap (gapPercent <= -0.20%)
    const gapDowns = processedStocks
      .filter(s => s.gapPercent <= -0.20)
      .sort((a, b) => a.gapPercent - b.gapPercent); // Sort descending absolute drop (e.g. -2.5% before -1.2%)

    return NextResponse.json({
      gapUps,
      gapDowns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("NSE Gaps calculation error:", error);
    return NextResponse.json({ error: "Failed to scan NSE gaps" }, { status: 500 });
  }
}
