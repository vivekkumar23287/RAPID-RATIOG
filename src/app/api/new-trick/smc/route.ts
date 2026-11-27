import { NextRequest, NextResponse } from "next/server";
import { getSMCSignals, saveSMCSignals, SMCDbRecord } from "@/lib/smc/smc-db";
import { analyzeSMC } from "@/lib/smc/smc-engine";

export const dynamic = "force-dynamic";

// Top liquid Futures universe stocks for fast responsive SMC scanning
const FUTURES_SCAN_UNIVERSE: { symbol: string; name: string }[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd." },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd." },
  { symbol: "INFY", name: "Infosys Ltd." },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd." },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd." },
  { symbol: "TITAN", name: "Titan Company Ltd." },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd." },
  { symbol: "LT", name: "Larsen & Toubro Ltd." },
  { symbol: "AXISBANK", name: "Axis Bank Ltd." },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd." },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd." },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd." },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd." },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd." },
  { symbol: "ITC", name: "ITC Ltd." },
  { symbol: "WIPRO", name: "Wipro Ltd." },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd." },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd." },
];

/**
 * Fetch candles for a symbol using internal stock-data endpoint
 */
async function fetchCandles(symbol: string, interval: string = "15m", range: string = "5d") {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=${interval}&range=${range}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const candles: any[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] != null && quotes.high[i] != null && quotes.low[i] != null && quotes.close[i] != null) {
        candles.push({
          time: timestamps[i],
          open: Number(quotes.open[i]),
          high: Number(quotes.high[i]),
          low: Number(quotes.low[i]),
          close: Number(quotes.close[i]),
          volume: quotes.volume?.[i] || 0,
        });
      }
    }
    return candles;
  } catch (_) {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const timeframe = searchParams.get("timeframe") || "ALL";
    const direction = searchParams.get("direction") || "ALL";
    const category = searchParams.get("category") || "ALL";

    const data = await getSMCSignals({ date, timeframe, direction, category });

    // If database is empty today, perform a lightweight fast scan on top stocks
    if (data.signals.length === 0) {
      const nowIST = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date());

      const todayIST = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());

      const scanPromises = FUTURES_SCAN_UNIVERSE.slice(0, 10).map(async (stock) => {
        const [c15, c1h] = await Promise.all([
          fetchCandles(stock.symbol, "15m", "5d"),
          fetchCandles(stock.symbol, "60m", "15d")
        ]);

        const signals: SMCDbRecord[] = [];
        if (c15.length > 20) {
          const res15 = analyzeSMC(stock.symbol, stock.name, c15, "15m");
          for (const s of res15.signals) {
            signals.push({
              company_name: stock.name,
              nse_symbol: stock.symbol,
              signal_type: s.title,
              direction: s.direction,
              category: s.category,
              timeframe: "15m",
              price: s.price,
              candle_timestamp: s.time,
              trading_date: todayIST,
              added_at: nowIST,
              status: "CONFIRMED",
              details: s.details
            });
          }
        }

        if (c1h.length > 20) {
          const res1h = analyzeSMC(stock.symbol, stock.name, c1h, "1h");
          for (const s of res1h.signals) {
            signals.push({
              company_name: stock.name,
              nse_symbol: stock.symbol,
              signal_type: s.title,
              direction: s.direction,
              category: s.category,
              timeframe: "1h",
              price: s.price,
              candle_timestamp: s.time,
              trading_date: todayIST,
              added_at: nowIST,
              status: "CONFIRMED",
              details: s.details
            });
          }
        }
        return signals;
      });

      const batchResults = await Promise.allSettled(scanPromises);
      const allFound: SMCDbRecord[] = [];
      for (const res of batchResults) {
        if (res.status === "fulfilled") {
          allFound.push(...res.value);
        }
      }

      if (allFound.length > 0) {
        await saveSMCSignals(allFound);
        const refreshed = await getSMCSignals({ date, timeframe, direction, category });
        return NextResponse.json({ success: true, date: refreshed.date, signals: refreshed.signals });
      }
    }

    return NextResponse.json({
      success: true,
      date: data.date,
      signals: data.signals
    });
  } catch (error: any) {
    console.error("[API] /api/new-trick/smc error:", error);
    return NextResponse.json({ success: false, error: error.message, signals: [] }, { status: 500 });
  }
}

export async function runSMCScan(): Promise<SMCDbRecord[]> {
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const nowIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  const scanPromises = FUTURES_SCAN_UNIVERSE.map(async (stock) => {
    const [c15, c1h] = await Promise.all([
      fetchCandles(stock.symbol, "15m", "5d"),
      fetchCandles(stock.symbol, "60m", "15d")
    ]);

    const signals: SMCDbRecord[] = [];
    if (c15.length > 20) {
      const res15 = analyzeSMC(stock.symbol, stock.name, c15, "15m");
      for (const s of res15.signals) {
        signals.push({
          company_name: stock.name,
          nse_symbol: stock.symbol,
          signal_type: s.title,
          direction: s.direction,
          category: s.category,
          timeframe: "15m",
          price: s.price,
          candle_timestamp: s.time,
          trading_date: todayIST,
          added_at: nowIST,
          status: "CONFIRMED",
          details: s.details
        });
      }
    }

    if (c1h.length > 20) {
      const res1h = analyzeSMC(stock.symbol, stock.name, c1h, "1h");
      for (const s of res1h.signals) {
        signals.push({
          company_name: stock.name,
          nse_symbol: stock.symbol,
          signal_type: s.title,
          direction: s.direction,
          category: s.category,
          timeframe: "1h",
          price: s.price,
          candle_timestamp: s.time,
          trading_date: todayIST,
          added_at: nowIST,
          status: "CONFIRMED",
          details: s.details
        });
      }
    }
    return signals;
  });

  const results = await Promise.allSettled(scanPromises);
  const allSignals: SMCDbRecord[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allSignals.push(...r.value);
  }

  if (allSignals.length > 0) {
    await saveSMCSignals(allSignals);
  }

  return allSignals;
}

export async function POST(req: NextRequest) {
  try {
    const allSignals = await runSMCScan();
    const updated = await getSMCSignals({});
    return NextResponse.json({ success: true, count: allSignals.length, signals: updated.signals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
