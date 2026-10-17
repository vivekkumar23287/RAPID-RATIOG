/**
 * init-candles-db.js
 * Run once to create the candles_15m and candle_sync_status tables.
 * Usage: node init-candles-db.js
 */
require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initCandlesDB() {
  const client = await pool.connect();
  try {
    console.log('[INIT] Creating candles tables...');

    await client.query('BEGIN');

    // ── Main candle storage table ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS candles_15m (
        id                BIGSERIAL PRIMARY KEY,
        symbol            VARCHAR(30)  NOT NULL,
        exchange          VARCHAR(20)  NOT NULL DEFAULT 'NSE',
        timeframe         VARCHAR(10)  NOT NULL DEFAULT '15m',
        candle_timestamp  BIGINT       NOT NULL,           -- Unix UTC seconds (candle open time)
        open_price        NUMERIC(18,4) NOT NULL,
        high_price        NUMERIC(18,4) NOT NULL,
        low_price         NUMERIC(18,4) NOT NULL,
        close_price       NUMERIC(18,4) NOT NULL,
        volume            BIGINT        NOT NULL DEFAULT 0,
        is_complete       BOOLEAN       NOT NULL DEFAULT TRUE,
        data_source       VARCHAR(50)   NOT NULL DEFAULT 'yahoo_finance',
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT candles_15m_unique
          UNIQUE (symbol, exchange, timeframe, candle_timestamp)
      );
    `);

    // ── Indexes for fast range queries ───────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candles_symbol_ts
        ON candles_15m (symbol, candle_timestamp);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candles_symbol_exchange_ts
        ON candles_15m (symbol, exchange, candle_timestamp);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candles_ts
        ON candles_15m (candle_timestamp);
    `);

    // ── Sync status table ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS candle_sync_status (
        id                      SERIAL      PRIMARY KEY,
        symbol                  VARCHAR(30) NOT NULL UNIQUE,
        exchange                VARCHAR(20) NOT NULL DEFAULT 'NSE',
        latest_stored_ts        BIGINT,         -- timestamp of newest candle in DB
        latest_complete_ts      BIGINT,         -- timestamp of newest COMPLETED candle known
        last_sync_attempt       TIMESTAMPTZ,
        last_sync_success       TIMESTAMPTZ,
        candles_total           INTEGER     NOT NULL DEFAULT 0,
        candles_last_inserted   INTEGER     NOT NULL DEFAULT 0,
        candles_last_updated    INTEGER     NOT NULL DEFAULT 0,
        last_error              TEXT,
        sync_status             VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|running|ok|error
        known_gaps              JSONB,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('[INIT] ✅ Tables created successfully!');
    console.log('       candles_15m       — stores OHLCV candles');
    console.log('       candle_sync_status — tracks per-symbol sync state');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[INIT] ❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initCandlesDB().catch(() => process.exit(1));
