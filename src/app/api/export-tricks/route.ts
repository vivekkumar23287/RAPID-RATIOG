import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function filterRowsByTrick(rows: any[], filter: string | null) {
  if (!filter || filter === "ALL") return rows;
  const f = filter.toLowerCase();
  return rows.filter((r: any) => {
    const t = String(r["Trick Name"] || "").toLowerCase();
    if (f === "trick_1" || f === "1") return t.includes("trick 1") || t.includes("gap");
    if (f === "trick_2" || f === "2") return t.includes("trick 2") || t.includes("mother");
    if (f === "trick_3" || f === "3") return t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout");
    if (f === "trick_4_oh") return t.includes("open=high") || t.includes("open = high");
    if (f === "trick_4_ol") return t.includes("open=low") || t.includes("open = low");
    if (f === "trick_4" || f === "4") return t.includes("open=high") || t.includes("open = high") || t.includes("open=low") || t.includes("open = low");
    if (f === "trick_5" || f === "5" || f === "rsi") return t.includes("trick 5") || t.includes("rsi");
    return t.includes(f);
  });
}

function formatToSheetDate(dateVal?: any): string {
  if (!dateVal) {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, "0");
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const y = today.getFullYear();
    return `${d}.${m}.${y}`;
  }

  if (typeof dateVal === "number") {
    if (dateVal > 30000 && dateVal < 80000) {
      const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();
      return `${d}.${m}.${y}`;
    }
  }

  const str = String(dateVal).trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, "0");
    const m = ddmmyyyy[2].padStart(2, "0");
    const y = ddmmyyyy[3];
    return `${d}.${m}.${y}`;
  }

  const yyyymmdd = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (yyyymmdd) {
    const y = yyyymmdd[1];
    const m = yyyymmdd[2].padStart(2, "0");
    const d = yyyymmdd[3].padStart(2, "0");
    return `${d}.${m}.${y}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${d}.${m}.${y}`;
  }

  return str.replace(/[\/\\:\*\?\[\]]/g, ".").slice(0, 31) || "Sheet1";
}

// Global in-memory cache for tricks sheet (2-minute TTL)
let serverTricksCache: { allRows: any[]; sheetName: string; timestamp: number } | null = null;
let isExportInProgress = false;
const TRICKS_CACHE_TTL_MS = 120000;

function getLatestAvailableExportFile(): string | null {
  const exportsDir = path.join(process.cwd(), "public", "exports");
  if (!fs.existsSync(exportsDir)) return null;

  try {
    const files = fs.readdirSync(exportsDir).filter(f => f.startsWith("Tricks_History") && f.endsWith(".xlsx"));
    if (files.length === 0) return null;

    // Prefer dated files sorted newest first, fallback to master
    const datedFiles = files.filter(f => f !== "Tricks_History.xlsx").sort().reverse();
    const chosen = datedFiles[0] || "Tricks_History.xlsx";
    return path.join(exportsDir, chosen);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const today = new Date();
    const optionsDate: Intl.DateTimeFormatOptions = { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    };
    const parts = new Intl.DateTimeFormat('en-IN', optionsDate).formatToParts(today);
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const year = parts.find(p => p.type === 'year')?.value || '2026';
    const todayStr = `${day}/${month}/${year}`;
    const safeDateStr = todayStr.replace(/\//g, '-');

    const format = req.nextUrl.searchParams.get("format");
    const trickFilter = req.nextUrl.searchParams.get("trick");
    const forceSync = req.nextUrl.searchParams.get("sync") === "true";

    const publicDailyPath = path.join(process.cwd(), "public", "exports", `Tricks_History_${safeDateStr}.xlsx`);
    const publicExportPath = path.join(process.cwd(), "public", "exports", "Tricks_History.xlsx");

    // Serve from in-memory cache if available and not forced
    const now = Date.now();
    if (!forceSync && serverTricksCache && now - serverTricksCache.timestamp < TRICKS_CACHE_TTL_MS) {
      const filtered = filterRowsByTrick(serverTricksCache.allRows, trickFilter);
      if (format === "json") {
        return NextResponse.json({
          success: true,
          date: todayStr,
          sheetName: serverTricksCache.sheetName,
          total: filtered.length,
          data: filtered,
        }, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
        });
      }
    }

    // Trigger background export asynchronously if daily file is missing or forceSync requested
    if ((!fs.existsSync(publicDailyPath) || forceSync) && !isExportInProgress) {
      isExportInProgress = true;
      setImmediate(async () => {
        try {
          const reqFunc = eval("require");
          const { exportAllTricksToExcel } = reqFunc(path.join(process.cwd(), "express-backend", "tricks-exporter"));
          await exportAllTricksToExcel(todayStr);
          serverTricksCache = null; // Invalidate cache so fresh file is read next
        } catch (err: any) {
          console.warn("Background exportAllTricksToExcel notice:", err.message);
        } finally {
          isExportInProgress = false;
        }
      });
    }

    let allRows: any[] = [];
    let detectedSheetName = "date";

    // 2. Load today's live file if available, otherwise latest historical or master workbook
    const targetFilePath = fs.existsSync(publicDailyPath) 
      ? publicDailyPath 
      : (fs.existsSync(publicExportPath) ? publicExportPath : getLatestAvailableExportFile());

    if (targetFilePath && fs.existsSync(targetFilePath)) {
      const fileBuffer = fs.readFileSync(targetFilePath);
      const wb = xlsx.read(fileBuffer, { type: "buffer" });
      detectedSheetName = wb.SheetNames[0] || "date";
      allRows = xlsx.utils.sheet_to_json(wb.Sheets[detectedSheetName]);
      serverTricksCache = { allRows, sheetName: detectedSheetName, timestamp: now };
    } else {
      // 2. Fallback: Fetch recorded signals from PostgreSQL signals_history
      try {
        const dbRes = await sql`
          SELECT 
            stock_name as "Company Name",
            CASE 
              WHEN signal_type LIKE '%3-CANDLE%' THEN 'Trick 3: 3-Candle Bullish Breakout'
              ELSE CONCAT('Trick 4: ', signal_type)
            END as "Trick Name",
            stock_symbol as "Symbol",
            CASE 
              WHEN direction = 'UP' THEN 'BUY / Bullish'
              ELSE 'SELL / Bearish'
            END as "Signal Direction",
            close_price as "Price",
            candle_date as "Date",
            candle_time as "Time",
            CONCAT('Signal Type: ', signal_type, ' (', timeframe, ')') as "Details"
          FROM signals_history
          ORDER BY id DESC
          LIMIT 500
        `;
        allRows = dbRes || [];
      } catch (e: any) {
        console.warn("Could not query DB for signals export:", e.message);
      }
    }

    // Filter out blank separator rows if any were stored
    allRows = allRows.filter(r => r["Company Name"] || r["Trick Name"] || r["Symbol"]);

    if (allRows.length === 0) {
      allRows.push({
        "Company Name": "All NSE Stocks Monitored",
        "Trick Name": "Daily Tricks Scan",
        "Symbol": "NSE",
        "Signal Direction": "NEUTRAL",
        "Price": 0,
        "Date": todayStr,
        "Time": "16:00 IST",
        "Details": "Updated every working day at 4:00 PM IST"
      });
    }

    const filteredRows = filterRowsByTrick(allRows, trickFilter);

    // Extract dynamic sheet name from the date of the data shown
    const firstDate = filteredRows.find((r: any) => r["Date"])?.["Date"] || allRows.find((r: any) => r["Date"])?.["Date"] || todayStr;
    const dynamicSheetName = formatToSheetDate(firstDate);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        sheetName: dynamicSheetName,
        count: filteredRows.length,
        totalCount: allRows.length,
        filter: trickFilter || "ALL",
        data: filteredRows,
      }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
      });
    }

    // Create workbook with sheet name strictly the data's date
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(filteredRows);
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

    xlsx.utils.book_append_sheet(wb, ws, dynamicSheetName);

    const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileSuffix = trickFilter && trickFilter !== "ALL" ? `_${trickFilter}` : "";

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Tricks${fileSuffix}_${safeDateStr}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export tricks API error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate Excel export" }, { status: 500 });
  }
}
