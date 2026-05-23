require('dotenv').config({ path: '../.env.local' });
const { pool } = require('./scanner');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function testExport() {
  try {
    const today = new Date();
    const optionsDate = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateParts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(today);
    const todayStr = `${dateParts.find(p=>p.type==='day').value}/${dateParts.find(p=>p.type==='month').value}/${dateParts.find(p=>p.type==='year').value}`;

    const { rows } = await pool.query(
      'SELECT * FROM signals_history WHERE candle_date = $1 ORDER BY id ASC',
      [todayStr]
    );

    const exportData = rows.map(row => ({
      "Company Name": row.stock_name,
      "Date": row.candle_date,
      "Time": row.candle_time,
      "Timeframe": row.timeframe,
      "Signal Direction": row.direction === 'UP' ? 'Green (Bullish)' : 'Red (Bearish)'
    }));

    if (exportData.length === 0) {
        exportData.push({
            "Company Name": "Test Co",
            "Date": todayStr,
            "Time": "15:00",
            "Timeframe": "15m",
            "Signal Direction": "Green (Bullish)"
        });
    }

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Today Signals");

    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    const safeDateStr = todayStr.replace(/\//g, '-');
    const fileName = `Signals_History_${safeDateStr}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    xlsx.writeFile(wb, filePath);
    console.log(`Successfully exported today's signals to ${filePath}`);
  } catch (error) {
    console.error('Error generating Excel export:', error);
  } finally {
      pool.end();
  }
}

testExport();
