/**
 * chartink-backend-scanner.js
 * 
 * Automated Chartink Gap Up/Down and 3-Candle Gap Scanner for FUTURES Segment (Watchlist ID: 33489).
 * - Trick 1: 9:31 AM IST (retry at 9:35, 9:40, 9:45 AM).
 * - Trick 2: 15m & 1h checks throughout trading hours.
 * Saves verified Futures gap results to Neon PostgreSQL.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { pool } = require('./scanner');

// Verified Chartink Futures segment clauses
const CHARTINK_CLAUSE_GAP_UP = "( {33489} ( [=1] 15 minute low > 1 day ago high ) )";
const CHARTINK_CLAUSE_GAP_DOWN = "( {33489} ( [=1] 15 minute high < 1 day ago low ) )";

// Trick 2: 3-Candle Gap Clauses
const CHARTINK_CLAUSE_3C_15M_BULLISH = "( {33489} ( [-1] 15 minute low > [-3] 15 minute high ) )";
const CHARTINK_CLAUSE_3C_15M_BEARISH = "( {33489} ( [-1] 15 minute high < [-3] 15 minute low ) )";
const CHARTINK_CLAUSE_3C_1H_BULLISH = "( {33489} ( [-1] 1 hour low > [-3] 1 hour high ) )";
const CHARTINK_CLAUSE_3C_1H_BEARISH = "( {33489} ( [-1] 1 hour high < [-3] 1 hour low ) )";

// Official NSE Holidays (YYYY-MM-DD)
const NSE_HOLIDAYS = new Set([
  "2026-01-26", "2026-02-17", "2026-03-03", "2026-03-20",
  "2026-04-03", "2026-04-14", "2026-05-01", "2026-05-27",
  "2026-06-26", "2026-08-15", "2026-09-04", "2026-10-02",
  "2026-10-20", "2026-11-08", "2026-11-10", "2026-11-24", "2026-12-25"
]);

function getISTDateParts() {
  const d = new Date();
  const opts = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(d);
  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}:${map.second || '00'}`;
  const isWeekday = map.weekday !== 'Sat' && map.weekday !== 'Sun';
  const isHoliday = NSE_HOLIDAYS.has(dateStr);
  const isTradingDay = isWeekday && !isHoliday;

  return { dateStr, timeStr, weekday: map.weekday, isTradingDay, isHoliday };
}

let cachedSession = null;
let sessionExpiresAt = 0;

/**
 * Fetch CSRF token and cookies from Chartink
 */
async function getChartinkSession() {
  const now = Date.now();
  if (cachedSession && sessionExpiresAt > now) {
    return cachedSession;
  }

  try {
    const res = await fetch('https://chartink.com/screener', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[CHARTINK-BACKEND] Homepage returned HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    const tokenMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    if (!tokenMatch) {
      console.warn('[CHARTINK-BACKEND] CSRF token not found in HTML');
      return null;
    }

    const rawCookies = [];
    const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
    if (typeof getSetCookie === 'function') {
      rawCookies.push(...getSetCookie());
    } else {
      const s = res.headers.get('set-cookie');
      if (s) rawCookies.push(s);
    }

    const cookies = rawCookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');
    cachedSession = { csrfToken: tokenMatch[1], cookies };
    sessionExpiresAt = now + 5 * 60 * 1000;
    return cachedSession;
  } catch (e) {
    console.warn('[CHARTINK-BACKEND] Session error:', e.message);
    return null;
  }
}

/**
 * Run a single screener query
 */
async function queryScreener(clause, session) {
  try {
    const res = await fetch('https://chartink.com/screener/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-csrf-token': session.csrfToken,
        'Cookie': session.cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://chartink.com',
        'Referer': 'https://chartink.com/screener'
      },
      body: new URLSearchParams({ scan_clause: clause }).toString()
    });

    if (!res.ok) {
      console.warn(`[CHARTINK-BACKEND] Screener query returned HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (e) {
    console.warn('[CHARTINK-BACKEND] Query error:', e.message);
    return null;
  }
}

/**
 * Trick 1: Run Gap Up and Gap Down scans
 */
async function runChartinkBackendScan() {
  const ist = getISTDateParts();
  if (!ist.isTradingDay) {
    console.log(`[CHARTINK CRON] Skipping scan — today (${ist.dateStr}, ${ist.weekday}) is not an active trading day.`);
    return;
  }

  console.log(`[CHARTINK CRON] 🚀 Starting automated scan for ${ist.dateStr} at ${ist.timeStr} IST...`);

  const session = await getChartinkSession();
  if (!session) {
    console.error('[CHARTINK CRON] Failed to establish Chartink session.');
    return;
  }

  const [rawUp, rawDown] = await Promise.all([
    queryScreener(CHARTINK_CLAUSE_GAP_UP, session),
    queryScreener(CHARTINK_CLAUSE_GAP_DOWN, session)
  ]);

  if (rawUp === null || rawDown === null) {
    console.error('[CHARTINK CRON] One or both screener queries failed. Aborting DB write.');
    return;
  }

  const gapUps = rawUp.map(item => ({
    symbol: (item.nsecode || item.name || '').trim().toUpperCase(),
    name: item.name || item.nsecode,
    price: item.close ? Number(item.close) : null,
    changePercent: item.per_chg ? Number(item.per_chg) : null
  })).filter(x => x.symbol);

  const gapDowns = rawDown.map(item => ({
    symbol: (item.nsecode || item.name || '').trim().toUpperCase(),
    name: item.name || item.nsecode,
    price: item.close ? Number(item.close) : null,
    changePercent: item.per_chg ? Number(item.per_chg) : null
  })).filter(x => x.symbol);

  console.log(`[CHARTINK CRON] Scan completed: ${gapUps.length} Gap Ups, ${gapDowns.length} Gap Downs.`);

  try {
    for (const item of gapUps) {
      await pool.query(
        `INSERT INTO new_trick_gap_signals (
          company_name, nse_symbol, signal_type, trading_date, candle_time, status, data_source, price, change_percent
        ) VALUES ($1, $2, 'GAP_UP', $3, '09:15 - 09:30 AM', 'CONFIRMED', 'Chartink Futures', $4, $5)
        ON CONFLICT (nse_symbol, signal_type, trading_date)
        DO UPDATE SET company_name = EXCLUDED.company_name, price = EXCLUDED.price, change_percent = EXCLUDED.change_percent, scan_time = CURRENT_TIMESTAMP`,
        [item.name, item.symbol, ist.dateStr, item.price, item.changePercent]
      );
    }

    for (const item of gapDowns) {
      await pool.query(
        `INSERT INTO new_trick_gap_signals (
          company_name, nse_symbol, signal_type, trading_date, candle_time, status, data_source, price, change_percent
        ) VALUES ($1, $2, 'GAP_DOWN', $3, '09:15 - 09:30 AM', 'CONFIRMED', 'Chartink Futures', $4, $5)
        ON CONFLICT (nse_symbol, signal_type, trading_date)
        DO UPDATE SET company_name = EXCLUDED.company_name, price = EXCLUDED.price, change_percent = EXCLUDED.change_percent, scan_time = CURRENT_TIMESTAMP`,
        [item.name, item.symbol, ist.dateStr, item.price, item.changePercent]
      );
    }

    await pool.query(
      `INSERT INTO new_trick_scan_logs (
        scan_type, trading_date, status, gap_up_count, gap_down_count, data_source, details
      ) VALUES ('GAP_UP_DOWN_FUTURES', $1, 'SUCCESS', $2, $3, 'Chartink Futures', $4)`,
      [ist.dateStr, gapUps.length, gapDowns.length, JSON.stringify({
        segment: 'Futures (33489)',
        gapUps: gapUps.map(g => g.symbol),
        gapDowns: gapDowns.map(g => g.symbol)
      })]
    );

    console.log('[CHARTINK CRON] 💾 Successfully saved Futures signals and scan log to Neon DB.');
  } catch (err) {
    console.error('[CHARTINK CRON] Error saving signals to DB:', err.message);
  }
}

/**
 * Trick 2: Run 3-Candle Gap scans (15m & 1h)
 */
async function runChartink3CBackendScan() {
  const ist = getISTDateParts();
  if (!ist.isTradingDay) return;

  console.log(`[CHARTINK-3C CRON] 🚀 Starting 3-Candle Gap scan at ${ist.timeStr} IST...`);

  const session = await getChartinkSession();
  if (!session) return;

  const [r15Up, r15Down, r1hUp, r1hDown] = await Promise.all([
    queryScreener(CHARTINK_CLAUSE_3C_15M_BULLISH, session),
    queryScreener(CHARTINK_CLAUSE_3C_15M_BEARISH, session),
    queryScreener(CHARTINK_CLAUSE_3C_1H_BULLISH, session),
    queryScreener(CHARTINK_CLAUSE_3C_1H_BEARISH, session)
  ]);

  const candleTime = ist.timeStr.slice(0, 5) + ' IST';

  const insertItems = async (items, dir, tf) => {
    if (!items || !items.length) return;
    for (const item of items) {
      const sym = (item.nsecode || item.name || '').trim().toUpperCase();
      if (!sym) continue;
      try {
        await pool.query(
          `INSERT INTO new_trick_3c_signals (
            company_name, nse_symbol, direction, timeframe, candle3_close_time, trading_date, status, data_source, price, change_percent
          ) VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', 'Chartink Futures', $7, $8)
          ON CONFLICT (nse_symbol, direction, timeframe, candle3_close_time, trading_date)
          DO UPDATE SET company_name = EXCLUDED.company_name, price = EXCLUDED.price, change_percent = EXCLUDED.change_percent, scan_time = CURRENT_TIMESTAMP`,
          [item.name || sym, sym, dir, tf, candleTime, ist.dateStr, item.close ? Number(item.close) : null, item.per_chg ? Number(item.per_chg) : null]
        );
      } catch (e) {
        console.warn(`[CHARTINK-3C CRON] Insert error for ${sym}:`, e.message);
      }
    }
  };

  await Promise.all([
    insertItems(r15Up, 'BULLISH', '15m'),
    insertItems(r15Down, 'BEARISH', '15m'),
    insertItems(r1hUp, 'BULLISH', '1h'),
    insertItems(r1hDown, 'BEARISH', '1h')
  ]);

  console.log(`[CHARTINK-3C CRON] ✅ 3C Scan complete: 15m Up=${r15Up?.length || 0}, 15m Down=${r15Down?.length || 0}, 1h Up=${r1hUp?.length || 0}, 1h Down=${r1hDown?.length || 0}`);
}

module.exports = {
  runChartinkBackendScan,
  runChartink3CBackendScan,
  getChartinkSession,
  queryScreener,
};
