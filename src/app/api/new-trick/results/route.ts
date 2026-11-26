import { NextRequest, NextResponse } from "next/server";
import { getGapSignals } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;

    const results = await getGapSignals({ date });

    // Format timestamp in IST
    const nowIST = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return NextResponse.json({
      success: true,
      date: results.date,
      gapUps: results.gapUps.map((s) => ({
        nse_symbol: s.nse_symbol,
        company_name: s.company_name,
      })),
      gapDowns: results.gapDowns.map((s) => ({
        nse_symbol: s.nse_symbol,
        company_name: s.company_name,
      })),
      totalUp: results.totalUp,
      totalDown: results.totalDown,
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
        totalUp: 0,
        totalDown: 0,
      },
      { status: 500 }
    );
  }
}
