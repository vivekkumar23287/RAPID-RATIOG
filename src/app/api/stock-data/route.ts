import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "60m", "1d", "1mo"];
const VALID_RANGES = ["1d", "2d", "5d", "10d", "12d", "15d", "30d", "1y", "max"];
const SYMBOL_REGEX = /^[A-Z0-9&\-]{1,20}$/;

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  NIFTY50: "^NSEI",
  INDIAVIX: "^INDIAVIX",
  IFORGE: "BHARATFORG.NS",
  DEEPAKNTR: "DEEPAKNTR.NS",
  DEEPAKNI: "DEEPAKNTR.NS",
  TATAMOTORS: "TMPV.NS",
  TMCV: "TMPV.NS",
  TMPV: "TMPV.NS",
  BTC: "BTC-USD",
};

function getYahooSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (YAHOO_SYMBOL_MAP[upper]) return YAHOO_SYMBOL_MAP[upper];
  return `${upper}.NS`;
}

// ── Range → seconds look-up ──────────────────────────────────────────────────
function rangeToDays(range: string): number {
  const map: Record<string, number> = {
    "1d": 1, "2d": 2, "5d": 5, "10d": 10, "12d": 12, "15d": 15,
    "30d": 30, "1y": 365, "max": 365,
  };
  return map[range] ?? 30;
}

// ── Serve 15-minute candles from the database (primary source) ───────────────
async function get15mFromDB(
  symbol: string,
  range: string,
): Promise<{ candles: any[]; fromDB: boolean }> {
  try {
    const days   = rangeToDays(range);
    const nowTs  = Math.floor(Date.now() / 1000);
    const fromTs = nowTs - days * 86400;

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
      WHERE symbol    = ${symbol.toUpperCase()}
        AND timeframe  = '15m'
        AND candle_timestamp >= ${fromTs}
        AND candle_timestamp <= ${nowTs}
      ORDER BY candle_timestamp ASC
      LIMIT 10000
    `;

    if (rows.length > 0) {
      const candles = rows.map((r: any) => ({
        time:  Number(r.time),
        open:  Number(r.open),
        high:  Number(r.high),
        low:   Number(r.low),
        close: Number(r.close),
      }));
      return { candles, fromDB: true };
    }
  } catch (e: any) {
    console.warn("[stock-data] DB 15m fetch failed:", e.message);
  }
  return { candles: [], fromDB: false };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol   = searchParams.get("symbol") || "RELIANCE";
  const range    = searchParams.get("range") || "1y";
  const interval = searchParams.get("interval") || "1d";
  const dateParam = searchParams.get("date");

  // Validate inputs against allowlists
  if (!SYMBOL_REGEX.test(symbol.toUpperCase())) {
    return NextResponse.json({ error: "Invalid symbol format" }, { status: 400 });
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }
  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const yahooSymbol = getYahooSymbol(symbol);
  const isIntraday = ["1m", "5m", "15m", "30m", "60m"].includes(interval);
  const CACHE_DURATION_SECONDS = 7;

  // ── Historical date request (existing feature) ────────────────────────────
  if (dateParam) {
    try {
      const [histChart] = await sql`
        SELECT chart_data
        FROM historical_charts
        WHERE symbol = ${symbol.toUpperCase()} AND candle_date = ${dateParam} AND interval = ${interval}
      `;
      if (histChart && histChart.chart_data) {
        const candles = histChart.chart_data;
        const lastCandle = candles[candles.length - 1] || { close: 0, open: 0 };
        const prevCandle = candles.length > 1 ? candles[candles.length - 2] : lastCandle;
        const change = lastCandle.close - prevCandle.close;
        const changePercent = prevCandle.close ? (change / prevCandle.close) * 100 : 0;

        return NextResponse.json({
          symbol: symbol.toUpperCase(),
          name: symbol.toUpperCase(),
          currency: "INR",
          currentPrice: lastCandle.close,
          previousClose: prevCandle.close,
          change: parseFloat(change.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          candles,
          isHistorical: true,
        });
      }
    } catch (e) {
      console.error("Failed fetching historical chart:", e);
    }
  }

  // ── 15-minute interval: try database FIRST ────────────────────────────────
  if (interval === "15m") {
    const { candles: dbCandles, fromDB } = await get15mFromDB(symbol, range);
    if (fromDB && dbCandles.length > 0) {
      // Compute price stats from the candles themselves
      const lastCandle = dbCandles[dbCandles.length - 1];
      const prevCandle = dbCandles.length > 1 ? dbCandles[dbCandles.length - 2] : lastCandle;
      const currentPrice  = lastCandle.close;
      const previousClose = prevCandle.close;
      const change        = currentPrice - previousClose;
      const changePercent = previousClose ? (change / previousClose) * 100 : 0;

      // Enrich the last candle with live price if available (cache check)
      let finalPrice = currentPrice;
      try {
        const [cached] = await sql`
          SELECT price, last_updated FROM live_prices
          WHERE symbol = ${symbol.toUpperCase()}
        `;
        if (cached) {
          const ageSeconds = (Date.now() - new Date(cached.last_updated).getTime()) / 1000;
          if (ageSeconds < 30) {
            finalPrice = Number(cached.price);
          }
        }
      } catch (_) { /* ignore */ }

      // Update forming candle with live price
      const nowTs = Math.floor(Date.now() / 1000);
      const currentSlot = Math.floor(nowTs / 900) * 900;
      const enriched = [...dbCandles];
      const last = enriched[enriched.length - 1];

      if (last && finalPrice > 0 && finalPrice !== currentPrice) {
        if (currentSlot === last.time) {
          enriched[enriched.length - 1] = {
            ...last,
            close: finalPrice,
            high:  Math.max(last.high, finalPrice),
            low:   Math.min(last.low,  finalPrice),
          };
        } else if (currentSlot > last.time) {
          enriched.push({
            time:  currentSlot,
            open:  last.close,
            high:  Math.max(last.close, finalPrice),
            low:   Math.min(last.close, finalPrice),
            close: finalPrice,
          });
        }
      }

      const liveChange        = finalPrice - previousClose;
      const liveChangePercent = previousClose ? (liveChange / previousClose) * 100 : 0;

      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        name: symbol.toUpperCase(),
        currency: "INR",
        currentPrice: parseFloat(finalPrice.toFixed(2)),
        previousClose: parseFloat(previousClose.toFixed(2)),
        change: parseFloat(liveChange.toFixed(2)),
        changePercent: parseFloat(liveChangePercent.toFixed(2)),
        candles: enriched,
        source: "database",
      });
    }
    // If DB has no data, fall through to Yahoo Finance
    console.log(`[stock-data] No DB candles for ${symbol} 15m — falling back to Yahoo`);
  }

  // ── Live price cache check ─────────────────────────────────────────────────
  let cachedData = null;
  let isCacheFresh = false;

  try {
    const [cached] = await sql`
      SELECT price, change, change_percent, last_updated
      FROM live_prices
      WHERE symbol = ${symbol.toUpperCase()}
    `;

    if (cached) {
      cachedData = cached;
      const now = new Date();
      isCacheFresh = (now.getTime() - new Date(cached.last_updated).getTime()) / 1000 < CACHE_DURATION_SECONDS;
    }
  } catch (dbError) {
    console.error("Database cache read error (chart):", dbError);
  }

  // ── Yahoo Finance fetch ────────────────────────────────────────────────────
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}&includePrePost=false`;

    const fetchOptions: RequestInit = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    };

    if (isIntraday) {
      fetchOptions.cache = "no-store";
    } else {
      fetchOptions.next = { revalidate: 300 };
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json(
        { error: "No data found for this symbol" },
        { status: 404 }
      );
    }

    const timestamps = result.timestamp;
    const quote = result.indicators?.quote?.[0];

    if (!timestamps || !quote) {
      return NextResponse.json(
        { error: "Incomplete data from Yahoo Finance" },
        { status: 500 }
      );
    }

    const candles: any[] = [];
    const intervalMap: Record<string, number> = {
      "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "60m": 3600, "1d": 86400,
    };
    const snapSeconds = intervalMap[interval] || 60;

    for (let i = 0; i < timestamps.length; i++) {
      if (
        quote.open[i] != null &&
        quote.high[i] != null &&
        quote.low[i] != null &&
        quote.close[i] != null
      ) {
        const rawTime = timestamps[i];
        const alignedTime = Math.floor(rawTime / snapSeconds) * snapSeconds;

        const open  = parseFloat(quote.open[i].toFixed(2));
        const high  = parseFloat(quote.high[i].toFixed(2));
        const low   = parseFloat(quote.low[i].toFixed(2));
        const close = parseFloat(quote.close[i].toFixed(2));

        const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

        if (lastCandle && lastCandle.time === alignedTime) {
          lastCandle.high  = Math.max(lastCandle.high, high);
          lastCandle.low   = Math.min(lastCandle.low, low);
          lastCandle.close = close;
        } else {
          candles.push({ time: alignedTime, open, high, low, close });
        }
      }
    }

    const meta = result.meta;
    let currentPrice  = meta?.regularMarketPrice || 0;
    let previousClose = meta?.chartPreviousClose || meta?.previousClose || 0;

    if ((!currentPrice || currentPrice === 0) && candles.length > 0) {
      currentPrice = candles[candles.length - 1].close;
    }
    if ((!previousClose || previousClose === 0) && candles.length > 1) {
      previousClose = candles[candles.length - 2].close;
    }

    if (isCacheFresh && isIntraday && cachedData) {
      currentPrice = Number(cachedData.price);
    }

    const change        = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    if (isIntraday && candles.length > 1 && currentPrice > 0) {
      const lastCandle = candles[candles.length - 1];
      const prevCandle = candles[candles.length - 2];
      const nowTs = Math.floor(Date.now() / 1000);
      const currentSlot = Math.floor(nowTs / snapSeconds) * snapSeconds;

      if (currentSlot > lastCandle.time) {
        const pClose = lastCandle.close;
        candles.push({
          time:  currentSlot,
          open:  pClose,
          high:  Math.max(pClose, currentPrice),
          low:   Math.min(pClose, currentPrice),
          close: currentPrice,
        });
      } else if (currentSlot === lastCandle.time) {
        lastCandle.open  = prevCandle.close;
        lastCandle.close = currentPrice;
        lastCandle.high  = Math.max(lastCandle.open, lastCandle.high, currentPrice);
        lastCandle.low   = Math.min(lastCandle.open, lastCandle.low,  currentPrice);
      }
    }

    // Update live price cache (fire-and-forget)
    if (!isCacheFresh) {
      sql`
        INSERT INTO live_prices (symbol, price, change, change_percent, last_updated)
        VALUES (${symbol.toUpperCase()}, ${currentPrice}, ${change}, ${changePercent}, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          price          = EXCLUDED.price,
          change         = EXCLUDED.change,
          change_percent = EXCLUDED.change_percent,
          last_updated   = NOW()
      `.catch(e => console.error("Database cache write error:", e));
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      name:          meta?.shortName || meta?.symbol || symbol,
      currency:      meta?.currency || "INR",
      currentPrice:  parseFloat(currentPrice.toFixed(2)),
      previousClose: parseFloat(previousClose.toFixed(2)),
      change:        parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      candles,
      source: "yahoo_finance",
    });
  } catch (err: any) {
    console.error("Stock data fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stock data" },
      { status: 500 }
    );
  }
}
