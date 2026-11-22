import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { saveScannerToDB } from "@/lib/server-scanner-cache";

export const dynamic = "force-dynamic";

/**
 * Background / Cron synchronization endpoint.
 * Performs calculations outside of website user page visits,
 * saving finalized results into Neon DB (scanner_cache table).
 * The website simply serves these saved results instantaneously.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.WORKER_SECRET || "";

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const now = new Date();
  const nowISTString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const nowIST = new Date(nowISTString);
  const dateStr = `${nowIST.getFullYear()}-${(nowIST.getMonth() + 1).toString().padStart(2, '0')}-${nowIST.getDate().toString().padStart(2, '0')}`;

  const summary: Record<string, any> = {};

  try {
    const origin = req.nextUrl.origin;

    // Trigger individual scanners in force-sync mode
    const [resGaps, res5c, res3c, resRsi] = await Promise.allSettled([
      fetch(`${origin}/api/nse-gaps?sync=true`).then(r => r.json()),
      fetch(`${origin}/api/scanner-5c?sync=true`).then(r => r.json()),
      fetch(`${origin}/api/scanner-3c?sync=true`).then(r => r.json()),
      fetch(`${origin}/api/scanner-rsi?sync=true`).then(r => r.json()),
    ]);

    summary["nse-gaps"] = resGaps.status === "fulfilled" ? "ok" : "failed";
    summary["scanner-5c"] = res5c.status === "fulfilled" ? "ok" : "failed";
    summary["scanner-3c"] = res3c.status === "fulfilled" ? "ok" : "failed";
    summary["scanner-rsi"] = resRsi.status === "fulfilled" ? "ok" : "failed";

    return NextResponse.json({
      success: true,
      message: "Database scanner cache updated successfully",
      date: dateStr,
      summary,
      timeTakenMs: Date.now() - startTime
    });
  } catch (error: any) {
    console.error("Scanner sync error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to sync scanner cache"
    }, { status: 500 });
  }
}
