import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SYMBOL_REGEX = /^[A-Z0-9&\-^]{1,20}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase().trim();

  try {
    if (symbol) {
      if (!SYMBOL_REGEX.test(symbol)) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
      }

      // Single symbol status
      const [statusRow] = await sql`
        SELECT
          s.symbol,
          s.exchange,
          s.latest_stored_ts,
          s.latest_complete_ts,
          s.last_sync_attempt,
          s.last_sync_success,
          s.candles_total,
          s.candles_last_inserted,
          s.candles_last_updated,
          s.last_error,
          s.sync_status,
          s.known_gaps,
          s.updated_at,
          (SELECT MIN(candle_timestamp) FROM candles_15m c
           WHERE c.symbol = s.symbol AND c.timeframe = '15m') AS earliest_ts
        FROM candle_sync_status s
        WHERE s.symbol = ${symbol}
      `;

      if (!statusRow) {
        return NextResponse.json({
          symbol,
          status: 'not_synced',
          candles_total: 0,
          message: 'No sync record found. Run the candle worker to start collecting data.',
        });
      }

      return NextResponse.json({
        symbol: statusRow.symbol,
        exchange: statusRow.exchange,
        latestStoredTs: statusRow.latest_stored_ts ? Number(statusRow.latest_stored_ts) : null,
        latestCompleteTs: statusRow.latest_complete_ts ? Number(statusRow.latest_complete_ts) : null,
        earliestTs: statusRow.earliest_ts ? Number(statusRow.earliest_ts) : null,
        lastSyncAttempt: statusRow.last_sync_attempt,
        lastSyncSuccess: statusRow.last_sync_success,
        candlesTotal: Number(statusRow.candles_total),
        candlesLastInserted: Number(statusRow.candles_last_inserted),
        candlesLastUpdated: Number(statusRow.candles_last_updated),
        lastError: statusRow.last_error,
        syncStatus: statusRow.sync_status,
        knownGaps: statusRow.known_gaps,
        updatedAt: statusRow.updated_at,
      });
    }

    // All symbols summary
    const rows = await sql`
      SELECT
        s.symbol,
        s.exchange,
        s.sync_status,
        s.candles_total,
        s.latest_stored_ts,
        s.last_sync_success,
        s.last_error
      FROM candle_sync_status s
      ORDER BY s.symbol
    `;

    // Overall stats
    const [statsRow] = await sql`
      SELECT
        COUNT(DISTINCT symbol) AS total_symbols,
        COUNT(*) AS total_candles,
        MIN(candle_timestamp) AS oldest_ts,
        MAX(candle_timestamp) AS newest_ts
      FROM candles_15m
      WHERE timeframe = '15m'
    `;

    return NextResponse.json({
      overall: {
        totalSymbols: Number(statsRow?.total_symbols || 0),
        totalCandles: Number(statsRow?.total_candles || 0),
        oldestTs: statsRow?.oldest_ts ? Number(statsRow.oldest_ts) : null,
        newestTs: statsRow?.newest_ts ? Number(statsRow.newest_ts) : null,
      },
      symbols: rows.map((r: any) => ({
        symbol: r.symbol,
        exchange: r.exchange,
        syncStatus: r.sync_status,
        candlesTotal: Number(r.candles_total),
        latestStoredTs: r.latest_stored_ts ? Number(r.latest_stored_ts) : null,
        lastSyncSuccess: r.last_sync_success,
        lastError: r.last_error,
      })),
    });
  } catch (err: any) {
    console.error('[GET /api/candles/status] Error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }
}
