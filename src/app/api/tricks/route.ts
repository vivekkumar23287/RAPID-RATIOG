import { NextRequest, NextResponse } from "next/server";
import { getCachedTricksFromDB, runAllScanners, getISTNow } from "@/lib/scanner-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const forceSync = searchParams.get("sync") === "true";

  try {
    // If sync requested explicitly, run scan and wait
    if (forceSync) {
      const freshData = await runAllScanners();
      return NextResponse.json({
        ...freshData,
        source: "live_scan",
        responseTimeMs: Date.now() - startTime,
      });
    }

    // Fast read from Neon PostgreSQL (< 30ms)
    const cached = await getCachedTricksFromDB();

    if (cached) {
      // Background revalidation: If during market hours and last updated > 5 mins ago, refresh asynchronously
      const { isMarketHours } = getISTNow();
      if (isMarketHours && cached.lastUpdated) {
        // Kick off background scan without blocking the response
        setImmediate(() => {
          runAllScanners().catch((err) => {
            console.warn("[API/TRICKS] Background scan error:", err.message);
          });
        });
      }

      return NextResponse.json({
        ...cached,
        source: "neon_db",
        responseTimeMs: Date.now() - startTime,
      });
    }

    // If database has no cached results yet (e.g. initial setup), run unified scan once
    console.log("[API/TRICKS] No DB cache found, running initial unified scan...");
    const freshData = await runAllScanners();

    return NextResponse.json({
      ...freshData,
      source: "initial_scan",
      responseTimeMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error("[API/TRICKS] Error handling tricks request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load tricks data",
        gaps: { gapUps: [], gapDowns: [], timestamp: new Date().toISOString() },
        motherRange: { matches: [], matchesCount: 0, scannedCount: 0, timestamp: new Date().toISOString() },
        breakouts: { matches: [], matchesCount: 0, scannedCount: 0, timestamp: new Date().toISOString() },
        rsi: {
          matches: [],
          confirmed1H: [],
          breakouts15M: [],
          matchesCount: 0,
          confirmed1HCount: 0,
          breakout15MCount: 0,
          timestamp: new Date().toISOString(),
        },
        signals: [],
        lastUpdated: "Error",
      },
      { status: 500 }
    );
  }
}
