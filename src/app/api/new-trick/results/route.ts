import { NextRequest, NextResponse } from "next/server";
import { getGapSignals, get3CGapSignals } from "@/lib/new-trick-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;

    // Fetch both Trick 1 (Gap Up & Down) and Trick 2 (3-Candle Gap) concurrently
    const [t1Results, t2Results] = await Promise.all([
      getGapSignals({ date }),
      get3CGapSignals({ date }),
    ]);

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
