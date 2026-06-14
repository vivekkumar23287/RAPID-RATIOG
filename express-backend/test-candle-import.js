/**
 * test-candle-import.js
 * Quick test to verify the candle importer fetches correct, clean candles.
 * Run: node test-candle-import.js
 */

require('dotenv').config({ path: '../.env.local' });
const { fetchCleanCandles, getISTHourMinute, getISTDateString } = require('./candle-importer');

async function test() {
  console.log('═══════════════════════════════════════════════');
  console.log('  CANDLE IMPORTER TEST');
  console.log('  Testing with RELIANCE and NIFTY50');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // Test 1: Fetch RELIANCE candles
  console.log('▶ Test 1: Fetching RELIANCE 15-min candles...');
  const reliance = await fetchCleanCandles('RELIANCE');
  
  if (reliance.quotes.length === 0) {
    console.log('  ✗ No candles returned (market may be closed)');
  } else {
    console.log(`  ✓ Got ${reliance.quotes.length} clean candles`);
    console.log('');
    console.log('  Last 5 candles:');
    const last5 = reliance.quotes.slice(-5);
    last5.forEach(c => {
      const { hours, minutes } = getISTHourMinute(c.timestamp);
      const endHours = Math.floor((c.timestamp + 900) / 3600) % 24;
      console.log(`    ${c.dateStr} | ${c.timeStr} | O:${c.open} H:${c.high} L:${c.low} C:${c.close}`);
      
      // Verify this candle is within market hours
      const totalMin = hours * 60 + minutes;
      const inMarket = totalMin >= 555 && totalMin <= 915;
      const ohlcValid = c.open > 0 && c.high >= c.open && c.low <= c.open && c.close > 0;
      console.log(`           Market hours: ${inMarket ? '✓' : '✗'}  OHLC valid: ${ohlcValid ? '✓' : '✗'}`);
    });
    
    // Check for any O=H or O=L signals on the last candle
    const last = reliance.quotes[reliance.quotes.length - 1];
    if (last.high === last.open) {
      console.log(`\n  ⚡ SIGNAL: RELIANCE Open=High (Bearish) on last candle`);
    } else if (last.low === last.open) {
      console.log(`\n  ⚡ SIGNAL: RELIANCE Open=Low (Bullish) on last candle`);
    } else {
      console.log(`\n  ℹ  No O=H/O=L signal on RELIANCE last candle`);
    }
  }

  console.log('');
  console.log('─────────────────────────────────────────────');
  console.log('');

  // Test 2: Fetch NIFTY50 candles
  console.log('▶ Test 2: Fetching NIFTY50 15-min candles...');
  const nifty = await fetchCleanCandles('NIFTY50');
  
  if (nifty.quotes.length === 0) {
    console.log('  ✗ No candles returned (market may be closed)');
  } else {
    console.log(`  ✓ Got ${nifty.quotes.length} clean candles`);
    console.log('');
    console.log('  Last 5 candles:');
    const last5 = nifty.quotes.slice(-5);
    last5.forEach(c => {
      const isGreen = c.close > c.open ? '🟢' : '🔴';
      console.log(`    ${c.dateStr} | ${c.timeStr} | ${isGreen} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`);
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════════');
}

test().catch(console.error);
