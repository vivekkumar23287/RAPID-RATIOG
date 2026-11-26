/**
 * chartink-backend-scanner.js
 * 
 * Automated Chartink Gap Up and Gap Down Scanner for FUTURES Segment (Chartink Watchlist ID: 33489).
 * Runs on cron at 9:31 AM IST (with retries at 9:35, 9:40, 9:45 AM).
 * Saves verified Futures gap results to Neon PostgreSQL.
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
const { pool } = require('./scanner');

// Verified Chartink Futures segment clauses
const CHARTINK_CLAUSE_GAP_UP = "( {33489} ( [=1] 15 minute low > 1 day ago high ) )";
const CHARTINK_CLAUSE_GAP_DOWN = "( {33489} ( [=1] 15 minute high < 1 day ago low ) )";

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

/**
 * Fetch CSRF token and cookies from Chartink
 */
async function getChartinkSession() {
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
    return { csrfToken: tokenMatch[1], cookies };
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
      console.warn(`[CHARTINK-BACKEND] Process endpoint returned HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  } catch (e) {
    console.warn('[CHARTINK-BACKEND] Query error:', e.message);
    return null;
  }
}

/**
 * Main function executed by cron for Futures segment
 */
async function runChartinkBackendScan() {
  const ist = getISTDateParts();
  console.log(`\n[CHARTINK CRON] ⏰ Scheduled Futures scan triggered at ${ist.dateStr} ${ist.timeStr} IST`);

  if (!ist.isTradingDay) {
    console.log(`[CHARTINK CRON] ⏸️ Skipped: Market is closed today (${ist.weekday}, Holiday: ${ist.isHoliday})`);
    return;
  }

  // Check if today already has confirmed scan results
  try {
    const existing = await pool.query(
      `SELECT COUNT(*) as count FROM new_trick_scan_logs 
       WHERE trading_date = $1 AND status = 'SUCCESS'`,
      [ist.dateStr]
    );
    if (existing.rows[0]?.count > 0) {
      console.log(`[CHARTINK CRON] ℹ️ Today (${ist.dateStr}) already successfully scanned. Skipping redundant execution.`);
      return;
    }
  } catch (err) {
    // Continue if table is being created
  }

  const session = await getChartinkSession();
  if (!session) {
    console.warn('[CHARTINK CRON] ❌ Failed to get Chartink session token. Will retry on next scheduled interval.');
    return;
  }

  // 1. Scan GAP UP (Futures: 33489)
  console.log('[CHARTINK CRON] Running GAP UP scan for Futures segment (ID: 33489)...');
  const upData = await queryScreener(CHARTINK_CLAUSE_GAP_UP, session);

  // 2. Scan GAP DOWN (Futures: 33489)
  console.log('[CHARTINK CRON] Running GAP DOWN scan for Futures segment (ID: 33489)...');
  const downData = await queryScreener(CHARTINK_CLAUSE_GAP_DOWN, session);

  if (upData === null || downData === null) {
    console.warn('[CHARTINK CRON] ❌ Chartink query failed. Will retry on next schedule.');
    return;
  }

  // Map all stocks returned in the Futures segment without any hardcoded filtering
  const gapUps = (upData || [])
    .filter(item => Boolean(item.nsecode))
    .map(item => ({
      symbol: item.nsecode.toUpperCase().trim(),
      name: item.name || item.nsecode,
      price: item.close ? Number(item.close) : null,
      changePercent: item.per_chg ? Number(item.per_chg) : null,
      type: 'GAP_UP'
    }));

  const gapDowns = (downData || [])
    .filter(item => Boolean(item.nsecode))
    .map(item => ({
      symbol: item.nsecode.toUpperCase().trim(),
      name: item.name || item.nsecode,
      price: item.close ? Number(item.close) : null,
      changePercent: item.per_chg ? Number(item.per_chg) : null,
      type: 'GAP_DOWN'
    }));

  console.log(`[CHARTINK CRON] ✅ Found ${gapUps.length} Gap Ups, ${gapDowns.length} Gap Downs in Futures Segment:`, {
    gapUps: gapUps.map(g => g.symbol),
    gapDowns: gapDowns.map(g => g.symbol)
  });

  // Save to DB
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

module.exports = {
  runChartinkBackendScan,
  getChartinkSession,
  queryScreener,
};
