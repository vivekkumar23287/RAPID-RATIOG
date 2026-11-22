import { NextRequest, NextResponse } from "next/server";
import { runAllScanners, getISTNow } from "@/lib/scanner-service";

export const dynamic = "force-dynamic";

/**
 * Background Cron Worker Route: /api/cron/scan
 *
 * Triggered periodically (e.g. every 15 minutes during market hours)
 * to scan all 5 NSE tricks and store final results in Neon PostgreSQL.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.WORKER_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("key") !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { dateStr, timeStr, isMarketHours } = getISTNow();
  console.log(`[CRON/SCAN] ⏰ Triggered at ${dateStr} ${timeStr} (Market Open: ${isMarketHours})`);

  try {
    const result = await runAllScanners();
    return NextResponse.json({
      success: true,
      message: "Unified scan complete and stored in Neon DB",
      durationMs: result.durationMs,
      matches: {
        gapUps: result.gaps.gapUps.length,
        gapDowns: result.gaps.gapDowns.length,
        motherRange: result.motherRange.matchesCount,
        breakouts: result.breakouts.matchesCount,
        rsi: result.rsi.matchesCount,
        signals: result.signals.length,
      },
      lastUpdated: result.lastUpdated,
    });
  } catch (error: any) {
    console.error("[CRON/SCAN] Scanner error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Cron scan failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
