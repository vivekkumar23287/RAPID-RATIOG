import { NextRequest, NextResponse } from "next/server";
import { runFullChartinkScan } from "@/lib/chartink-scanner";
import { getGapSignals } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Fast manual scan triggered for New Trick...");
    const scanOutcome = await runFullChartinkScan({ forceScan: true });

    // Fetch updated signals from DB/cache
    const updatedSignals = await getGapSignals({ date: scanOutcome.tradingDate });

    const gapUps = updatedSignals.gapUps.length > 0 ? updatedSignals.gapUps : scanOutcome.gapUps;
    const gapDowns = updatedSignals.gapDowns.length > 0 ? updatedSignals.gapDowns : scanOutcome.gapDowns;

    // Current IST time string (e.g. "10:47 PM")
    const nowIST = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return NextResponse.json({
      success: scanOutcome.success,
      status: scanOutcome.status,
      tradingDate: scanOutcome.tradingDate,
      error: scanOutcome.error,
      gapUps: gapUps.map((s) => ({
        nse_symbol: s.nse_symbol,
        company_name: s.company_name,
      })),
      gapDowns: gapDowns.map((s) => ({
        nse_symbol: s.nse_symbol,
        company_name: s.company_name,
      })),
      totalUp: gapUps.length,
      totalDown: gapDowns.length,
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
