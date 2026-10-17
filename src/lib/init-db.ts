import { sql } from './db';

export async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    
    await sql`
      CREATE TABLE IF NOT EXISTS live_prices (
        symbol TEXT PRIMARY KEY,
        price DECIMAL NOT NULL,
        change DECIMAL NOT NULL,
        change_percent DECIMAL NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    
    await sql`
      CREATE TABLE IF NOT EXISTS chart_layouts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_layouts_user_symbol ON chart_layouts(user_id, symbol);
    `;

    
    await sql`
      CREATE TABLE IF NOT EXISTS signals_history (
        id SERIAL PRIMARY KEY,
        stock_symbol TEXT NOT NULL,
        stock_name TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open_price DECIMAL NOT NULL,
        high_price DECIMAL NOT NULL,
        low_price DECIMAL NOT NULL,
        close_price DECIMAL NOT NULL,
        candle_time TEXT NOT NULL,
        candle_date TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_symbol, candle_time)
      );
      CREATE INDEX IF NOT EXISTS idx_signals_date ON signals_history(candle_date);
    `;

    // Scanner cache table (previously created inline in API handlers)
    await sql`
      CREATE TABLE IF NOT EXISTS scanner_cache (
        id SERIAL PRIMARY KEY,
        date_str VARCHAR(20) NOT NULL,
        scanner_type VARCHAR(50) NOT NULL,
        results JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date_str, scanner_type)
      );
    `;

    // ── 15-minute candle storage ──────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS candles_15m (
        id                BIGSERIAL PRIMARY KEY,
        symbol            VARCHAR(30)   NOT NULL,
        exchange          VARCHAR(20)   NOT NULL DEFAULT 'NSE',
        timeframe         VARCHAR(10)   NOT NULL DEFAULT '15m',
        candle_timestamp  BIGINT        NOT NULL,
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
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_candles_symbol_ts
        ON candles_15m (symbol, candle_timestamp);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_candles_ts
        ON candles_15m (candle_timestamp);
    `;

    // ── Sync status table ─────────────────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS candle_sync_status (
        id                      SERIAL      PRIMARY KEY,
        symbol                  VARCHAR(30) NOT NULL UNIQUE,
        exchange                VARCHAR(20) NOT NULL DEFAULT 'NSE',
        latest_stored_ts        BIGINT,
        latest_complete_ts      BIGINT,
        last_sync_attempt       TIMESTAMPTZ,
        last_sync_success       TIMESTAMPTZ,
        candles_total           INTEGER     NOT NULL DEFAULT 0,
        candles_last_inserted   INTEGER     NOT NULL DEFAULT 0,
        candles_last_updated    INTEGER     NOT NULL DEFAULT 0,
        last_error              TEXT,
        sync_status             VARCHAR(20) NOT NULL DEFAULT 'pending',
        known_gaps              JSONB,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

