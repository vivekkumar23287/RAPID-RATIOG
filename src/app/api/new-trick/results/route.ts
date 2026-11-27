import { NextRequest, NextResponse } from "next/server";
import { getGapSignals, get3CGapSignals } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;

    // Fetch both Trick 1 (Gap Up & Down) and Trick 2 (3-Candle Gap) concurrently
    let [t1Results, t2Results] = await Promise.all([
      getGapSignals({ date }),
      get3CGapSignals({ date }),
    ]);

    // If both Trick 1 and Trick 2 are completely empty, execute a quick initial live scan so first-time visitors immediately see data
    const t1Empty = t1Results.gapUps.length === 0 && t1Results.gapDowns.length === 0;
    const t2Empty = t2Results.m15Up.length === 0 && t2Results.m15Down.length === 0 && t2Results.h1Up.length === 0 && t2Results.h1Down.length === 0;

    if (t1Empty || t2Empty) {
      try {
        const { runFullChartinkScan, run3CGapScan } = await import("@/lib/chartink-scanner");
        const tasks: Promise<any>[] = [];
        if (t1Empty) tasks.push(runFullChartinkScan());
        if (t2Empty) tasks.push(run3CGapScan());
        await Promise.allSettled(tasks);

        // Re-read populated records
        [t1Results, t2Results] = await Promise.all([
          getGapSignals({ date }),
          get3CGapSignals({ date }),
        ]);
      } catch (scanErr: any) {
        console.warn("[API] Results auto-initial-scan warning:", scanErr.message);
      }
    }

    // Current IST formatted timestamp
    const nowIST = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return NextResponse.json({
      success: true,
      date: t1Results.date,
      // Trick 1
      gapUps: t1Results.gapUps.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      gapDowns: t1Results.gapDowns.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      // Trick 2 (3-Candle Gap)
      m15Up: t2Results.m15Up.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      m15Down: t2Results.m15Down.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      h1Up: t2Results.h1Up.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      h1Down: t2Results.h1Down.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      lastRefreshedAt: nowIST,
    });
  } catch (error: any) {
    console.error("[API] /api/new-trick/results error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve New Trick gap results",
        gapUps: [],
        gapDowns: [],
        m15Up: [],
        m15Down: [],
        h1Up: [],
        h1Down: [],
      },
      { status: 500 }
    );
  }
}
