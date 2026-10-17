/**
 * backfill-single.js
 * Backfills a single symbol. Usage: node backfill-single.js NIFTY50
 */
'use strict';
require('dotenv').config({ path: '../.env.local' });

const symbol = process.argv[2];
if (!symbol) {
  console.error('Usage: node backfill-single.js <SYMBOL>');
  process.exit(1);
}

const { backfillSymbol } = require('./candle-worker');
const { pool } = require('./scanner');

backfillSymbol(symbol.toUpperCase())
  .then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    pool.end().then(() => process.exit(1));
  });
