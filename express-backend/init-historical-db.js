require('dotenv').config({ path: '../.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function initDB() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS historical_charts (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(50) NOT NULL,
        candle_date DATE NOT NULL,
        interval VARCHAR(10) NOT NULL,
        chart_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, candle_date, interval)
      );
    `;
    await pool.query(query);
    console.log("Table 'historical_charts' created successfully!");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    pool.end();
  }
}

initDB();
