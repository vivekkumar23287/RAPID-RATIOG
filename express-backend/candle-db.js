/**
 * candle-db.js
 * Database operations for 15-minute candle storage.
 * Uses node-postgres (pg) Pool — same connection as the rest of express-backend.
 */

'use strict';

const { pool } = require('./scanner');  // reuse the existing pg Pool

// ── Upsert a batch of candles ─────────────────────────────────────────────────
/**
 * @param {string} symbol
 * @param {string} exchange
 * @param {Array<{
 *   timestamp: number,   // Unix UTC seconds (candle open)
 *   open: number,
 *   high: number,
 *   low: number,
 *   close: number,
 *   volume: number,
 *   isComplete: boolean
 * }>} candles
 * @returns {{ inserted: number, updated: number }}
 */
async function upsertCandles(symbol, exchange = 'NSE', candles) {
  if (!candles || candles.length === 0) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const c of candles) {
      const result = await client.query(
        `INSERT INTO candles_15m
           (symbol, exchange, timeframe, candle_timestamp,
            open_price, high_price, low_price, close_price, volume, is_complete, data_source, updated_at)
         VALUES ($1, $2, '15m', $3, $4, $5, $6, $7, $8, $9, 'yahoo_finance', NOW())
         ON CONFLICT (symbol, exchange, timeframe, candle_timestamp)
         DO UPDATE SET
           open_price  = EXCLUDED.open_price,
           high_price  = GREATEST(candles_15m.high_price, EXCLUDED.high_price),
           low_price   = LEAST(candles_15m.low_price,   EXCLUDED.low_price),
           close_price = EXCLUDED.close_price,
           volume      = EXCLUDED.volume,
           is_complete = EXCLUDED.is_complete,
           updated_at  = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          symbol.toUpperCase(),
          exchange,
          c.timestamp,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume || 0,
          c.isComplete !== false,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
    return { inserted, updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Fetch candles for a symbol in a time range ────────────────────────────────
/**
 * @param {string} symbol
 * @param {number} fromTs   Unix UTC seconds
 * @param {number} toTs     Unix UTC seconds
 * @param {string} exchange
 * @returns {Array<object>}
 */
async function fetchCandlesFromDB(symbol, fromTs, toTs, exchange = 'NSE') {
  const result = await pool.query(
    `SELECT
       candle_timestamp AS time,
       open_price  AS open,
       high_price  AS high,
       low_price   AS low,
       close_price AS close,
       volume,
       is_complete
     FROM candles_15m
     WHERE symbol   = $1
       AND exchange  = $2
       AND timeframe = '15m'
       AND candle_timestamp >= $3
       AND candle_timestamp <= $4
     ORDER BY candle_timestamp ASC`,
    [symbol.toUpperCase(), exchange, fromTs, toTs]
  );
  return result.rows;
}

// ── Latest stored candle timestamp for a symbol ───────────────────────────────
async function getLatestCandleTs(symbol, exchange = 'NSE') {
  const result = await pool.query(
    `SELECT MAX(candle_timestamp) AS latest_ts
     FROM candles_15m
     WHERE symbol = $1 AND exchange = $2 AND timeframe = '15m'`,
    [symbol.toUpperCase(), exchange]
  );
  return result.rows[0]?.latest_ts ? Number(result.rows[0].latest_ts) : null;
}

// ── Candle count for a symbol ─────────────────────────────────────────────────
async function getCandleCount(symbol, exchange = 'NSE') {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM candles_15m
     WHERE symbol = $1 AND exchange = $2 AND timeframe = '15m'`,
    [symbol.toUpperCase(), exchange]
  );
  return Number(result.rows[0]?.cnt || 0);
}

// ── Update sync status ────────────────────────────────────────────────────────
async function updateSyncStatus(symbol, exchange = 'NSE', update) {
  await pool.query(
    `INSERT INTO candle_sync_status
       (symbol, exchange, latest_stored_ts, latest_complete_ts,
        last_sync_attempt, last_sync_success,
        candles_total, candles_last_inserted, candles_last_updated,
        last_error, sync_status, known_gaps, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (symbol)
     DO UPDATE SET
       exchange              = EXCLUDED.exchange,
       latest_stored_ts      = COALESCE(EXCLUDED.latest_stored_ts, candle_sync_status.latest_stored_ts),
       latest_complete_ts    = COALESCE(EXCLUDED.latest_complete_ts, candle_sync_status.latest_complete_ts),
       last_sync_attempt     = COALESCE(EXCLUDED.last_sync_attempt, candle_sync_status.last_sync_attempt),
       last_sync_success     = COALESCE(EXCLUDED.last_sync_success, candle_sync_status.last_sync_success),
       candles_total         = EXCLUDED.candles_total,
       candles_last_inserted = EXCLUDED.candles_last_inserted,
       candles_last_updated  = EXCLUDED.candles_last_updated,
       last_error            = EXCLUDED.last_error,
       sync_status           = EXCLUDED.sync_status,
       known_gaps            = COALESCE(EXCLUDED.known_gaps, candle_sync_status.known_gaps),
       updated_at            = NOW()`,
    [
      symbol.toUpperCase(),
      exchange,
      update.latestStoredTs   ?? null,
      update.latestCompleteTs ?? null,
      update.lastSyncAttempt  ?? null,
      update.lastSyncSuccess  ?? null,
      update.candlesTotal     ?? 0,
      update.lastInserted     ?? 0,
      update.lastUpdated      ?? 0,
      update.lastError        ?? null,
      update.syncStatus       ?? 'ok',
      update.knownGaps        ? JSON.stringify(update.knownGaps) : null,
    ]
  );
}

// ── Get sync status for one or all symbols ────────────────────────────────────
async function getSyncStatus(symbol) {
  if (symbol) {
    const result = await pool.query(
      `SELECT * FROM candle_sync_status WHERE symbol = $1`,
      [symbol.toUpperCase()]
    );
    return result.rows[0] || null;
  }
  const result = await pool.query(
    `SELECT * FROM candle_sync_status ORDER BY symbol`
  );
  return result.rows;
}

module.exports = {
  upsertCandles,
  fetchCandlesFromDB,
  getLatestCandleTs,
  getCandleCount,
  updateSyncStatus,
  getSyncStatus,
};
