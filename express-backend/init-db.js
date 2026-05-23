require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDB() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS signals_history (
        id SERIAL PRIMARY KEY,
        stock_symbol VARCHAR(50) NOT NULL,
        stock_name VARCHAR(255),
        signal_type VARCHAR(50),
        direction VARCHAR(10),
        timeframe VARCHAR(10),
        open_price NUMERIC,
        high_price NUMERIC,
        low_price NUMERIC,
        close_price NUMERIC,
        candle_time VARCHAR(50),
        candle_date VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_symbol, candle_time)
      );
    `;
    await pool.query(query);
    console.log("Table 'signals_history' created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    pool.end();
  }
}

initDB();
