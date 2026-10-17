require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
console.log('DB URL present:', !!url);

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const r1 = await client.query('SELECT COUNT(*) AS total, COUNT(DISTINCT symbol) AS symbols FROM candles_15m');
    console.log('candles_15m total:', r1.rows[0].total, '| distinct symbols:', r1.rows[0].symbols);

    const r2 = await client.query('SELECT symbol, candles_total, sync_status FROM candle_sync_status ORDER BY symbol');
    console.log('\ncandle_sync_status rows:', r2.rows.length);
    r2.rows.forEach(x => console.log(' ', x.symbol.padEnd(15), String(x.candles_total).padStart(5), x.sync_status));
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
