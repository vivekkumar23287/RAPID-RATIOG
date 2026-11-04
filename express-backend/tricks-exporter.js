/**
 * tricks-exporter.js
 *
 * Automatically collects all stocks that triggered ANY of the 4 NSE Tricks:
 *   1. Trick 1: True Gap Scanner (Gap Up / Gap Down)
 *   2. Trick 2: 5-Candle Mother Range Setup
 *   3. Trick 3: 15-Minute 3-Candle Bullish Breakout Setup
 *   4. Trick 4: Live 15-Min Open=High (Bearish) & Open=Low (Bullish) Signals
 *
 * Runs every working day (Mon-Fri) at 4:00 PM IST (16:00).
 * Generates/updates an Excel workbook with sheet name "date".
 */

'use strict';

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { pool } = require('./scanner');
const { importAllCandles, ALL_SYMBOLS, getISTDateString, getISTTimeString } = require('./candle-importer');

/**
 * Helper to get current Indian Standard Time (IST) date string in DD/MM/YYYY format
 */
function getTodayISTString() {
  const d = new Date();
  const opts = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-IN', opts).formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return `${day}/${month}/${year}`;
}

/**
 * Scan for Trick 1: True Gap Scanner (Gap Up and Gap Down)
 */
function scanTrick1Gaps(allCandles, todayStr) {
  const gapResults = [];

  for (const [symbol, data] of Object.entries(allCandles)) {
    if (symbol === 'NIFTY50') continue;
    try {
      const quotes = data.quotes || [];
      if (quotes.length < 2) continue;

      // Group quotes by date
      const candleGroups = {};
      quotes.forEach(q => {
        if (!candleGroups[q.dateStr]) candleGroups[q.dateStr] = [];
        candleGroups[q.dateStr].push(q);
      });

      const dates = Object.keys(candleGroups).sort((a, b) => {
        const [dA, mA, yA] = a.split('/').map(Number);
        const [dB, mB, yB] = b.split('/').map(Number);
        return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
      });

      if (dates.length < 2) continue;
      const todayDate = dates[dates.length - 1];
      const prevDate = dates[dates.length - 2];

      const todayCandles = candleGroups[todayDate] || [];
      const prevCandles = candleGroups[prevDate] || [];
      if (todayCandles.length === 0 || prevCandles.length === 0) continue;

      const prevHigh = Math.max(...prevCandles.map(c => c.high));
      const prevLow = Math.min(...prevCandles.map(c => c.low));

      const firstCandle = todayCandles[0];
      if (!firstCandle) continue;

      const isGapUp = firstCandle.low > prevHigh;
      const isGapDown = firstCandle.high < prevLow;

      if (isGapUp) {
        const gapPct = (((firstCandle.open - prevHigh) / prevHigh) * 100).toFixed(2);
        gapResults.push({
          "Date": todayDate,
          "Time": "09:15 - 09:30",
          "Company Name": data.name || symbol,
          "Symbol": symbol,
          "Trick Name": "Trick 1: True Gap Up",
          "Signal Direction": "BUY / Bullish",
          "Price": firstCandle.close,
          "Details": `Low (₹${firstCandle.low}) > Prev High (₹${prevHigh.toFixed(2)}) | Gap: +${gapPct}%`
        });
      } else if (isGapDown) {
        const gapPct = (((prevLow - firstCandle.open) / prevLow) * 100).toFixed(2);
        gapResults.push({
          "Date": todayDate,
          "Time": "09:15 - 09:30",
          "Company Name": data.name || symbol,
          "Symbol": symbol,
          "Trick Name": "Trick 1: True Gap Down",
          "Signal Direction": "SELL / Bearish",
          "Price": firstCandle.close,
          "Details": `High (₹${firstCandle.high}) < Prev Low (₹${prevLow.toFixed(2)}) | Gap: -${gapPct}%`
        });
      }
    } catch (e) {
      console.warn(`[EXPORTER] Error checking gaps for ${symbol}:`, e.message);
    }
  }

  return gapResults;
}

/**
 * Scan for Trick 2: 5-Candle Mother Range Setup
 */
function scanTrick2MotherRange(allCandles, todayStr) {
  const motherResults = [];

  for (const [symbol, data] of Object.entries(allCandles)) {
    if (symbol === 'NIFTY50') continue;
    try {
      const quotes = data.quotes || [];
      if (quotes.length < 5) continue;

      const candleGroups = {};
      quotes.forEach(q => {
        if (!candleGroups[q.dateStr]) candleGroups[q.dateStr] = [];
        candleGroups[q.dateStr].push(q);
      });

      const dates = Object.keys(candleGroups).sort((a, b) => {
        const [dA, mA, yA] = a.split('/').map(Number);
        const [dB, mB, yB] = b.split('/').map(Number);
        return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
      });

      if (dates.length < 2) continue;
      const todayDate = dates[dates.length - 1];
      const prevDate = dates[dates.length - 2];

      const todayCandles = candleGroups[todayDate] || [];
      const prevCandles = candleGroups[prevDate] || [];

      if (prevCandles.length < 2 || todayCandles.length < 3) continue;

      const C1 = prevCandles[prevCandles.length - 2];
      const C2 = prevCandles[prevCandles.length - 1];
      const C3 = todayCandles[0]; // Mother candle (9:15 - 9:30)
      const C4 = todayCandles[1];
      const C5 = todayCandles[2];

      if (!C1 || !C2 || !C3 || !C4 || !C5) continue;

      const isHighSatisfied = C1.high < C3.high && C2.high < C3.high && C4.high < C3.high && C5.high < C3.high;
      const isLowSatisfied = C1.low > C3.low && C2.low > C3.low && C4.low > C3.low && C5.low > C3.low;

      if (isHighSatisfied && isLowSatisfied) {
        motherResults.push({
          "Date": todayDate,
          "Time": "10:00 AM (IST)",
          "Company Name": data.name || symbol,
          "Symbol": symbol,
          "Trick Name": "Trick 2: 5-Candle Mother Range",
          "Signal Direction": "Breakout Watch",
          "Price": C5.close,
          "Details": `Mother Range High: ₹${C3.high.toFixed(2)}, Low: ₹${C3.low.toFixed(2)}`
        });
      }
    } catch (e) {
      console.warn(`[EXPORTER] Error checking mother range for ${symbol}:`, e.message);
    }
  }

  return motherResults;
}

/**
 * Scan for Trick 3: 15-Minute 3-Candle Bullish Breakout
 */
function scanTrick3Breakouts(allCandles, todayStr) {
  const breakoutResults = [];

  for (const [symbol, data] of Object.entries(allCandles)) {
    try {
      const quotes = data.quotes || [];
      if (quotes.length < 3) continue;

      let latestBreakout = null;

      for (let i = 0; i <= quotes.length - 3; i++) {
        const c1 = quotes[i];
        const c2 = quotes[i + 1];
        const c3 = quotes[i + 2];

        // Only today's breakouts
        if (c3.dateStr !== todayStr && todayStr) continue;
        if (c1.dateStr !== c2.dateStr || c2.dateStr !== c3.dateStr) continue;

        // 1. C1 Red
        if (c1.close >= c1.open) continue;
        // 2. C2 Green & C2 High > C1 High
        if (c2.close <= c2.open || c2.high <= c1.high) continue;
        // 3. C3 Green & C3 High > C2 High
        if (c3.close <= c3.open || c3.high <= c2.high) continue;

        // 4. Candle 4 Green verification (if candle 4 exists in data)
        const c4 = quotes[i + 3];
        if (c4 && c4.close <= c4.open) {
          // If C4 formed and was red, skip
          continue;
        }

        const compName = symbol === 'NIFTY50' ? 'Nifty 50 Index' : (data.name || symbol);
        const candleTime = `${c3.timeStr} -> C4 Entry`;

        latestBreakout = {
          "Date": c3.dateStr,
          "Time": candleTime,
          "Company Name": compName,
          "Symbol": symbol,
          "Trick Name": "Trick 3: 3-Candle Bullish Breakout",
          "Signal Direction": "BUY / Bullish",
          "Price": c3.close,
          "Details": `C1 Red Ref (H: ₹${c1.high.toFixed(2)}, L: ₹${c1.low.toFixed(2)}) -> C2 Green (H: ₹${c2.high.toFixed(2)}) -> C3 Green Breakout (H: ₹${c3.high.toFixed(2)})`
        };
      }

      if (latestBreakout) {
        breakoutResults.push(latestBreakout);
      }
    } catch (e) {
      console.warn(`[EXPORTER] Error checking 3-candle breakout for ${symbol}:`, e.message);
    }
  }

  return breakoutResults;
}

/**
 * Scan for Trick 4: Live 15-Min Open=High & Open=Low Signals
 */
function scanTrick4OpenHighLow(allCandles, todayStr) {
  const ohlResults = [];

  for (const [symbol, data] of Object.entries(allCandles)) {
    if (symbol === 'NIFTY50') continue;
    try {
      const quotes = data.quotes || [];
      let latestOH = null;
      let latestOL = null;

      quotes.forEach(c => {
        if (todayStr && c.dateStr !== todayStr) return;

        if (c.high === c.open) {
          latestOH = {
            "Date": c.dateStr,
            "Time": `${c.timeStr}`,
            "Company Name": data.name || symbol,
            "Symbol": symbol,
            "Trick Name": "Trick 4: Open=High Bearish",
            "Signal Direction": "SELL / Bearish",
            "Price": c.close,
            "Details": `Open equals High (₹${c.open.toFixed(2)}) — Strong intraday bearish rejection`
          };
        } else if (c.low === c.open) {
          latestOL = {
            "Date": c.dateStr,
            "Time": `${c.timeStr}`,
            "Company Name": data.name || symbol,
            "Symbol": symbol,
            "Trick Name": "Trick 4: Open=Low Bullish",
            "Signal Direction": "BUY / Bullish",
            "Price": c.close,
            "Details": `Open equals Low (₹${c.open.toFixed(2)}) — Strong intraday bullish momentum`
          };
        }
      });

      if (latestOH) ohlResults.push(latestOH);
      if (latestOL) ohlResults.push(latestOL);
    } catch (e) {
      console.warn(`[EXPORTER] Error checking O=H/O=L for ${symbol}:`, e.message);
    }
  }

  return ohlResults;
}

/**
 * Query signals saved in PostgreSQL today (if database connection is active)
 */
async function getDBSignalsToday(todayStr) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM signals_history WHERE candle_date = $1 ORDER BY id ASC`,
      [todayStr]
    );
    if (!rows || rows.length === 0) return [];

    return rows.map(r => ({
      "Date": r.candle_date,
      "Time": r.candle_time,
      "Company Name": r.stock_name,
      "Symbol": r.stock_symbol,
      "Trick Name": r.signal_type.includes('3-CANDLE') 
        ? "Trick 3: 3-Candle Bullish Breakout"
        : `Trick 4: ${r.signal_type}`,
      "Signal Direction": r.direction === 'UP' ? 'BUY / Bullish' : 'SELL / Bearish',
      "Price": Number(r.close_price || r.open_price),
      "Details": `Signal: ${r.signal_type} (${r.timeframe})`
    }));
  } catch (err) {
    console.warn('[EXPORTER] DB read skipped (using direct scan):', err.message);
    return [];
  }
}

/**
 * Main export function:
 * Collects all tricks for the day and writes/updates Excel file with sheet name "date"
 */
async function exportAllTricksToExcel(targetDateStr) {
  const startTime = Date.now();
  const todayStr = targetDateStr || getTodayISTString();
  console.log(`[TRICKS EXPORTER] Starting daily tricks Excel export for ${todayStr}...`);

  // 1. Import latest candles for all stocks
  const allCandles = await importAllCandles();

  // 2. Run scans for all 4 tricks
  const trick1 = scanTrick1Gaps(allCandles, todayStr);
  const trick2 = scanTrick2MotherRange(allCandles, todayStr);
  const trick3 = scanTrick3Breakouts(allCandles, todayStr);
  const trick4 = scanTrick4OpenHighLow(allCandles, todayStr);

  // 3. Optional DB signals overlay
  const dbSignals = await getDBSignalsToday(todayStr);

  // Combine and deduplicate
  const seen = new Set();
  const todayRows = [];

  const addRow = (row) => {
    // Deduplicate by Date, Symbol, and Trick Name so each company appears once per trick
    const key = `${row["Date"]}|${row["Symbol"]}|${row["Trick Name"]}`;
    if (!seen.has(key)) {
      seen.add(key);
      todayRows.push(row);
    }
  };

  trick1.forEach(addRow);
  trick2.forEach(addRow);
  trick3.forEach(addRow);
  trick4.forEach(addRow);
  dbSignals.forEach(addRow);

  console.log(`[TRICKS EXPORTER] Collected ${todayRows.length} total trick events across all 4 tricks.`);

  // If no triggers occurred today (e.g. holiday or quiet market), add an informative placeholder
  if (todayRows.length === 0) {
    todayRows.push({
      "Date": todayStr,
      "Time": "16:00 IST",
      "Company Name": "All NSE 50 Stocks Monitored",
      "Symbol": "MARKET",
      "Trick Name": "Daily Market Scan Summary",
      "Signal Direction": "NEUTRAL",
      "Price": 0,
      "Details": "No breakout setups satisfied all confirmation criteria during this session."
    });
  }

  function getTrickGroupKey(trickName) {
    const t = String(trickName || "").toLowerCase();
    if (t.includes("trick 1") || t.includes("gap")) return 1;
    if (t.includes("trick 2") || t.includes("mother")) return 2;
    if (t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout")) return 3;
    if (t.includes("open=high") || t.includes("open = high")) return 4;
    if (t.includes("open=low") || t.includes("open = low")) return 5;
    return 6;
  }

  function formatRowsWith3LineGaps(rows) {
    const sorted = [...rows].sort((a, b) => {
      const kA = getTrickGroupKey(a["Trick Name"]);
      const kB = getTrickGroupKey(b["Trick Name"]);
      if (kA !== kB) return kA - kB;
      return String(a["Company Name"] || "").localeCompare(String(b["Company Name"] || ""));
    });

    const spaced = [];
    let prevGroup = null;

    sorted.forEach(row => {
      const grp = getTrickGroupKey(row["Trick Name"]);
      if (prevGroup !== null && grp !== prevGroup) {
        // 3 line gap in between every trick
        spaced.push({ "Company Name": "", "Trick Name": "", "Symbol": "", "Signal Direction": "", "Price": "", "Date": "", "Time": "", "Details": "" });
        spaced.push({ "Company Name": "", "Trick Name": "", "Symbol": "", "Signal Direction": "", "Price": "", "Date": "", "Time": "", "Details": "" });
        spaced.push({ "Company Name": "", "Trick Name": "", "Symbol": "", "Signal Direction": "", "Price": "", "Date": "", "Time": "", "Details": "" });
      }
      prevGroup = grp;
      spaced.push({
        "Company Name": row["Company Name"] || "",
        "Trick Name": row["Trick Name"] || "",
        "Symbol": row["Symbol"] || "",
        "Signal Direction": row["Signal Direction"] || "",
        "Price": row["Price"] || "",
        "Date": row["Date"] || "",
        "Time": row["Time"] || "",
        "Details": row["Details"] || "",
      });
    });

    return spaced;
  }

  const formattedTodayRows = formatRowsWith3LineGaps(todayRows);

  // Ensure export directories exist
  const backendExportDir = path.join(__dirname, 'exports');
  const frontendExportDir = path.join(__dirname, '..', 'public', 'exports');

  if (!fs.existsSync(backendExportDir)) fs.mkdirSync(backendExportDir, { recursive: true });
  if (!fs.existsSync(frontendExportDir)) fs.mkdirSync(frontendExportDir, { recursive: true });

  const safeDateStr = todayStr.replace(/\//g, '-');
  const masterFileName = 'Tricks_History.xlsx';
  const dailyFileName = `Tricks_History_${safeDateStr}.xlsx`;

  const backendMasterPath = path.join(backendExportDir, masterFileName);
  const frontendMasterPath = path.join(frontendExportDir, masterFileName);
  const backendDailyPath = path.join(backendExportDir, dailyFileName);
  const frontendDailyPath = path.join(frontendExportDir, dailyFileName);

  // Read existing master rows if available, so all historical working days are accumulated
  let masterRows = [];
  if (fs.existsSync(backendMasterPath)) {
    try {
      const existingWb = xlsx.readFile(backendMasterPath);
      // Look for first sheet
      const sheetName = existingWb.SheetNames[0];
      if (sheetName) {
        const existingData = xlsx.utils.sheet_to_json(existingWb.Sheets[sheetName]);
        // Filter out today's existing entries to prevent duplicates upon re-export
        masterRows = existingData.filter(r => r["Date"] !== todayStr);
      }
    } catch (e) {
      console.warn('[TRICKS EXPORTER] Notice: Reading existing master workbook failed, creating fresh:', e.message);
    }
  }

  // Combine historical with today's rows (today's latest market date at top)
  const consolidatedRows = [...formattedTodayRows, ...masterRows];

  // Helper to create and style a worksheet
  const createStyledWorksheet = (rows) => {
    const ws = xlsx.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 34 }, // Col A: Company Name
      { wch: 34 }, // Col B: Trick Name
      { wch: 14 }, // Col C: Symbol
      { wch: 18 }, // Col D: Signal Direction
      { wch: 14 }, // Col E: Price
      { wch: 14 }, // Col F: Date
      { wch: 18 }, // Col G: Time
      { wch: 55 }, // Col H: Details
    ];
    return ws;
  };

  // Sheet name format: DD.MM.YYYY (e.g. 27.10.2026)
  const sheetDateName = todayStr.replace(/\//g, '.');

  // 1. Master Workbook — Primary sheet name is the date of the export (DD.MM.YYYY)
  const masterWb = xlsx.utils.book_new();
  const masterWs = createStyledWorksheet(consolidatedRows);
  xlsx.utils.book_append_sheet(masterWb, masterWs, sheetDateName);

  // Also add a convenient day-specific tab in the master file if different
  const todayWs = createStyledWorksheet(formattedTodayRows);
  const dayTabName = safeDateStr.slice(0, 31); // Excel sheet max 31 chars
  if (dayTabName !== sheetDateName) {
    xlsx.utils.book_append_sheet(masterWb, todayWs, dayTabName);
  }

  // 2. Daily Workbook — Sheet name is strictly the date of the export (DD.MM.YYYY)
  const dailyWb = xlsx.utils.book_new();
  const dailyWs = createStyledWorksheet(formattedTodayRows);
  xlsx.utils.book_append_sheet(dailyWb, dailyWs, sheetDateName);

  // Write files
  xlsx.writeFile(masterWb, backendMasterPath);
  xlsx.writeFile(masterWb, frontendMasterPath);
  xlsx.writeFile(dailyWb, backendDailyPath);
  xlsx.writeFile(dailyWb, frontendDailyPath);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[TRICKS EXPORTER] ✅ Successfully exported ${todayRows.length} trick records to Excel in ${duration}s!`);
  console.log(`  📁 Master Workbook: ${backendMasterPath} (sheet name: "date")`);
  console.log(`  📁 Frontend Downloadable: ${frontendMasterPath}`);
  console.log(`  📁 Daily File: ${backendDailyPath}`);

  return {
    success: true,
    date: todayStr,
    count: todayRows.length,
    backendPath: backendMasterPath,
    frontendPath: frontendMasterPath,
    dailyPath: backendDailyPath,
    data: todayRows
  };
}

module.exports = {
  exportAllTricksToExcel,
  getTodayISTString,
  scanTrick1Gaps,
  scanTrick2MotherRange,
  scanTrick3Breakouts,
  scanTrick4OpenHighLow
};
