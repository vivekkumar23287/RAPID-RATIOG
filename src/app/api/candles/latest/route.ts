import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SYMBOL_REGEX = /^[A-Z0-9&\-^]{1,20}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol     = (searchParams.get('symbol') || '').toUpperCase().trim();
  const limitParam = searchParams.get('limit');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }
  if (!SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
  }

  const maxRows = limitParam ? Math.min(parseInt(limitParam, 10), 2000) : 500;

  try {
    const rows = await sql`
      SELECT
        candle_timestamp AS time,
        open_price       AS open,
        high_price       AS high,
        low_price        AS low,
        close_price      AS close,
        volume,
        is_complete
      FROM candles_15m
      WHERE symbol   = ${symbol}
        AND timeframe = '15m'
      ORDER BY candle_timestamp DESC
      LIMIT ${maxRows}
    `;

    const candles = rows
      .map((r: any) => ({
        time:       Number(r.time),
        open:       Number(r.open),
        high:       Number(r.high),
        low:        Number(r.low),
        close:      Number(r.close),
        volume:     Number(r.volume),
        isComplete: r.is_complete,
      }))
      .reverse();

    return NextResponse.json({
      symbol,
      timeframe: '15m',
      count: candles.length,
      candles,
    });
  } catch (err: any) {
    console.error('[GET /api/candles/latest] Error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch latest candles' }, { status: 500 });
  }
}
