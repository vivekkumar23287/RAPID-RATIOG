import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  
  NIFTY50: "^NSEI",
  POLYCAB: "POLYCAB.NS",
  IFORGE: "BHARATFORG.NS",
  IEX: "IEX.NS",
  DEEPAKNTR: "DEEPAKNTR.NS",
  INDIAVIX: "^INDIAVIX",
  
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  HDFCBANK: "HDFCBANK.NS",
  ICICIBANK: "ICICIBANK.NS",
  INFY: "INFY.NS",
  HINDUNILVR: "HINDUNILVR.NS",
  ITC: "ITC.NS",
  SBIN: "SBIN.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  BAJFINANCE: "BAJFINANCE.NS",
  ADANIENT: "ADANIENT.NS",
  KOTAKBANK: "KOTAKBANK.NS",
  LT: "LT.NS",
  AXISBANK: "AXISBANK.NS",
  SUNPHARMA: "SUNPHARMA.NS",
  TITAN: "TITAN.NS",
  BAJAJFINSV: "BAJAJFINSV.NS",
  MARUTI: "MARUTI.NS",
  ULTRACEMCO: "ULTRACEMCO.NS",
  TATASTEEL: "TATASTEEL.NS",
  NTPC: "NTPC.NS",
  HCLTECH: "HCLTECH.NS",
  TATAMOTORS: "TATAMOTORS.NS",
  JSWSTEEL: "JSWSTEEL.NS",
  ASIANPAINT: "ASIANPAINT.NS",
  "M&M": "M%26M.NS",
  POWERGRID: "POWERGRID.NS",
  ONGC: "ONGC.NS",
  ADANIPORTS: "ADANIPORTS.NS",
  WIPRO: "WIPRO.NS",
  COALINDIA: "COALINDIA.NS",
  TECHM: "TECHM.NS",
  INDUSINDBK: "INDUSINDBK.NS",
  NESTLEIND: "NESTLEIND.NS",
  LTIM: "LTIM.NS",
  HINDALCO: "HINDALCO.NS",
  BRITANNIA: "BRITANNIA.NS",
  GRASIM: "GRASIM.NS",
  DRREDDY: "DRREDDY.NS",
  APOLLOHOSP: "APOLLOHOSP.NS",
  EICHERMOT: "EICHERMOT.NS",
  SBILIFE: "SBILIFE.NS",
  BPCL: "BPCL.NS",
  CIPLA: "CIPLA.NS",
  "BAJAJ-AUTO": "BAJAJ-AUTO.NS",
  DIVISLAB: "DIVISLAB.NS",
  HEROMOTOCO: "HEROMOTOCO.NS",
  UPL: "UPL.NS",
  GLAND: "GLAND.NS",
  TATACONSUM: "TATACONSUM.NS",
  TMCV: "TMCV.NS",
  ETERNAL: "ETERNAL.NS",
  
  "BTC-USD": "BTC-USD",
  "ETH-USD": "ETH-USD",
  "USDT-USD": "USDT-USD",
};

function getYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (YAHOO_SYMBOL_MAP[upper]) return YAHOO_SYMBOL_MAP[upper];
  
  if (upper.endsWith("-USD")) return upper;
  return `${upper}.NS`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "RELIANCE";
  const range = searchParams.get("range") || "1y";
  const interval = searchParams.get("interval") || "1d";
  const dateParam = searchParams.get("date");

  const yahooSymbol = getYahooSymbol(symbol);
  const isIntraday = ["1m", "5m", "15m", "30m", "60m"].includes(interval);
  const isCrypto = symbol.toUpperCase().includes("-USD");
  const CACHE_DURATION_SECONDS = 7;

  
  if (dateParam) {
    try {
      const [histChart] = await sql`
        SELECT chart_data
        FROM historical_charts
        WHERE symbol = ${symbol.toUpperCase()} AND candle_date = ${dateParam} AND interval = ${interval}
      `;
      if (histChart && histChart.chart_data) {
        const candles = histChart.chart_data;
        const lastCandle = candles[candles.length - 1] || { close: 0, open: 0 };
        const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
        const change = lastCandle.close - prevCandle.close;
        const changePercent = prevCandle.close ? (change / prevCandle.close) * 100 : 0;
        
        return NextResponse.json({
          symbol: symbol.toUpperCase(),
          name: symbol.toUpperCase(),
          currency: "INR",
          currentPrice: lastCandle.close,
          previousClose: prevCandle.close,
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          candles,
          isHistorical: true
        });
      }
    } catch (e) {
      console.error("Failed fetching historical chart:", e);
    }
    // Fallthrough to live if not found, though usually we just return empty or let it fallthrough
  }

  let cachedData = null;
  let isCacheFresh = false;

  try {
    
    if (!isCrypto) {
      const [cached] = await sql`
        SELECT price, change, change_percent, last_updated 
        FROM live_prices 
        WHERE symbol = ${symbol.toUpperCase()}
      `;

      if (cached) {
        cachedData = cached;
        const now = new Date();
        isCacheFresh = (now.getTime() - new Date(cached.last_updated).getTime()) / 1000 < CACHE_DURATION_SECONDS;
      }
    }
  } catch (dbError) {
    console.error("Database cache read error (chart):", dbError);
  }

  try {
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}&includePrePost=false`;

    const fetchOptions: RequestInit = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    };

    if (isIntraday) {
      fetchOptions.cache = "no-store";
    } else {
      fetchOptions.next = { revalidate: 300 };
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json(
        { error: "No data found for this symbol" },
        { status: 404 }
      );
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    if (!timestamps || !quote) {
      return NextResponse.json(
        { error: "Incomplete data from Yahoo Finance" },
        { status: 500 }
      );
    }

    const candles: any[] = [];
    const intervalMap: Record<string, number> = {
      "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "60m": 3600, "1d": 86400
    };
    const snapSeconds = intervalMap[interval] || 60;

    for (let i = 0; i < timestamps.length; i++) {
      if (
        quote.open[i] != null &&
        quote.high[i] != null &&
        quote.low[i] != null &&
        quote.close[i] != null
      ) {
        const rawTime = timestamps[i];
        const alignedTime = Math.floor(rawTime / snapSeconds) * snapSeconds;
        
        const open = parseFloat(quote.open[i].toFixed(2));
        const high = parseFloat(quote.high[i].toFixed(2));
        const low = parseFloat(quote.low[i].toFixed(2));
        const close = parseFloat(quote.close[i].toFixed(2));
        
        const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

        if (lastCandle && lastCandle.time === alignedTime) {
          lastCandle.high = Math.max(lastCandle.high, high);
          lastCandle.low = Math.min(lastCandle.low, low);
          lastCandle.close = close;
        } else {
          candles.push({
            time: alignedTime,
            open,
            high,
            low,
            close,
          });
        }
      }
    }

    const meta = result.meta;
    let currentPrice = meta?.regularMarketPrice || 0;
    let previousClose = meta?.chartPreviousClose || meta?.previousClose || 0;
    
    
    if (isCacheFresh && isIntraday && cachedData) {
      currentPrice = Number(cachedData.price);
      // We still update candles below
    }

    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    if (isIntraday && candles.length > 1 && currentPrice > 0) {
      const lastCandle = candles[candles.length - 1];
      const prevCandle = candles[candles.length - 2];
      const nowTs = Math.floor(Date.now() / 1000);
      const currentSlot = Math.floor(nowTs / snapSeconds) * snapSeconds;

      if (currentSlot > lastCandle.time) {
        const pClose = lastCandle.close;
        candles.push({
          time: currentSlot,
          open: pClose,
          high: Math.max(pClose, currentPrice),
          low: Math.min(pClose, currentPrice),
          close: currentPrice,
        });
      } else if (currentSlot === lastCandle.time) {
        lastCandle.open = prevCandle.close;
        lastCandle.close = currentPrice;
        lastCandle.high = Math.max(lastCandle.open, lastCandle.high, currentPrice);
        lastCandle.low = Math.min(lastCandle.open, lastCandle.low, currentPrice);
      }
    }

    
    if (!isCacheFresh && !isCrypto) {
      sql`
        INSERT INTO live_prices (symbol, price, change, change_percent, last_updated)
        VALUES (${symbol.toUpperCase()}, ${currentPrice}, ${change}, ${changePercent}, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          price = EXCLUDED.price,
          change = EXCLUDED.change,
          change_percent = EXCLUDED.change_percent,
          last_updated = NOW()
      `.catch(e => console.error("Database cache write error:", e));
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      name: meta?.shortName || meta?.symbol || symbol,
      currency: meta?.currency || "INR",
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      previousClose: parseFloat(previousClose.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      candles,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
