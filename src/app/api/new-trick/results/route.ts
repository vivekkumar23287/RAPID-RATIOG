import { NextRequest, NextResponse } from "next/server";
import { getGapSignals, getAvailableTradingDates } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const signalType = (searchParams.get("signal_type") as any) || "ALL";
    const search = searchParams.get("search") || undefined;

    const [results, availableDates] = await Promise.all([
      getGapSignals({ date, signalType, search }),
      getAvailableTradingDates(),
    ]);

    return NextResponse.json({
      success: true,
      date: results.date,
      gapUps: results.gapUps,
      gapDowns: results.gapDowns,
      totalUp: results.totalUp,
      totalDown: results.totalDown,
      availableDates,
    });
  } catch (error: any) {
    console.error("[API] /api/new-trick/results error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to retrieve New Trick gap results",
        gapUps: [],
        gapDowns: [],
        totalUp: 0,
        totalDown: 0,
        availableDates: [],
      },
      { status: 500 }
    );
  }
}
