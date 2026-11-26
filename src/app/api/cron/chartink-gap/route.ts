import { NextRequest, NextResponse } from "next/server";
import { runFullChartinkScan, run3CGapScan } from "@/lib/chartink-scanner";
import { getISTMarketTime } from "@/lib/nse-calendar";

export const dynamic = "force-dynamic";

/**
 * Scheduled cron endpoint for Chartink Gap Up / Down scanner.
 * Expected execution: Monday to Friday at 9:31 AM IST (retry at 9:35, 9:40, 9:45 AM if needed).
 * Protected by secret key CRON_SECRET or WORKER_SECRET.
 */
export async function GET(req: NextRequest) {
  return handleCronExecution(req);
}

export async function POST(req: NextRequest) {
  return handleCronExecution(req);
}

async function handleCronExecution(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const secretParam = req.nextUrl.searchParams.get("secret") || "";
  const expectedSecret = process.env.CRON_SECRET || process.env.WORKER_SECRET || "rapidratio-chartink-secret";

  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isAuthorized = bearerToken === expectedSecret || secretParam === expectedSecret;

  if (process.env.NODE_ENV === "production" && !isAuthorized) {
    return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
  }

  const marketTime = getISTMarketTime();
  console.log(`[CRON] Chartink gap scanner triggered at ${marketTime.dateStr} ${marketTime.timeStr} IST`);

  // Skip non-trading days
  if (!marketTime.isTradingDay) {
    return NextResponse.json({
      success: true,
      message: `Skipped: Market is closed today (${marketTime.weekday}, Holiday: ${marketTime.isHoliday})`,
      date: marketTime.dateStr,
      status: "MARKET_CLOSED",
    });
  }

  const result = await runFullChartinkScan({
    isScheduled: true,
    targetDate: marketTime.dateStr,
  });

  // Also run Trick 2 (3-Candle Gap) scan
  await run3CGapScan({
    targetDate: marketTime.dateStr,
  });

  return NextResponse.json({
    success: result.success,
    status: result.status,
    tradingDate: result.tradingDate,
    gapUpCount: result.gapUps.length,
    gapDownCount: result.gapDowns.length,
    error: result.error,
    timestamp: new Date().toISOString(),
  });
}
