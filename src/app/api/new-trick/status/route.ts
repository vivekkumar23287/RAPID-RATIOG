import { NextResponse } from "next/server";
import { getScannerStatusSummary } from "@/lib/new-trick-db";
import { getISTMarketTime } from "@/lib/nse-calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [summary, marketTime] = await Promise.all([
      getScannerStatusSummary(),
      getISTMarketTime(),
    ]);

    return NextResponse.json({
      success: true,
      summary: {
        ...summary,
        isMarketHours: marketTime.isMarketHours,
        isTradingDay: marketTime.isTradingDay,
        currentTimeIST: marketTime.timeStr,
        currentDateIST: marketTime.dateStr,
      },
    });
  } catch (error: any) {
    console.error("[API] /api/new-trick/status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch scanner status",
      },
      { status: 500 }
    );
  }
}
