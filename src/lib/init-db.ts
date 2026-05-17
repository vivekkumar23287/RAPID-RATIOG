import { sql } from './db';

export async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Create the live_prices table
    await sql`
      CREATE TABLE IF NOT EXISTS live_prices (
        symbol TEXT PRIMARY KEY,
        price DECIMAL NOT NULL,
        change DECIMAL NOT NULL,
        change_percent DECIMAL NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create the chart_layouts table
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
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}
