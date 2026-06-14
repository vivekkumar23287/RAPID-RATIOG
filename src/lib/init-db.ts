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
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}
