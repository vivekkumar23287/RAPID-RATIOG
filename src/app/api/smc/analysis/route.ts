import { NextRequest, NextResponse } from "next/server";
import { analyzeSMC } from "@/lib/smc/smc-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") || "RELIANCE";
    const interval = searchParams.get("interval") || "15m";
    const range = searchParams.get("range") || "5d";

    const yahooRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=${interval}&range=${range}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!yahooRes.ok) {
      return NextResponse.json({ success: false, error: `Yahoo error: ${yahooRes.status}` }, { status: 502 });
    }

    const json = await yahooRes.json();
    const result = json.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ success: false, error: "No chart data" }, { status: 404 });
    }

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

    const smc = analyzeSMC(symbol, symbol, candles, interval === "60m" || interval === "1h" ? "1h" : "15m");

    return NextResponse.json({
      success: true,
      symbol,
      interval,
      candlesCount: candles.length,
      smc: {
        signals: smc.signals,
        structureSignals: smc.structure.signals,
        swings: smc.structure.swings,
        currentTrend: smc.structure.currentTrend,
        fvgs: smc.fvgs,
        orderBlocks: smc.orderBlocks,
        liquidity: smc.liquidity,
        premiumDiscount: smc.premiumDiscount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
