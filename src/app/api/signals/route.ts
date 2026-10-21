import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

let cachedSignals: any[] = [];

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        id,
        stock_symbol,
        stock_name,
        signal_type,
        direction,
        timeframe,
        open_price,
        high_price,
        low_price,
        close_price,
        candle_time,
        candle_date,
        created_at
      FROM signals_history
      ORDER BY id DESC
      LIMIT 100
    `;

    if (rows && rows.length > 0) {
      cachedSignals = rows;
    }

    return NextResponse.json({
      success: true,
      data: cachedSignals.length > 0 ? cachedSignals : rows,
      count: (cachedSignals.length > 0 ? cachedSignals : rows).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn("Signals DB read warning, using memory cache:", error.message);
    if (cachedSignals.length > 0) {
      return NextResponse.json({
        success: true,
        data: cachedSignals,
        count: cachedSignals.length,
        timestamp: new Date().toISOString(),
        fromCache: true,
      });
    }

    return NextResponse.json(
      { success: false, data: [], error: error.message || "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
