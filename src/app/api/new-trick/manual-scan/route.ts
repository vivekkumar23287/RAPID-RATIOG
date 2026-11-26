import { NextRequest, NextResponse } from "next/server";
import { runFullChartinkScan } from "@/lib/chartink-scanner";
import { getGapSignals, getAvailableTradingDates } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Manual scan triggered for New Trick...");
    const scanOutcome = await runFullChartinkScan({ forceScan: true });

    // Fetch the updated signals
    const [updatedSignals, availableDates] = await Promise.all([
      getGapSignals({ date: scanOutcome.tradingDate }),
      getAvailableTradingDates(),
    ]);

    return NextResponse.json({
      success: scanOutcome.success,
      status: scanOutcome.status,
      tradingDate: scanOutcome.tradingDate,
      error: scanOutcome.error,
      gapUps: updatedSignals.gapUps,
      gapDowns: updatedSignals.gapDowns,
      totalUp: updatedSignals.totalUp,
      totalDown: updatedSignals.totalDown,
      availableDates,
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
