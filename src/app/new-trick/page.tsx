"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  ArrowClockwise,
  DownloadSimple,
  MagnifyingGlass,
  CheckCircle,
  WarningCircle,
  Hourglass,
  TrendUp,
  TrendDown,
  ShieldCheck,
  Lightning,
  Pulse,
} from "@phosphor-icons/react";
import * as XLSX from "xlsx";

interface GapSignalItem {
  id?: number;
  company_name: string;
  nse_symbol: string;
  signal_type: "GAP_UP" | "GAP_DOWN";
  prev_day_high?: number | null;
  prev_day_low?: number | null;
  first_candle_high?: number | null;
  first_candle_low?: number | null;
  trading_date: string;
  candle_time?: string;
  scan_time?: string;
  status?: string;
  data_source?: string;
}

interface ScannerStatus {
  lastScanTime: string | null;
  lastScanStatus: string;
  nextScheduledScan: string;
  totalUpToday: number;
  totalDownToday: number;
  latestTradingDate: string;
  dataSource: string;
  isMarketHours?: boolean;
  isTradingDay?: boolean;
  currentTimeIST?: string;
  currentDateIST?: string;
}

export default function NewTrickPage() {
  const router = useRouter();

  const [gapUps, setGapUps] = useState<GapSignalItem[]>([]);
  const [gapDowns, setGapDowns] = useState<GapSignalItem[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusSummary, setStatusSummary] = useState<ScannerStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Load results from backend API
  const loadData = useCallback(async (targetDate?: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (targetDate) queryParams.set("date", targetDate);

      const [resResults, resStatus] = await Promise.all([
        fetch(`/api/new-trick/results?${queryParams.toString()}`),
        fetch("/api/new-trick/status"),
      ]);

      if (resResults.ok) {
        const data = await resResults.json();
        if (data.success) {
          setGapUps(data.gapUps || []);
          setGapDowns(data.gapDowns || []);
          setAvailableDates(data.availableDates || []);
          if (!targetDate && data.date) {
            setSelectedDate(data.date);
          }
        }
      }

      if (resStatus.ok) {
        const statusData = await resStatus.json();
        if (statusData.success && statusData.summary) {
          setStatusSummary(statusData.summary);
        }
      }
    } catch (err: any) {
      console.warn("[NEW-TRICK] Error loading data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and periodic background polling (every 30 seconds)
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(selectedDate || undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, selectedDate]);

  // Handle manual scan trigger
  const handleManualScan = async () => {
    setScanning(true);
    setScanMessage({ type: "info", text: "Scanning Chartink Futures segment..." });
    try {
      const res = await fetch("/api/new-trick/manual-scan", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setGapUps(data.gapUps || []);
        setGapDowns(data.gapDowns || []);
        if (data.availableDates) setAvailableDates(data.availableDates);
        setSelectedDate(data.tradingDate);
        setScanMessage({
          type: "success",
          text: `Futures scan completed! Found ${data.totalUp} Gap Up & ${data.totalDown} Gap Down stocks.`,
        });
      } else {
        setScanMessage({
          type: "error",
          text: data.error || "Chartink scan could not complete. Retrying automatically at 9:35 / 9:40 / 9:45 AM.",
        });
      }
      loadData(data.tradingDate || selectedDate);
    } catch (err: any) {
      setScanMessage({
        type: "error",
        text: "Network error triggering manual scan: " + err.message,
      });
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 8000);
    }
  };

  // Filtered lists based on search input
  const filteredGapUps = useMemo(() => {
    if (!searchQuery.trim()) return gapUps;
    const q = searchQuery.toLowerCase().trim();
    return gapUps.filter(
      (s) => s.company_name.toLowerCase().includes(q) || s.nse_symbol.toLowerCase().includes(q)
    );
  }, [gapUps, searchQuery]);

  const filteredGapDowns = useMemo(() => {
    if (!searchQuery.trim()) return gapDowns;
    const q = searchQuery.toLowerCase().trim();
    return gapDowns.filter(
      (s) => s.company_name.toLowerCase().includes(q) || s.nse_symbol.toLowerCase().includes(q)
    );
  }, [gapDowns, searchQuery]);

  // Export to Excel / CSV
  const handleExport = () => {
    try {
      const wb = XLSX.utils.book_new();

      const upRows = filteredGapUps.map((s, idx) => ({
        "Sr No": idx + 1,
        "Company Name": s.company_name,
        "NSE Symbol": s.nse_symbol,
        "Segment": "Futures (F&O)",
        "Signal": "GAP UP (Bullish)",
        "Condition": "15-min Low > Prev Day High",
        "Trading Date": s.trading_date,
        "Candle Time": s.candle_time || "09:15 - 09:30 AM",
        "Detected At": s.scan_time ? new Date(s.scan_time).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "09:31 AM IST",
        "Data Source": s.data_source || "Chartink Futures",
        "Status": s.status || "CONFIRMED",
      }));

      const downRows = filteredGapDowns.map((s, idx) => ({
        "Sr No": idx + 1,
        "Company Name": s.company_name,
        "NSE Symbol": s.nse_symbol,
        "Segment": "Futures (F&O)",
        "Signal": "GAP DOWN (Bearish)",
        "Condition": "15-min High < Prev Day Low",
        "Trading Date": s.trading_date,
        "Candle Time": s.candle_time || "09:15 - 09:30 AM",
        "Detected At": s.scan_time ? new Date(s.scan_time).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "09:31 AM IST",
        "Data Source": s.data_source || "Chartink Futures",
        "Status": s.status || "CONFIRMED",
      }));

      const wsUp = XLSX.utils.json_to_sheet(upRows.length > 0 ? upRows : [{ "Status": "No Gap Up Matches" }]);
      const wsDown = XLSX.utils.json_to_sheet(downRows.length > 0 ? downRows : [{ "Status": "No Gap Down Matches" }]);

      XLSX.utils.book_append_sheet(wb, wsUp, "Gap Ups (Bullish)");
      XLSX.utils.book_append_sheet(wb, wsDown, "Gap Downs (Bearish)");

      const filename = `Chartink_Futures_Gaps_${selectedDate || "Report"}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      alert("Failed to export Excel file: " + err.message);
    }
  };

  const handleStockClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  const formatDetectedAt = (timeStr?: string) => {
    if (!timeStr) return "09:31 AM IST";
    try {
      return new Date(timeStr).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", paddingTop: "96px", paddingBottom: "80px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{
              background: "rgba(16, 185, 129, 0.12)",
              color: "#10B981",
              fontSize: "12px",
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: "8px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px"
            }}>
              <Lightning size={14} weight="fill" />
              Automated Chartink Scanner
            </span>
            <span style={{
              background: "rgba(14, 165, 233, 0.15)",
              color: "#0284C7",
              fontSize: "12px",
              fontWeight: 800,
              padding: "4px 10px",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}>
              <Pulse size={14} weight="bold" />
              Futures Segment (F&amp;O)
            </span>
          </div>

          <h1 style={{
            fontSize: "36px",
            fontWeight: 900,
            color: "#0F2044",
            letterSpacing: "-1px",
            margin: "0 0 8px 0"
          }}>
            New Trick
          </h1>
          <h2 style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#334155",
            margin: "0 0 8px 0"
          }}>
            Trick 1 — Gap Up and Gap Down
          </h2>
          <p style={{ fontSize: "15px", color: "#64748B", margin: 0, maxWidth: "820px", lineHeight: "1.5" }}>
            Automated server-side scanner running dual independent Chartink conditions across all stocks in the <strong>Futures segment</strong> at <strong>9:31 AM IST</strong>. 
            Identifies companies whose entire first completed 15-minute candle holds above yesterday&apos;s high or below yesterday&apos;s low.
          </p>
        </div>

        {/* Scan Message / Alert Banner */}
        {scanMessage && (
          <div style={{
            marginBottom: "24px",
            padding: "16px 20px",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: scanMessage.type === "success" 
              ? "rgba(16, 185, 129, 0.12)" 
              : scanMessage.type === "error" 
              ? "rgba(239, 68, 68, 0.12)" 
              : "rgba(59, 130, 246, 0.12)",
            border: `1px solid ${
              scanMessage.type === "success" ? "#10B981" : scanMessage.type === "error" ? "#EF4444" : "#3B82F6"
            }`,
            color: scanMessage.type === "success" ? "#065F46" : scanMessage.type === "error" ? "#991B1B" : "#1E40AF",
            fontSize: "14px",
            fontWeight: 600,
            transition: "all 0.3s ease"
          }}>
            {scanMessage.type === "success" && <CheckCircle size={22} weight="fill" />}
            {scanMessage.type === "error" && <WarningCircle size={22} weight="fill" />}
            {scanMessage.type === "info" && <Hourglass size={22} weight="fill" />}
            <span>{scanMessage.text}</span>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "16px",
          marginBottom: "32px"
        }}>
          {/* Card 1: Gap Ups */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Total Gap Up Count</span>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "rgba(16,185,129,0.15)", color: "#16A34A",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <TrendUp size={20} weight="bold" />
              </div>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 900, color: "#16A34A", lineHeight: "1" }}>
              {gapUps.length}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
              Futures: 15m Low &gt; Prev Day High
            </div>
          </div>

          {/* Card 2: Gap Downs */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Total Gap Down Count</span>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "rgba(239,68,68,0.15)", color: "#DC2626",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <TrendDown size={20} weight="bold" />
              </div>
            </div>
            <div style={{ fontSize: "32px", fontWeight: 900, color: "#DC2626", lineHeight: "1" }}>
              {gapDowns.length}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
              Futures: 15m High &lt; Prev Day Low
            </div>
          </div>

          {/* Card 3: Last Successful Scan */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Last Successful Scan</span>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "rgba(59,130,246,0.12)", color: "#2563EB",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <ShieldCheck size={20} weight="bold" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                display: "inline-block",
                width: "10px", height: "10px", borderRadius: "50%",
                background: statusSummary?.lastScanStatus === "SUCCESS" ? "#10B981" : "#F59E0B"
              }} />
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#0F2044" }}>
                {statusSummary?.lastScanStatus === "SUCCESS" ? "Confirmed Live" : statusSummary?.lastScanStatus || "Active"}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
              {statusSummary?.lastScanTime
                ? new Date(statusSummary.lastScanTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })
                : "Awaiting next 9:31 AM IST market session"}
            </div>
          </div>

          {/* Card 4: Next Scheduled Scan & Status */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#64748B" }}>Scheduler Status</span>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "rgba(100,116,139,0.12)", color: "#475569",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <Clock size={20} weight="bold" />
              </div>
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#0F2044" }}>
              {statusSummary?.nextScheduledScan || "09:31 AM IST (Mon-Fri)"}
            </div>
            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
              Retries: 9:35, 9:40, 9:45 AM if delayed
            </div>
          </div>
        </div>

        {/* Dashboard Toolbar / Controls */}
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "20px",
          padding: "16px 20px",
          marginBottom: "28px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
        }}>
          {/* Left: Date selector & Search */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px", flex: 1 }}>
            {/* Historical Date Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={18} color="#64748B" weight="bold" />
              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  loadData(e.target.value);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#0F2044",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {availableDates.length > 0 ? (
                  availableDates.map((d) => (
                    <option key={d} value={d}>
                      {d} {d === statusSummary?.currentDateIST ? "(Today)" : ""}
                    </option>
                  ))
                ) : (
                  <option value={selectedDate || "Latest"}>{selectedDate || "Latest Session"}</option>
                )}
              </select>
            </div>

            {/* Search Box */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: "10px",
              padding: "6px 14px",
              minWidth: "240px"
            }}>
              <MagnifyingGlass size={16} color="#94A3B8" weight="bold" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Futures company or symbol..."
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "13px",
                  color: "#0F2044",
                  width: "100%",
                  fontWeight: 500
                }}
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Export Button */}
            <button
              onClick={handleExport}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "10px",
                background: "#F1F5F9",
                border: "1px solid #CBD5E1",
                color: "#334155",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <DownloadSimple size={16} weight="bold" />
              Export Excel
            </button>

            {/* Manual Scan Trigger */}
            <button
              onClick={handleManualScan}
              disabled={scanning}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "10px",
                background: scanning ? "#94A3B8" : "linear-gradient(135deg, #0A7E8C, #14A096)",
                border: "none",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 800,
                cursor: scanning ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(10,126,140,0.25)",
                transition: "all 0.2s"
              }}
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                style={{
                  animation: scanning ? "spin 1s linear infinite" : "none"
                }}
              />
              {scanning ? "Scanning Futures..." : "Run Scanner Now"}
            </button>
          </div>
        </div>

        {/* Dual Strategy Sections: Gap Ups & Gap Downs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
          
          {/* Section 1: Gap Up — Bullish */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: "rgba(16,185,129,0.15)", display: "flex",
                  alignItems: "center", justifyContent: "center", color: "#16A34A"
                }}>
                  <ArrowUpRight size={24} weight="bold" />
                </div>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
                    Gap Up — Bullish
                  </h2>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Futures Segment: <code>[=1] 15 minute Low Greater than 1 day ago High</code>
                  </span>
                </div>
              </div>

              <span style={{
                background: "rgba(16,185,129,0.15)",
                color: "#16A34A",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 800
              }}>
                {filteredGapUps.length} Qualified
              </span>
            </div>

            {/* Table Container */}
            <div style={{ overflowX: "auto" }}>
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading Futures scan results...</div>
              ) : filteredGapUps.length === 0 ? (
                <div style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "#F8FAFC",
                  borderRadius: "16px",
                  border: "2px dashed #E2E8F0"
                }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", marginBottom: "6px" }}>
                    No Gap Up Companies Found
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748B", maxWidth: "480px", margin: "0 auto", lineHeight: "1.5" }}>
                    No Futures segment stocks met the Gap Up condition for this session. 
                    The entire first 15-minute candle low must hold strictly above yesterday&apos;s peak high.
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ color: "#64748B", fontSize: "12px", fontWeight: 800, textAlign: "left", textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 16px" }}>Company Name</th>
                      <th style={{ padding: "8px 16px" }}>NSE Symbol</th>
                      <th style={{ padding: "8px 16px" }}>Signal</th>
                      <th style={{ padding: "8px 16px" }}>Trading Date</th>
                      <th style={{ padding: "8px 16px" }}>Candle Time</th>
                      <th style={{ padding: "8px 16px", textAlign: "right" }}>Detected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGapUps.map((stock) => (
                      <tr
                        key={stock.nse_symbol}
                        onClick={() => handleStockClick(stock.nse_symbol)}
                        style={{
                          background: "#F8FAFC",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      >
                        <td style={{ padding: "16px", borderRadius: "12px 0 0 12px", fontWeight: 700, color: "#0F2044", fontSize: "14px" }}>
                          {stock.company_name}
                        </td>
                        <td style={{ padding: "16px", fontWeight: 800, color: "#0F2044", fontSize: "13px", fontFamily: "monospace" }}>
                          <span style={{ background: "#E2E8F0", padding: "4px 8px", borderRadius: "6px" }}>
                            {stock.nse_symbol}
                          </span>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{
                            background: "rgba(16,185,129,0.15)",
                            color: "#16A34A",
                            fontSize: "12px",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <ArrowUpRight size={14} weight="bold" />
                            GAP UP
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: "#475569", fontSize: "13px", fontWeight: 600 }}>
                          {stock.trading_date}
                        </td>
                        <td style={{ padding: "16px", color: "#64748B", fontSize: "12px", fontFamily: "monospace" }}>
                          {stock.candle_time || "09:15 - 09:30 AM"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", borderRadius: "0 12px 12px 0", color: "#0F2044", fontSize: "12px", fontWeight: 700 }}>
                          {formatDetectedAt(stock.scan_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Section 2: Gap Down — Bearish */}
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px",
                  background: "rgba(239,68,68,0.15)", display: "flex",
                  alignItems: "center", justifyContent: "center", color: "#DC2626"
                }}>
                  <ArrowDownRight size={24} weight="bold" />
                </div>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
                    Gap Down — Bearish
                  </h2>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Futures Segment: <code>[=1] 15 minute High Less than 1 day ago Low</code>
                  </span>
                </div>
              </div>

              <span style={{
                background: "rgba(239,68,68,0.15)",
                color: "#DC2626",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 800
              }}>
                {filteredGapDowns.length} Qualified
              </span>
            </div>

            {/* Table Container */}
            <div style={{ overflowX: "auto" }}>
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Loading Futures scan results...</div>
              ) : filteredGapDowns.length === 0 ? (
                <div style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  background: "#F8FAFC",
                  borderRadius: "16px",
                  border: "2px dashed #E2E8F0"
                }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", marginBottom: "6px" }}>
                    No Gap Down Companies Found
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748B", maxWidth: "480px", margin: "0 auto", lineHeight: "1.5" }}>
                    No Futures segment stocks met the Gap Down condition for this session. 
                    The entire first 15-minute candle high must hold strictly below yesterday&apos;s lowest floor.
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                  <thead>
                    <tr style={{ color: "#64748B", fontSize: "12px", fontWeight: 800, textAlign: "left", textTransform: "uppercase" }}>
                      <th style={{ padding: "8px 16px" }}>Company Name</th>
                      <th style={{ padding: "8px 16px" }}>NSE Symbol</th>
                      <th style={{ padding: "8px 16px" }}>Signal</th>
                      <th style={{ padding: "8px 16px" }}>Trading Date</th>
                      <th style={{ padding: "8px 16px" }}>Candle Time</th>
                      <th style={{ padding: "8px 16px", textAlign: "right" }}>Detected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGapDowns.map((stock) => (
                      <tr
                        key={stock.nse_symbol}
                        onClick={() => handleStockClick(stock.nse_symbol)}
                        style={{
                          background: "#F8FAFC",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      >
                        <td style={{ padding: "16px", borderRadius: "12px 0 0 12px", fontWeight: 700, color: "#0F2044", fontSize: "14px" }}>
                          {stock.company_name}
                        </td>
                        <td style={{ padding: "16px", fontWeight: 800, color: "#0F2044", fontSize: "13px", fontFamily: "monospace" }}>
                          <span style={{ background: "#E2E8F0", padding: "4px 8px", borderRadius: "6px" }}>
                            {stock.nse_symbol}
                          </span>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{
                            background: "rgba(239,68,68,0.15)",
                            color: "#DC2626",
                            fontSize: "12px",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            <ArrowDownRight size={14} weight="bold" />
                            GAP DOWN
                          </span>
                        </td>
                        <td style={{ padding: "16px", color: "#475569", fontSize: "13px", fontWeight: 600 }}>
                          {stock.trading_date}
                        </td>
                        <td style={{ padding: "16px", color: "#64748B", fontSize: "12px", fontFamily: "monospace" }}>
                          {stock.candle_time || "09:15 - 09:30 AM"}
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", borderRadius: "0 12px 12px 0", color: "#0F2044", fontSize: "12px", fontWeight: 700 }}>
                          {formatDetectedAt(stock.scan_time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
