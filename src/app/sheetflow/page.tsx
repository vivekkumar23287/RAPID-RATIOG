"use client";

import React, { useEffect, useCallback, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import "@fortune-sheet/react/dist/index.css";
import * as xlsx from "xlsx";
import { fetchTricksDataCached, getFromCache } from "@/lib/data-cache";

// Dynamically import Workbook with ssr: false — FortuneSheet requires browser APIs
const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((m) => m.Workbook),
  { ssr: false }
);

interface TrickRow {
  "Date"?: string;
  "Time"?: string;
  "Company Name"?: string;
  "Symbol"?: string;
  "Trick Name"?: string;
  "Signal Direction"?: string;
  "Price"?: number | string;
  "Details"?: string;
  [key: string]: any;
}

const TRICK_OPTIONS = [
  { id: "ALL", label: "All Tricks (Complete Sheet)" },
  { id: "TRICK_1", label: "Trick 1: True Gap Scanner" },
  { id: "TRICK_2", label: "Trick 2: 5-Candle Mother Range" },
  { id: "TRICK_3", label: "Trick 3: 15-Minute 3-Candle Breakout" },
  { id: "TRICK_4_OL", label: "Trick 4: Open=Low (Bullish)" },
  { id: "TRICK_4_OH", label: "Trick 4: Open=High (Bearish)" },
  { id: "TRICK_4_ALL", label: "Trick 4: All O=H & O=L Signals" },
  { id: "TRICK_5_RSI", label: "Trick 5: RSI 60 Bullish Breakout" },
];

const TRICK_4_ALLOWED_SET = new Set([
  "APOLLOHOSP",
  "BAJAJ-AUTO",
  "EICHERMOT",
  "MARUTI",
  "ULTRACEMCO",
  "NIFTY50",
  "NIFTY",
  "^NSEI",
  "BTC",
  "BTC-USD"
]);

function matchesTrickFilter(row: TrickRow, filter: string): boolean {
  const t = String(row["Trick Name"] || "").toLowerCase();
  const isTrick4 = t.includes("trick 4") || t.includes("open=high") || t.includes("open = high") || t.includes("open=low") || t.includes("open = low");
  if (isTrick4) {
    const sym = String(row["Symbol"] || "").toUpperCase();
    if (!TRICK_4_ALLOWED_SET.has(sym)) return false;
  }

  if (!filter || filter === "ALL") return true;
  if (filter === "TRICK_1") return t.includes("trick 1") || t.includes("gap");
  if (filter === "TRICK_2") return t.includes("trick 2") || t.includes("mother");
  if (filter === "TRICK_3") return t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout");
  if (filter === "TRICK_4_OH") return t.includes("open=high") || t.includes("open = high");
  if (filter === "TRICK_4_OL") return t.includes("open=low") || t.includes("open = low");
  if (filter === "TRICK_4_ALL") return t.includes("open=high") || t.includes("open = high") || t.includes("open=low") || t.includes("open = low");
  if (filter === "TRICK_5_RSI" || filter === "RSI") return t.includes("trick 5") || t.includes("rsi");
  return true;
}

function formatToSheetDate(dateVal?: any): string {
  if (!dateVal) {
    const today = new Date();
    return `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
  }
  const str = String(dateVal).trim();
  const match = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/) || str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (match) {
    const [, p1, p2, p3] = match;
    const [d, m, y] = p1.length === 4 ? [p3, p2, p1] : [p1, p2, p3];
    return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return `${String(parsed.getDate()).padStart(2, "0")}.${String(parsed.getMonth() + 1).padStart(2, "0")}.${parsed.getFullYear()}`;
  }
  return str.replace(/[\/\\:\*\?\[\]]/g, ".").slice(0, 31) || "Sheet1";
}

function getSheetNameFromRows(rows: TrickRow[], fallbackRows?: TrickRow[]): string {
  const all = [...(rows || []), ...(fallbackRows || [])];
  for (const r of all) {
    const d = r["Date"] || r["date"];
    if (d && String(d).trim()) return formatToSheetDate(d);
  }
  return formatToSheetDate();
}

function getTrickGroup(trickName: string): { order: number; label: string } {
  const t = String(trickName || "").toLowerCase();
  if (t.includes("trick 1") || t.includes("gap")) return { order: 1, label: "Trick 1: True Gap Scanner" };
  if (t.includes("trick 2") || t.includes("mother")) return { order: 2, label: "Trick 2: 5-Candle Mother Range" };
  if (t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout")) return { order: 3, label: "Trick 3: 3-Candle Bullish Breakout" };
  if (t.includes("open=high") || t.includes("open = high")) return { order: 4, label: "Trick 4: Open=High Bearish" };
  if (t.includes("open=low") || t.includes("open = low")) return { order: 5, label: "Trick 4: Open=Low Bullish" };
  if (t.includes("trick 5") || t.includes("rsi")) return { order: 6, label: "Trick 5: RSI 60 Bullish Breakout" };
  return { order: 7, label: trickName || "Other Tricks" };
}

function buildFortuneSheetData(rows: TrickRow[], isAllTricks: boolean = true, sheetName?: string) {
  const headers = [
    "Company Name",
    "Trick Name",
    "Symbol",
    "Signal Direction",
    "Price (₹)",
    "Date",
    "Time",
    "Details"
  ];

  const celldata: any[] = [];

  // Header row
  headers.forEach((h, colIdx) => {
    celldata.push({
      r: 0,
      c: colIdx,
      v: {
        v: h,
        m: h,
        bg: "#0F2044",
        fc: "#FFFFFF",
        bl: 1,
        ht: 1,
        vt: 1,
      }
    });
  });

  const columnlen: Record<string, number> = {
    0: 260,
    1: 270,
    2: 120,
    3: 160,
    4: 120,
    5: 110,
    6: 140,
    7: 520,
  };

  // Group and sort rows by trick category
  const groupedTricks = new Map<string, TrickRow[]>();
  const sortedRows = [...rows].sort((a, b) => {
    const grpA = getTrickGroup(a["Trick Name"] || "");
    const grpB = getTrickGroup(b["Trick Name"] || "");
    if (grpA.order !== grpB.order) return grpA.order - grpB.order;
    return String(a["Company Name"] || "").localeCompare(String(b["Company Name"] || ""));
  });

  sortedRows.forEach(row => {
    const grp = getTrickGroup(row["Trick Name"] || "");
    if (!groupedTricks.has(grp.label)) {
      groupedTricks.set(grp.label, []);
    }
    groupedTricks.get(grp.label)!.push(row);
  });

  let currentRowIdx = 1;
  let isFirstGroup = true;

  for (const [, groupRows] of groupedTricks.entries()) {
    if (!isFirstGroup && isAllTricks) {
      currentRowIdx += 3; // 3-line gap between trick categories
    }
    isFirstGroup = false;

    groupRows.forEach(row => {
      const r = currentRowIdx++;
      const rowBg = r % 2 === 0 ? "#F8FAFC" : "#FFFFFF";

      const direction = String(row["Signal Direction"] || "");
      const isBullish = direction.includes("BUY") || direction.includes("Bullish") || direction.includes("UP");
      const isBearish = direction.includes("SELL") || direction.includes("Bearish") || direction.includes("DOWN");
      const dirColor = isBullish ? "#16A34A" : isBearish ? "#DC2626" : "#2563EB";

      const rawPrice = row["Price"];
      const numPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice || 0)) || 0;

      const values = [
        { v: row["Company Name"] || "", bl: 1, fc: "#0F2044", t: "s" },
        { v: row["Trick Name"] || "", bl: 1, fc: "#0F2044", t: "s" },
        { v: row["Symbol"] || "", bl: 1, fc: "#2563EB", t: "s" },
        { v: direction, bl: 1, fc: dirColor, t: "s" },
        { v: numPrice, bl: 0, fc: "#0F2044", t: "n" },
        { v: row["Date"] || "", bl: 0, fc: "#0F2044", t: "s" },
        { v: row["Time"] || "", bl: 0, fc: "#64748B", t: "s" },
        { v: row["Details"] || "", bl: 0, fc: "#64748B", t: "s" },
      ];

      values.forEach((val, c) => {
        celldata.push({
          r,
          c,
          v: {
            v: val.v,
            m: typeof val.v === "number" ? `₹${val.v.toFixed(2)}` : String(val.v),
            bg: rowBg,
            fc: val.fc,
            bl: val.bl,
            t: val.t,
            tb: "2",
          }
        });
      });
    });
  }

  const activeSheetName = sheetName || getSheetNameFromRows(rows);

  return [
    {
      name: activeSheetName,
      id: `sheet_${activeSheetName.replace(/\./g, "_")}`,
      status: 1,
      order: 0,
      row: Math.max(120, currentRowIdx + 30),
      column: 24,
      config: {
        columnlen,
        customWidth: {
          0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1
        }
      },
      celldata,
    }
  ];
}

export default function SheetFlowPage() {
  const [mounted, setMounted] = useState(false);
  
  // Instant hydration from memory cache if available
  const cachedInitial = useMemo(() => getFromCache<any>("tricks_export_data", 120000), []);
  const initialRows: TrickRow[] = useMemo(() => {
    if (cachedInitial?.data) {
      return (cachedInitial.data as TrickRow[]).filter(r => r["Company Name"] || r["Trick Name"] || r["Symbol"]);
    }
    return [];
  }, [cachedInitial]);

  const [allRows, setAllRows] = useState<TrickRow[]>(initialRows);
  const [selectedTrickFilter, setSelectedTrickFilter] = useState<string>("ALL");
  const [currentSheetName, setCurrentSheetName] = useState<string>(() => {
    if (cachedInitial?.sheetName) return formatToSheetDate(cachedInitial.sheetName);
    if (initialRows.length > 0) return getSheetNameFromRows(initialRows);
    return formatToSheetDate();
  });
  const [sheetData, setSheetData] = useState<any[]>(() => {
    if (initialRows.length > 0) {
      return buildFortuneSheetData(initialRows, true, currentSheetName);
    }
    return [];
  });
  const [loading, setLoading] = useState(() => initialRows.length === 0);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Load tricks data from cached API
  const fetchTricksData = useCallback(async (isManualSync: boolean = false) => {
    if (allRows.length === 0 || isManualSync) {
      setLoading(true);
    }
    try {
      const json = await fetchTricksDataCached(isManualSync);
      if (!json) throw new Error("No data returned");
      const rawRows: TrickRow[] = json.data || [];
      const cleanRows = rawRows.filter(r => r["Company Name"] || r["Trick Name"] || r["Symbol"]);
      setAllRows(cleanRows);

      const computedSheetName = json.sheetName && json.sheetName !== "date"
        ? formatToSheetDate(json.sheetName)
        : getSheetNameFromRows(cleanRows);
      setCurrentSheetName(computedSheetName);

      const isAll = selectedTrickFilter === "ALL";
      const filtered = cleanRows.filter(r => matchesTrickFilter(r, selectedTrickFilter));
      setSheetData(buildFortuneSheetData(filtered, isAll, computedSheetName));

      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Could not load latest tricks data, using default:", err);
      if (allRows.length === 0) {
        const todayFormatted = formatToSheetDate();
        const fallbackRows: TrickRow[] = [
          {
            "Date": todayFormatted,
            "Time": "16:00 IST",
            "Company Name": "All NSE Stocks Monitored",
            "Symbol": "MARKET",
            "Trick Name": "Daily Tricks Scan",
            "Signal Direction": "NEUTRAL",
            "Price": 0,
            "Details": "Auto-updated every working day at 4:00 PM IST"
          }
        ];
        setAllRows(fallbackRows);
        const computedSheetName = getSheetNameFromRows(fallbackRows);
        setCurrentSheetName(computedSheetName);
        setSheetData(buildFortuneSheetData(fallbackRows, true, computedSheetName));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchTricksData();
  }, [fetchTricksData]);

  // Handle changing the trick filter option — purely in-memory, instant response!
  const handleFilterChange = (newFilter: string) => {
    setSelectedTrickFilter(newFilter);
    const isAll = newFilter === "ALL";
    const filtered = allRows.filter(r => matchesTrickFilter(r, newFilter));
    const computedSheetName = getSheetNameFromRows(filtered, allRows);
    setCurrentSheetName(computedSheetName);
    setSheetData(buildFortuneSheetData(filtered, isAll, computedSheetName));
  };

  const currentFilteredRows = useMemo(() => {
    return allRows.filter(r => matchesTrickFilter(r, selectedTrickFilter));
  }, [allRows, selectedTrickFilter]);

  // Download spreadsheet as .xlsx
  const handleDownloadExcel = useCallback(() => {
    try {
      setIsExporting(true);
      const rowsToExport = currentFilteredRows.map(r => ({
        "Company Name": r["Company Name"] || "",
        "Trick Name": r["Trick Name"] || "",
        "Symbol": r["Symbol"] || "",
        "Signal Direction": r["Signal Direction"] || "",
        "Price (₹)": typeof r["Price"] === "number" ? r["Price"] : parseFloat(String(r["Price"] || 0)) || 0,
        "Date": r["Date"] || "",
        "Time": r["Time"] || "",
        "Details": r["Details"] || ""
      }));

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rowsToExport.length > 0 ? rowsToExport : [{ "Status": "No data available" }]);
      ws["!cols"] = [
        { wch: 34 },
        { wch: 34 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 55 },
      ];

      xlsx.utils.book_append_sheet(wb, ws, currentSheetName);
      const fileDateStr = currentSheetName.replace(/\./g, "-");
      const suffix = selectedTrickFilter !== "ALL" ? `_${selectedTrickFilter}` : "";
      xlsx.writeFile(wb, `Tricks${suffix}_${fileDateStr}.xlsx`);
    } catch (e: any) {
      console.error("Excel export failed:", e);
      alert("Failed to export Excel file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [selectedTrickFilter, currentSheetName, currentFilteredRows]);

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", position: "relative", overflow: "hidden" }}>
      <Navbar />
      
      {/* Top Toolbar */}
      <div style={{
        marginTop: "72px",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        background: "#F8FAFC",
        borderBottom: "1px solid #E2E8F0"
      }}>
        {/* Left Information & Trick Filter Option */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#0F2044", margin: 0, letterSpacing: "-0.5px" }}>
            Tricks Sheet
          </h1>
          <div style={{
            background: "#0F2044",
            color: "#FFFFFF",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 800,
            display: "inline-flex",
            alignItems: "center",
            gap: "5px"
          }}>
            Sheet: &quot;{currentSheetName}&quot;
          </div>

          {/* Trick Selector Dropdown */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#FFFFFF", padding: "3px 8px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Trick Option:
            </span>
            <select
              value={selectedTrickFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                color: "#0F2044",
                fontSize: "12px",
                fontWeight: 700,
                outline: "none",
                cursor: "pointer",
                padding: "2px 4px"
              }}
            >
              {TRICK_OPTIONS.map(opt => {
                const count = allRows.filter(r => matchesTrickFilter(r, opt.id)).length;
                return (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <span style={{ fontSize: "12px", fontWeight: 700, color: "#16A34A", background: "rgba(22,163,74,0.1)", padding: "3px 8px", borderRadius: "6px" }}>
            {currentFilteredRows.length} Setups
          </span>

          <span style={{ fontSize: "12px", color: "#64748B", fontWeight: 600 }}>
            • Updated 4:00 PM IST
            {lastSyncTime ? ` (${lastSyncTime})` : ""}
          </span>
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Sync Button */}
          <button
            onClick={() => fetchTricksData(true)}
            disabled={loading}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              color: "#0F2044",
              fontSize: "12px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            {loading ? "Syncing..." : "Sync"}
          </button>

          {/* Download Excel (.xlsx) Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={isExporting || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
              border: "none",
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 800,
              cursor: isExporting ? "not-allowed" : "pointer",
              boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)"
            }}
          >
            {isExporting ? "Exporting..." : "Download Excel (.xlsx)"}
          </button>
        </div>
      </div>

      {/* Spreadsheet Container */}
      <div 
        style={{ 
          flex: 1,
          margin: "12px 20px 16px", 
          position: "relative",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        {loading && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255, 255, 255, 0.8)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              border: "3px solid #E2E8F0",
              borderTopColor: "#0F2044",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }} />
            <span style={{ fontSize: "14px", fontWeight: 700, color: "#0F2044" }}>
              Loading Sheet &quot;{currentSheetName}&quot;...
            </span>
          </div>
        )}

        {mounted && sheetData.length > 0 && (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <Workbook 
              key={`workbook-${currentSheetName}-${selectedTrickFilter}-${sheetData.length}`}
              data={sheetData} 
            />
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </main>
  );
}
