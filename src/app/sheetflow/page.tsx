"use client";

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Navbar from "@/components/Navbar";
import "@fortune-sheet/react/dist/index.css";
import * as xlsx from "xlsx";

// Dynamically import Workbook with ssr: false — FortuneSheet uses 2D canvas which requires browser APIs
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
];

function matchesTrickFilter(row: TrickRow, filter: string): boolean {
  if (!filter || filter === "ALL") return true;
  const t = String(row["Trick Name"] || "").toLowerCase();
  if (filter === "TRICK_1") return t.includes("trick 1") || t.includes("gap");
  if (filter === "TRICK_2") return t.includes("trick 2") || t.includes("mother");
  if (filter === "TRICK_3") return t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout");
  if (filter === "TRICK_4_OH") return t.includes("open=high") || t.includes("open = high");
  if (filter === "TRICK_4_OL") return t.includes("open=low") || t.includes("open = low");
  if (filter === "TRICK_4_ALL") return t.includes("open=high") || t.includes("open = high") || t.includes("open=low") || t.includes("open = low");
  return true;
}

function formatToSheetDate(dateVal?: any): string {
  if (dateVal === null || dateVal === undefined || dateVal === "") {
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

  // Pattern: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, "0");
    const m = ddmmyyyy[2].padStart(2, "0");
    const y = ddmmyyyy[3];
    return `${d}.${m}.${y}`;
  }

  // Pattern: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
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

function getSheetNameFromRows(rows: TrickRow[], fallbackRows?: TrickRow[]): string {
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const d = r["Date"] || r["date"];
      if (d && String(d).trim()) {
        return formatToSheetDate(d);
      }
    }
  }
  if (Array.isArray(fallbackRows)) {
    for (const r of fallbackRows) {
      const d = r["Date"] || r["date"];
      if (d && String(d).trim()) {
        return formatToSheetDate(d);
      }
    }
  }
  return formatToSheetDate();
}

function buildFortuneSheetData(rows: TrickRow[], isAllTricks: boolean = true, sheetName?: string) {
  // Ordered with Company Name in Column A and Trick Name in Column B
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

  // Header row (Row 0)
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
        ht: 1, // center align
        vt: 1,
      }
    });
  });

  const columnlen: Record<string, number> = {
    0: 260, // Col A: Company Name
    1: 270, // Col B: Trick Name
    2: 120, // Col C: Symbol
    3: 160, // Col D: Signal Direction
    4: 120, // Col E: Price (₹)
    5: 110, // Col F: Date
    6: 140, // Col G: Time
    7: 520, // Col H: Details
  };

  // Helper to categorize each trick for grouping
  const getTrickGroup = (trickName: string): { order: number; label: string } => {
    const t = String(trickName || "").toLowerCase();
    if (t.includes("trick 1") || t.includes("gap")) {
      return { order: 1, label: "Trick 1: True Gap Scanner" };
    }
    if (t.includes("trick 2") || t.includes("mother")) {
      return { order: 2, label: "Trick 2: 5-Candle Mother Range" };
    }
    if (t.includes("trick 3") || t.includes("3-candle") || t.includes("breakout")) {
      return { order: 3, label: "Trick 3: 3-Candle Bullish Breakout" };
    }
    if (t.includes("open=high") || t.includes("open = high")) {
      return { order: 4, label: "Trick 4: Open=High Bearish" };
    }
    if (t.includes("open=low") || t.includes("open = low")) {
      return { order: 5, label: "Trick 4: Open=Low Bullish" };
    }
    return { order: 6, label: trickName || "Other Tricks" };
  };

  // Group rows by trick category
  const groupedTricks = new Map<string, TrickRow[]>();

  // Sort rows by trick order first, then company name
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
      // 3 LINE GAP in between every trick when viewing all tricks
      currentRowIdx += 3;
    }
    isFirstGroup = false;

    groupRows.forEach(row => {
      const r = currentRowIdx;
      currentRowIdx++;

      const isEven = r % 2 === 0;
      const rowBg = isEven ? "#F8FAFC" : "#FFFFFF";

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
            tb: "2", // text wrap
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
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<TrickRow[]>([]);
  const [selectedTrickFilter, setSelectedTrickFilter] = useState<string>("ALL");
  const [currentSheetName, setCurrentSheetName] = useState<string>(() => formatToSheetDate());
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [autoFitStatus, setAutoFitStatus] = useState<string | null>(null);

  const workbookRef = useRef<any>(null);
  const workbookDataRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const columnlenRef = useRef<Record<string, number>>({
    0: 260, 1: 270, 2: 120, 3: 160, 4: 120, 5: 110, 6: 140, 7: 520
  });

  // Load today's trade tricks data from /api/export-tricks?format=json
  const fetchTricksData = useCallback(async (isManualSync: boolean = false) => {
    setLoading(true);
    try {
      const url = isManualSync ? "/api/export-tricks?format=json&sync=true" : "/api/export-tricks?format=json";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tricks data");
      const json = await res.json();
      const rawRows: TrickRow[] = json.data || [];
      // Filter out empty rows
      const cleanRows = rawRows.filter(r => r["Company Name"] || r["Trick Name"] || r["Symbol"]);
      setAllRows(cleanRows);

      const computedSheetName = json.sheetName && json.sheetName !== "date"
        ? formatToSheetDate(json.sheetName)
        : getSheetNameFromRows(cleanRows);
      setCurrentSheetName(computedSheetName);

      const isAll = selectedTrickFilter === "ALL";
      const filtered = cleanRows.filter(r => matchesTrickFilter(r, selectedTrickFilter));
      const fData = buildFortuneSheetData(filtered, isAll, computedSheetName);
      setSheetData(fData);
      workbookDataRef.current = fData;

      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("Could not load latest tricks data, using default:", err);
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
      const fData = buildFortuneSheetData(fallbackRows, true, computedSheetName);
      setSheetData(fData);
      workbookDataRef.current = fData;
    } finally {
      setLoading(false);
    }
  }, [selectedTrickFilter]);

  useEffect(() => {
    setMounted(true);
    fetchTricksData();
  }, [fetchTricksData]);

  // Handle changing the trick filter option
  const handleFilterChange = (newFilter: string) => {
    setSelectedTrickFilter(newFilter);
    const isAll = newFilter === "ALL";
    const filtered = allRows.filter(r => matchesTrickFilter(r, newFilter));
    const computedSheetName = getSheetNameFromRows(filtered, allRows);
    setCurrentSheetName(computedSheetName);
    const fData = buildFortuneSheetData(filtered, isAll, computedSheetName);
    setSheetData(fData);
    workbookDataRef.current = fData;
  };

  // Filtered rows for current selection
  const currentFilteredRows = useMemo(() => {
    return allRows.filter(r => matchesTrickFilter(r, selectedTrickFilter));
  }, [allRows, selectedTrickFilter]);

  // Handle cell edits in FortuneSheet
  const handleChange = useCallback((data: any[]) => {
    workbookDataRef.current = data;
    if (data && data[0]?.config?.columnlen) {
      columnlenRef.current = { ...columnlenRef.current, ...data[0].config.columnlen };
    }
  }, []);

  // Auto-fit a specific column by index based on maximum text content
  const autoFitColumnByIndex = useCallback((colIndex: number) => {
    try {
      let maxText = "";
      const currentWorkbook = workbookDataRef.current;
      const currentSheet = currentWorkbook?.[0];

      if (currentSheet) {
        if (Array.isArray(currentSheet.data)) {
          currentSheet.data.forEach((row: any[]) => {
            const cell = row?.[colIndex];
            const text = cell ? String(cell.m || cell.v || "") : "";
            if (text.length > maxText.length) maxText = text;
          });
        } else if (Array.isArray(currentSheet.celldata)) {
          currentSheet.celldata.forEach((c: any) => {
            if (c.c === colIndex) {
              const text = c.v ? String(c.v.m || c.v.v || "") : "";
              if (text.length > maxText.length) maxText = text;
            }
          });
        }
      }

      const headerNames = [
        "Company Name", "Trick Name", "Symbol", "Signal Direction", 
        "Price (₹)", "Date", "Time", "Details"
      ];
      if (headerNames[colIndex] && headerNames[colIndex].length > maxText.length) {
        maxText = headerNames[colIndex];
      }

      // Measure text width using an offscreen canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let textWidth = 100;
      if (ctx) {
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        textWidth = ctx.measureText(maxText).width;
      } else {
        textWidth = maxText.length * 8.5;
      }

      const newWidth = Math.max(90, Math.min(850, Math.ceil(textWidth + 38)));
      columnlenRef.current[colIndex] = newWidth;

      if (workbookRef.current?.setColumnWidth) {
        workbookRef.current.setColumnWidth({ [colIndex]: newWidth }, undefined, true);
      } else {
        setSheetData(prev => {
          if (!prev || prev.length === 0) return prev;
          const updated = [...prev];
          const cfg = updated[0].config || {};
          updated[0] = {
            ...updated[0],
            config: {
              ...cfg,
              columnlen: { ...cfg.columnlen, [colIndex]: newWidth },
              customWidth: { ...cfg.customWidth, [colIndex]: 1 }
            }
          };
          return updated;
        });
      }

      const colLetter = String.fromCharCode(65 + colIndex);
      setAutoFitStatus(`Auto-adjusted Column ${colLetter} to ${newWidth}px`);
      setTimeout(() => setAutoFitStatus(null), 2500);
    } catch (e) {
      console.warn("autoFitColumnByIndex error:", e);
    }
  }, []);

  // Auto-fit all columns at once
  const handleAutoFitAll = useCallback(() => {
    for (let c = 0; c < 8; c++) {
      autoFitColumnByIndex(c);
    }
    setAutoFitStatus("Auto-adjusted all columns to fit content");
    setTimeout(() => setAutoFitStatus(null), 2500);
  }, [autoFitColumnByIndex]);

  // Double-click between columns listener to auto-adjust column width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDblClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const clickX = e.clientX - rect.left;

      if (clickY > 45) return;

      const rowHeaderWidth = 46;
      let cumulativeX = rowHeaderWidth;

      for (let i = 0; i < 8; i++) {
        const colW = columnlenRef.current[i] || 120;
        cumulativeX += colW;

        if (Math.abs(clickX - cumulativeX) <= 16) {
          autoFitColumnByIndex(i);
          return;
        }
      }

      const boundaryA = rowHeaderWidth + (columnlenRef.current[0] || 260);
      if (clickX >= boundaryA - 20 && clickX <= boundaryA + 20) {
        autoFitColumnByIndex(0);
      }
    };

    container.addEventListener("dblclick", handleDblClick);
    return () => container.removeEventListener("dblclick", handleDblClick);
  }, [autoFitColumnByIndex]);

  // Download edited/customized spreadsheet as .xlsx (sheet name is the date of data)
  const handleDownloadExcel = useCallback(() => {
    try {
      setIsExporting(true);
      const currentWorkbook = workbookDataRef.current;
      const wb = xlsx.utils.book_new();

      if (Array.isArray(currentWorkbook) && currentWorkbook.length > 0) {
        currentWorkbook.forEach((sheet: any) => {
          const sheetName = sheet.name || currentSheetName;
          let aoa: any[][] = [];

          if (Array.isArray(sheet.data) && sheet.data.length > 0) {
            aoa = sheet.data.map((row: any[]) => {
              if (!Array.isArray(row)) return [];
              return row.map((cell: any) => (cell ? (cell.v !== undefined ? cell.v : cell.m || "") : ""));
            });
          } else if (Array.isArray(sheet.celldata)) {
            const maxR = Math.max(...sheet.celldata.map((c: any) => c.r), 0);
            const maxC = Math.max(...sheet.celldata.map((c: any) => c.c), 0);
            aoa = Array.from({ length: maxR + 1 }, () => Array(maxC + 1).fill(""));
            sheet.celldata.forEach((c: any) => {
              if (aoa[c.r] && c.v) {
                aoa[c.r][c.c] = c.v.v !== undefined ? c.v.v : (c.v.m || "");
              }
            });
          }

          while (aoa.length > 0 && aoa[aoa.length - 1].every((cell: any) => cell === "" || cell === null || cell === undefined)) {
            aoa.pop();
          }

          const ws = xlsx.utils.aoa_to_sheet(aoa);
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

          // Worksheet name is the date of data shown in that sheet
          xlsx.utils.book_append_sheet(wb, ws, sheetName);
        });
      } else {
        const ws = xlsx.utils.json_to_sheet([{ "Status": "No data available" }]);
        xlsx.utils.book_append_sheet(wb, ws, currentSheetName);
      }

      const fileDateStr = currentSheetName.replace(/\./g, '-');
      const suffix = selectedTrickFilter !== "ALL" ? `_${selectedTrickFilter}` : "";
      xlsx.writeFile(wb, `Tricks${suffix}_${fileDateStr}.xlsx`);
    } catch (e: any) {
      console.error("Excel export failed:", e);
      alert("Failed to export Excel file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [selectedTrickFilter, currentSheetName]);

  // Lock window scroll so FortuneSheet handles internal scrolling
  useEffect(() => {
    const lock = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    window.addEventListener("scroll", lock, { passive: true });
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("scroll", lock);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Fix FortuneSheet wheel scroll freeze
  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const scrollbarY = container.querySelector('.luckysheet-scrollbar-y') as HTMLElement;
      const scrollbarX = container.querySelector('.luckysheet-scrollbar-x') as HTMLElement;

      if (!scrollbarY && !scrollbarX) return;

      e.stopPropagation();
      e.preventDefault();

      if (e.deltaY && scrollbarY) {
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 28;
        else if (e.deltaMode === 2) dy *= container.clientHeight;
        scrollbarY.scrollTop += dy;
      }

      if (e.deltaX && scrollbarX) {
        let dx = e.deltaX;
        if (e.deltaMode === 1) dx *= 28;
        else if (e.deltaMode === 2) dx *= container.clientWidth;
        scrollbarX.scrollLeft += dx;
      }
    };

    container.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [mounted]);

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

          {/* CUSTOM TRICK SELECTION OPTION FOR DATE SHEET */}
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

          {autoFitStatus && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563EB", background: "rgba(37,99,235,0.1)", padding: "2px 8px", borderRadius: "4px" }}>
              ✓ {autoFitStatus}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Double-click hint */}
          <div style={{ fontSize: "11px", color: "#64748B", background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "4px 8px", borderRadius: "6px", fontWeight: 600 }}>
            💡 Double-click between Col A &amp; B to auto-fit
          </div>

          {/* Quick Auto-Fit Column A (Company Name) */}
          <button
            onClick={() => autoFitColumnByIndex(0)}
            title="Auto-adjust Company Name column width"
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              color: "#0F2044",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            Auto-Fit A
          </button>

          {/* Auto-Fit All Columns Button */}
          <button
            onClick={handleAutoFitAll}
            title="Auto-adjust all columns to fit text"
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              color: "#0F2044",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            Auto-Fit All
          </button>

          {/* Sync Latest Button */}
          <button
            onClick={() => fetchTricksData(true)}
            disabled={loading}
            style={{
              padding: "6px 12px",
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

          {/* Download Edited/Customized Excel (.xlsx) Button */}
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
        ref={containerRef}
        className="excel-scroll-container"
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
              ref={workbookRef}
              key={`workbook-${currentSheetName}-${selectedTrickFilter}-${sheetData.length}-${currentFilteredRows.length}`}
              data={sheetData} 
              onChange={handleChange}
            />
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* 
           * FortuneSheet scrollbar elements WebKit styling restoration
           */
          .luckysheet-scrollbar-ltr,
          .luckysheet-scrollbars {
            scrollbar-width: auto !important;
            -ms-overflow-style: auto !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar,
          .luckysheet-scrollbars::-webkit-scrollbar {
            width: 10px !important;
            height: 10px !important;
            display: block !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-track,
          .luckysheet-scrollbars::-webkit-scrollbar-track {
            background: #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-thumb,
          .luckysheet-scrollbars::-webkit-scrollbar-thumb {
            background: #CBD5E1 !important;
            border-radius: 8px !important;
            border: 2px solid #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-thumb:hover,
          .luckysheet-scrollbars::-webkit-scrollbar-thumb:hover {
            background: #94A3B8 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-corner,
          .luckysheet-scrollbars::-webkit-scrollbar-corner {
            background: #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-button,
          .luckysheet-scrollbars::-webkit-scrollbar-button {
            display: none !important;
          }
        `}</style>
      </div>
    </main>
  );
}
