import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SYMBOL_REGEX = /^[A-Z0-9&\-^]{1,20}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const symbol    = (searchParams.get('symbol') || '').toUpperCase().trim();
  const fromParam = searchParams.get('from');
  const toParam   = searchParams.get('to');
  const limitParam = searchParams.get('limit');
  const daysParam  = searchParams.get('days');  // shorthand: days=12, days=30, days=90

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }
  if (!SYMBOL_REGEX.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
  }

  const nowTs  = Math.floor(Date.now() / 1000);
  let fromTs: number;
  let toTs:   number;

  if (daysParam) {
    const days = parseInt(daysParam, 10);
    if (isNaN(days) || days < 1 || days > 1095) {
      return NextResponse.json({ error: 'days must be between 1 and 1095' }, { status: 400 });
    }
    fromTs = nowTs - days * 86400;
    toTs   = nowTs;
  } else {
    fromTs = fromParam ? parseInt(fromParam, 10) : nowTs - 30 * 86400;
    toTs   = toParam   ? parseInt(toParam,   10) : nowTs;
  }

  if (isNaN(fromTs) || isNaN(toTs) || fromTs >= toTs) {
    return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
  }

  const maxRows = limitParam ? Math.min(parseInt(limitParam, 10), 30000) : 30000;

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
      WHERE symbol    = ${symbol}
        AND timeframe  = '15m'
        AND candle_timestamp >= ${fromTs}
        AND candle_timestamp <= ${toTs}
      ORDER BY candle_timestamp ASC
      LIMIT ${maxRows}
    `;

    const candles = rows.map((r: any) => ({
      time:       Number(r.time),
      open:       Number(r.open),
      high:       Number(r.high),
      low:        Number(r.low),
      close:      Number(r.close),
      volume:     Number(r.volume),
      isComplete: r.is_complete,
    }));

    return NextResponse.json({
      symbol,
      timeframe: '15m',
      from: fromTs,
      to: toTs,
      count: candles.length,
      candles,
    });
  } catch (err: any) {
    console.error('[GET /api/candles] Error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch candles' }, { status: 500 });
  }
}
