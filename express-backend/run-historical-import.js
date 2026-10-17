/**
 * run-historical-import.js
 *
 * One-time bootstrap script.
 * Runs a full sync cycle — for each symbol:
 *   • If no candles exist in DB → fetches 30d of 15m history and saves it.
 *   • If candles already exist  → fetches only the missing gap (incremental).
 *
 * It is safe to run this script multiple times; it will never duplicate candles.
 *
 * Usage:
 *   node run-historical-import.js
 */
'use strict';

require('dotenv').config({ path: '../.env.local' });

// candle-worker uses scanner.js's pool — ensure env is loaded first
const { runSyncCycle } = require('./candle-worker');
const { pool } = require('./scanner');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   RAPID RATIOG — Candle Historical Import / Catch-Up     ║');
  console.log('║                                                           ║');
  console.log('║  Symbols with no stored data → 30-day history import     ║');
  console.log('║  Symbols with existing data  → incremental gap fill only ║');
  console.log('║  Runs are duplicate-safe (DB UNIQUE constraint + upsert) ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Start time (IST):', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('');

  let result;
  try {
    // false = use smart decision (first-import OR incremental per symbol)
    result = await runSyncCycle(false);
  } catch (err) {
    console.error('Fatal error during import:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  if (result) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   IMPORT / SYNC COMPLETE                                 ║');
    console.log(`║   Total inserted : ${String(result.totalInserted).padEnd(35)} ║`);
    console.log(`║   Total updated  : ${String(result.totalUpdated).padEnd(35)} ║`);
    console.log(`║   Errors         : ${String(result.errors + '/' + result.results.length).padEnd(35)} ║`);
    console.log(`║   Elapsed        : ${String(result.elapsed + 's').padEnd(35)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');

    if (result.errors > 0) {
      console.log('');
      console.log('Failed symbols:');
      result.results
        .filter(r => r.error)
        .forEach(r => console.log(`  ✗ ${r.symbol}: ${r.error}`));
    }
  }

  await pool.end().catch(() => {});
  process.exit(0);
}

main();
