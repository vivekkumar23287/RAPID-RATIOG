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

    const gapUps = updatedSignals.gapUps.length > 0 ? updatedSignals.gapUps : scanOutcome.gapUps;
    const gapDowns = updatedSignals.gapDowns.length > 0 ? updatedSignals.gapDowns : scanOutcome.gapDowns;

    return NextResponse.json({
      success: scanOutcome.success,
      status: scanOutcome.status,
      tradingDate: scanOutcome.tradingDate,
      error: scanOutcome.error,
      gapUps,
      gapDowns,
      totalUp: gapUps.length,
      totalDown: gapDowns.length,
      availableDates: availableDates.length > 0 ? availableDates : [scanOutcome.tradingDate],
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
