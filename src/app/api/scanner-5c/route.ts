import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const SCAN_SYMBOLS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
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
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  { symbol: "ADANIENT", name: "Adani Enterprises" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical" },
  { symbol: "TITAN", name: "Titan Company" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement" },
  { symbol: "TATASTEEL", name: "Tata Steel" },
  { symbol: "NTPC", name: "NTPC" },
  { symbol: "JSWSTEEL", name: "JSW Steel" },
  { symbol: "ASIANPAINT", name: "Asian Paints" },
  { symbol: "M&M", name: "Mahindra & Mahindra" },
  { symbol: "POWERGRID", name: "Power Grid Corp" },
  { symbol: "ONGC", name: "ONGC" },
  { symbol: "ADANIPORTS", name: "Adani Ports & SEZ" },
  { symbol: "COALINDIA", name: "Coal India" },
  { symbol: "TECHM", name: "Tech Mahindra" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank" },
  { symbol: "NESTLEIND", name: "Nestle India" },
  { symbol: "LTIM", name: "LTI Mindtree" },
  { symbol: "HINDALCO", name: "Hindalco Industries" },
  { symbol: "BRITANNIA", name: "Britannia Industries" },
  { symbol: "GRASIM", name: "Grasim Industries" },
  { symbol: "DRREDDY", name: "Dr. Reddy's" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals" },
  { symbol: "EICHERMOT", name: "Eicher Motors" },
  { symbol: "SBILIFE", name: "SBI Life Insurance" },
  { symbol: "BPCL", name: "BPCL" },
  { symbol: "CIPLA", name: "Cipla" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp" },
  { symbol: "UPL", name: "UPL" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products" },
  
  { symbol: "DLF", name: "DLF Limited" },
  { symbol: "BHEL", name: "BHEL" },
  { symbol: "CANBK", name: "Canara Bank" },
  { symbol: "PNB", name: "Punjab National Bank" },
  { symbol: "TATAPOWER", name: "Tata Power" },
  { symbol: "IRCTC", name: "IRCTC" },
  { symbol: "UNIONBANK", name: "Union Bank of India" },
  { symbol: "FEDERALBNK", name: "Federal Bank" },
  { symbol: "SAIL", name: "Steel Authority of India" },
  { symbol: "GMRINFRA", name: "GMR Airports Infra" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank" },
  { symbol: "IOC", name: "Indian Oil Corp" }
];

const fetchYahoo15mChart = async (symbol: string) => {
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?range=5d&interval=15m&includePrePost=false`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      next: { revalidate: 15 } 
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Fetch error for ${symbol}:`, error);
    return null;
  }
};

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now();
    
    const now = new Date();
    const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const nowIST = new Date(nowISTString);
    const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, '0')}-${nowIST.getDate().toString().padStart(2, '0')}`;
    
    
    await sql`
      CREATE TABLE IF NOT EXISTS scanner_cache (
        id SERIAL PRIMARY KEY,
        date_str VARCHAR(20) NOT NULL,
        scanner_type VARCHAR(50) NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date_str, scanner_type)
      )
    `;

    
    const { searchParams } = new URL(req.url);
    const singleSymbol = searchParams.get("symbol");
    
    
    if (!singleSymbol) {
      const cached = await sql`SELECT results FROM scanner_cache WHERE date_str = ${dateStr} AND scanner_type = 'scanner-5c'`;
      if (cached.length > 0) {
         return NextResponse.json(cached[0].results);
      }
      
      
      
      
      const isMarketOpenAndCandleClosed = nowIST.getHours() > 10 || (nowIST.getHours() === 10 && nowIST.getMinutes() >= 1);
      
      if (!isMarketOpenAndCandleClosed) {
        
        const latest = await sql`SELECT results FROM scanner_cache WHERE scanner_type = 'scanner-5c' ORDER BY date_str DESC LIMIT 1`;
        if (latest.length > 0) {
           return NextResponse.json(latest[0].results);
        }
        return NextResponse.json({ success: true, matchesCount: 0, matches: [], scannedCount: 0, timestamp: new Date().toISOString() });
      }
    }
    
    const symbolsToScan = singleSymbol 
      ? SCAN_SYMBOLS.filter(s => s.symbol.toUpperCase() === singleSymbol.toUpperCase())
      : SCAN_SYMBOLS;

    if (symbolsToScan.length === 0) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    
    const chunkSize = 15;
    const allResults = [];

    for (let i = 0; i < symbolsToScan.length; i += chunkSize) {
      const chunk = symbolsToScan.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (item) => {
        try {
          const rawData = await fetchYahoo15mChart(item.symbol);
          const result = rawData?.chart?.result?.[0];
          if (!result) return null;

          const meta = result.meta;
          const timestamps = result.timestamp || [];
          const quote = result.indicators?.quote?.[0];
          
          if (!quote || timestamps.length === 0) return null;

          
          const candleGroups: {
            [date: string]: {
              open: number;
              high: number;
              low: number;
              close: number;
              volume: number;
              timestamp: number;
            }[]
          } = {};

          timestamps.forEach((ts: number, index: number) => {
            const o = quote.open?.[index];
            const h = quote.high?.[index];
            const l = quote.low?.[index];
            const c = quote.close?.[index];
            const v = quote.volume?.[index] || 0;

            if (
              o !== undefined && h !== undefined && l !== undefined && c !== undefined &&
              o !== null && h !== null && l !== null && c !== null
            ) {
              const date = new Date(ts * 1000);
              const dateString = date.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
              });
              const cleanDateString = dateString.replace(/-/g, "/");

              if (!candleGroups[cleanDateString]) {
                candleGroups[cleanDateString] = [];
              }
              candleGroups[cleanDateString].push({
                open: parseFloat(o.toFixed(2)),
                high: parseFloat(h.toFixed(2)),
                low: parseFloat(l.toFixed(2)),
                close: parseFloat(c.toFixed(2)),
                volume: v,
                timestamp: ts
              });
            }
          });

          
          const sortedDates = Object.keys(candleGroups).sort((a, b) => {
            const [dayA, monthA, yearA] = a.split("/").map(Number);
            const [dayB, monthB, yearB] = b.split("/").map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateA.getTime() - dateB.getTime();
          });

          if (sortedDates.length < 2) return null;

          
          
          let todayIndex = -1;
          for (let d = sortedDates.length - 1; d >= 0; d--) {
            const dateStr = sortedDates[d];
            if (candleGroups[dateStr].length >= 3 && d >= 1) {
              
              const prevDateStr = sortedDates[d - 1];
              if (candleGroups[prevDateStr].length >= 2) {
                todayIndex = d;
                break;
              }
            }
          }

          if (todayIndex === -1) return null;

          const todayDate = sortedDates[todayIndex];
          const yesterdayDate = sortedDates[todayIndex - 1];

          
          const todayCandles = [...candleGroups[todayDate]].sort((a, b) => a.timestamp - b.timestamp);
          const yesterdayCandles = [...candleGroups[yesterdayDate]].sort((a, b) => a.timestamp - b.timestamp);

          
          
          
          
          
          
          const C1 = yesterdayCandles[yesterdayCandles.length - 2];
          const C2 = yesterdayCandles[yesterdayCandles.length - 1];
          const C3 = todayCandles[0];
          const C4 = todayCandles[1];
          const C5 = todayCandles[2];

          if (!C1 || !C2 || !C3 || !C4 || !C5) return null;

          
          
          const isHighSatisfied = C1.high < C3.high && C2.high < C3.high && C4.high < C3.high && C5.high < C3.high;
          const isLowSatisfied = C1.low > C3.low && C2.low > C3.low && C4.low > C3.low && C5.low > C3.low;
          const isSetupMatched = isHighSatisfied && isLowSatisfied;

          const currentPrice = meta.regularMarketPrice ?? todayCandles[todayCandles.length - 1].close;
          const totalVolume = todayCandles.reduce((sum, c) => sum + c.volume, 0);

          
          
          
          const detectionTimeStr = "10:00 AM";

          return {
            symbol: item.symbol,
            name: item.name,
            currentPrice,
            changePercent: meta.regularMarketChangePercent ?? 0,
            isSetupMatched,
            dateDetected: todayDate,
            timeDetected: `${detectionTimeStr} (IST)`,
            totalVolume,
            candles: [C1, C2, C3, C4, C5],
            motherCandleRange: {
              high: C3.high,
              low: C3.low,
              open: C3.open,
              close: C3.close
            }
          };
        } catch (err) {
          console.error(`Error processing ${item.symbol}:`, err);
          return null;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      allResults.push(...chunkResults.filter(Boolean));
      
      
      if (i + chunkSize < symbolsToScan.length) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    const matchedStocks = allResults
      .filter((s: any) => s.isSetupMatched)
      .sort((a: any, b: any) => b.totalVolume - a.totalVolume); 

    const timeTaken = Date.now() - startTime;

    const responsePayload = {
      success: true,
      matchesCount: matchedStocks.length,
      matches: matchedStocks,
      scannedCount: symbolsToScan.length,
      timestamp: new Date().toISOString(),
      timeTakenMs: timeTaken
    };
    
    
    if (!singleSymbol) {
      await sql`
        INSERT INTO scanner_cache (date_str, scanner_type, results)
        VALUES (${dateStr}, 'scanner-5c', ${JSON.stringify(responsePayload)})
        ON CONFLICT (date_str, scanner_type) DO UPDATE SET results = EXCLUDED.results
      `;
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error("Scanner exception:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to run stock scanner"
    }, { status: 500 });
  }
}
