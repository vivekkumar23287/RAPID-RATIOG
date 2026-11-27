import { NextRequest, NextResponse } from "next/server";
import { runFullChartinkScan, run3CGapScan } from "@/lib/chartink-scanner";
import { getGapSignals, get3CGapSignals } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Manual scan triggered for New Trick (Trick 1 & Trick 2)...");

    // Run both scans concurrently
    const [t1Outcome, t2Outcome] = await Promise.all([
      runFullChartinkScan({ forceScan: true }),
      run3CGapScan(),
    ]);

    // Fetch updated signals from DB/cache
    const [updatedT1, updatedT2] = await Promise.all([
      getGapSignals({ date: t1Outcome.tradingDate }),
      get3CGapSignals({ date: t1Outcome.tradingDate }),
    ]);

    const gapUps = updatedT1.gapUps.length > 0 ? updatedT1.gapUps : t1Outcome.gapUps;
    const gapDowns = updatedT1.gapDowns.length > 0 ? updatedT1.gapDowns : t1Outcome.gapDowns;

    const m15Up = updatedT2.m15Up.length > 0 ? updatedT2.m15Up : t2Outcome.m15Up;
    const m15Down = updatedT2.m15Down.length > 0 ? updatedT2.m15Down : t2Outcome.m15Down;
    const h1Up = updatedT2.h1Up.length > 0 ? updatedT2.h1Up : t2Outcome.h1Up;
    const h1Down = updatedT2.h1Down.length > 0 ? updatedT2.h1Down : t2Outcome.h1Down;

    // Current IST time string
    const nowIST = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return NextResponse.json({
      success: t1Outcome.success || t2Outcome.success,
      tradingDate: t1Outcome.tradingDate,
      gapUps: gapUps.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      gapDowns: gapDowns.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
      })),
      m15Up: m15Up.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
        added_at: s.added_at || s.candle3_close_time || "Today",
        is_new: true,
      })),
      m15Down: m15Down.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
        added_at: s.added_at || s.candle3_close_time || "Today",
        is_new: true,
      })),
      h1Up: h1Up.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
        added_at: s.added_at || s.candle3_close_time || "Today",
        is_new: true,
      })),
      h1Down: h1Down.map((s) => ({
        company_name: s.company_name,
        nse_symbol: s.nse_symbol,
        added_at: s.added_at || s.candle3_close_time || "Today",
        is_new: true,
      })),
      lastRefreshedAt: nowIST,
    });
  } catch (error: any) {
    console.error("[API] /api/new-trick/manual-scan error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute manual scan",
      },
      { status: 500 }
    );
  }
}
