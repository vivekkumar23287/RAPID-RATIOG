"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowClockwise } from "@phosphor-icons/react";

interface CompanyItem {
  company_name: string;
  nse_symbol: string;
}

interface SMCSignalItem {
  company_name: string;
  nse_symbol: string;
  timeframe: string;
  signal_type: string;
  direction: "BULLISH" | "BEARISH";
  category: "BOS" | "CHOCH" | "FVG" | "OB" | "LIQUIDITY";
  price?: number;
  detected_at?: string;
}

export default function NewTrickPage() {
  // Trick 1: Gap Up & Gap Down
  const [gapUps, setGapUps] = useState<CompanyItem[]>([]);
  const [gapDowns, setGapDowns] = useState<CompanyItem[]>([]);
  const [isPendingT1, setIsPendingT1] = useState(false);

  // Trick 2: 3-Candle Gap (15m & 1h)
  const [m15Up, setM15Up] = useState<CompanyItem[]>([]);
  const [m15Down, setM15Down] = useState<CompanyItem[]>([]);
  const [h1Up, setH1Up] = useState<CompanyItem[]>([]);
  const [h1Down, setH1Down] = useState<CompanyItem[]>([]);
  const [isPendingT2, setIsPendingT2] = useState(false);

  // Trick 3: Smart Money Concepts (SMC)
  const [smcSignals, setSmcSignals] = useState<SMCSignalItem[]>([]);
  const [smcTimeframe, setSmcTimeframe] = useState<string>("15m");
  const [smcDirection, setSmcDirection] = useState<string>("ALL");
  const [smcCategory, setSmcCategory] = useState<string>("ALL");
  const [smcLoading, setSmcLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string>("");

  // Load initial cached results
  const loadInitialData = useCallback(async () => {
    try {
      const res = await fetch("/api/new-trick/results");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGapUps(data.gapUps || []);
          setGapDowns(data.gapDowns || []);
          setIsPendingT1(!!data.isPendingT1);

          setM15Up(data.m15Up || []);
          setM15Down(data.m15Down || []);
          setH1Up(data.h1Up || []);
          setH1Down(data.h1Down || []);
          setIsPendingT2(!!data.isPendingT2);

          if (data.lastRefreshedAt) {
            setRefreshStatus(`Refreshed at ${data.lastRefreshedAt}`);
          }
        }
      }
    } catch (err: any) {
      console.warn("[New Trick] Failed to load data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch SMC Signals
  const fetchSmcSignals = useCallback(async (tf = smcTimeframe, dir = smcDirection, cat = smcCategory) => {
    try {
      setSmcLoading(true);
      const params = new URLSearchParams();
      if (tf && tf !== "ALL") params.append("timeframe", tf);
      if (dir && dir !== "ALL") params.append("direction", dir);
      if (cat && cat !== "ALL") params.append("category", cat);

      const res = await fetch(`/api/new-trick/smc?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSmcSignals(data.signals || []);
        }
      }
    } catch (err: any) {
      console.warn("[New Trick] Failed to fetch SMC signals:", err);
    } finally {
      setSmcLoading(false);
    }
  }, [smcTimeframe, smcDirection, smcCategory]);

  useEffect(() => {
    loadInitialData();
    fetchSmcSignals();

    // Background interval check every 30 seconds for live updates
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetch("/api/new-trick/results")
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              setGapUps(data.gapUps || []);
              setGapDowns(data.gapDowns || []);
              setIsPendingT1(!!data.isPendingT1);
              setM15Up(data.m15Up || []);
              setM15Down(data.m15Down || []);
              setH1Up(data.h1Up || []);
              setH1Down(data.h1Down || []);
              setIsPendingT2(!!data.isPendingT2);
            }
          })
          .catch(() => {});
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadInitialData, fetchSmcSignals]);

  // Single refresh handler for entire page
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshStatus("Scanning...");

    try {
      const [gapRes, smcRes] = await Promise.all([
        fetch("/api/new-trick/manual-scan", { method: "POST" }),
        fetch("/api/new-trick/smc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeframe: smcTimeframe === "ALL" ? "15m" : smcTimeframe }),
        }),
      ]);

      const data = await gapRes.json();
      if (gapRes.ok && data.success) {
        setGapUps(data.gapUps || []);
        setGapDowns(data.gapDowns || []);
        setIsPendingT1(false);

        setM15Up(data.m15Up || []);
        setM15Down(data.m15Down || []);
        setH1Up(data.h1Up || []);
        setH1Down(data.h1Down || []);
        setIsPendingT2(false);

        setRefreshStatus(`Refreshed at ${data.lastRefreshedAt}`);
      } else {
        setRefreshStatus("Refresh failed");
      }

      if (smcRes.ok) {
        const smcData = await smcRes.json();
        if (smcData.success) {
          fetchSmcSignals(smcTimeframe, smcDirection, smcCategory);
        }
      }
    } catch (err: any) {
      console.error("[New Trick] Refresh failed:", err);
      setRefreshStatus("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Reusable compact table component styled with the Tricks page white theme
  const renderTableSection = (
    title: string,
    items: CompanyItem[],
    accentColor: string,
    badgeBg: string,
    isPending: boolean = false
  ) => (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Table Header: Category Title and Count */}
      <div
        style={{
          padding: "10px 16px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: accentColor,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: accentColor,
            background: badgeBg,
            padding: "2px 8px",
            borderRadius: "12px",
            border: `1px solid ${accentColor}25`,
          }}
        >
          {isPending ? "Pending" : items.length}
        </span>
      </div>

      {/* Column Sub-header: Company Name (left) | Code (right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 16px",
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          fontSize: "11px",
          fontWeight: 700,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        <span>Company Name</span>
        <span>Code</span>
      </div>

      {/* Rows List */}
      <div style={{ maxHeight: "380px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
            Loading...
          </div>
        ) : isPending ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#D97706", fontSize: "12px", fontWeight: 600 }}>
            Today&apos;s scan pending (Runs 9:31 AM IST)
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
            No companies found
          </div>
        ) : (
          items.map((item, idx) => (
            <Link
              key={`${item.nse_symbol}-${idx}`}
              href={`/stock/${encodeURIComponent(item.nse_symbol)}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "36px",
                padding: "0 16px",
                borderBottom: idx === items.length - 1 ? "none" : "1px solid #F1F5F9",
                textDecoration: "none",
                background: "#FFFFFF",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = badgeBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
            >
              {/* Left: Company Name */}
              <span
                style={{
                  fontSize: "12.5px",
                  fontWeight: 500,
                  color: "#334155",
                  maxWidth: "68%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                }}
              >
                {item.company_name}
              </span>

              {/* Right: NSE Symbol / Code */}
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0F2044",
                  textAlign: "right",
                }}
              >
                {item.nse_symbol}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", color: "#0F2044" }}>
      <Navbar />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Top Header Row: Title & Single Refresh Action */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "18px",
            borderBottom: "1px solid #E2E8F0",
            marginBottom: "28px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0, letterSpacing: "-0.01em" }}>
              New Trick
            </h1>
          </div>

          {/* Single Refresh Button and IST Timestamp */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {refreshStatus && (
              <span
                style={{
                  fontSize: "12px",
                  color: refreshStatus.includes("failed") ? "#EF4444" : "#64748B",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {refreshStatus}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh Scanner"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                backgroundColor: refreshing ? "#F1F5F9" : "#FFFFFF",
                color: "#334155",
                cursor: refreshing ? "not-allowed" : "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all 0.15s ease",
              }}
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                style={{
                  animation: refreshing ? "spin 0.8s linear infinite" : "none",
                }}
              />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STRATEGY 1: TRICK 1 — GAP UP & DOWN */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
              Trick 1 — Gap Up &amp; Down
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            {renderTableSection(
              "Gap Up",
              gapUps,
              "#10B981",
              "rgba(16,185,129,0.08)",
              isPendingT1
            )}
            {renderTableSection(
              "Gap Down",
              gapDowns,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              isPendingT1
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STRATEGY 2: TRICK 2 — 3-CANDLE GAP */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
              Trick 2 — 3-Candle Gap
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: "20px",
            }}
          >
            {renderTableSection(
              "15-Minute Bullish",
              m15Up,
              "#10B981",
              "rgba(16,185,129,0.08)",
              isPendingT2
            )}
            {renderTableSection(
              "15-Minute Bearish",
              m15Down,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              isPendingT2
            )}
            {renderTableSection(
              "1-Hour Bullish",
              h1Up,
              "#10B981",
              "rgba(16,185,129,0.08)",
              isPendingT2
            )}
            {renderTableSection(
              "1-Hour Bearish",
              h1Down,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              isPendingT2
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STRATEGY 3: TRICK 3 — SMART MONEY CONCEPTS (SMC) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
              Trick 3 — Smart Money Concepts
            </h2>

            {/* Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Timeframe */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {["15m", "1h", "5m", "ALL"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setSmcTimeframe(tf);
                      fetchSmcSignals(tf, smcDirection, smcCategory);
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcTimeframe === tf ? "#0F2044" : "transparent",
                      color: smcTimeframe === tf ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Direction */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {[
                  { id: "ALL", label: "ALL" },
                  { id: "BULLISH", label: "Bullish", color: "#10B981" },
                  { id: "BEARISH", label: "Bearish", color: "#EF4444" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSmcDirection(d.id);
                      fetchSmcSignals(smcTimeframe, d.id, smcCategory);
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcDirection === d.id ? (d.color || "#0F2044") : "transparent",
                      color: smcDirection === d.id ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Category */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {["ALL", "BOS", "CHOCH", "FVG", "OB", "LIQUIDITY"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSmcCategory(cat);
                      fetchSmcSignals(smcTimeframe, smcDirection, cat);
                    }}
                    style={{
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcCategory === cat ? "#0F2044" : "transparent",
                      color: smcCategory === cat ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header: Title and Count */}
            <div
              style={{
                padding: "10px 16px",
                background: "#FFFFFF",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#0F2044",
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                SMC Signals
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#0F2044",
                  background: "rgba(15,32,68,0.08)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  border: "1px solid rgba(15,32,68,0.15)",
                }}
              >
                {smcSignals.length}
              </span>
            </div>

            {/* Column Sub-header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 16px",
                background: "#F8FAFC",
                borderBottom: "1px solid #E2E8F0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ flex: 2 }}>Company Name</span>
              <span style={{ flex: 1, textAlign: "center" }}>Code</span>
              <span style={{ flex: 1.5, textAlign: "right" }}>SMC Signal</span>
            </div>

            {/* Rows List */}
            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {smcLoading ? (
                <div style={{ padding: "28px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
                  Scanning SMC market structure...
                </div>
              ) : smcSignals.length === 0 ? (
                <div style={{ padding: "28px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
                  No SMC signals detected for current filters
                </div>
              ) : (
                smcSignals.map((item, idx) => {
                  const isBull = item.direction === "BULLISH";
                  const badgeColor = isBull ? "#10B981" : "#EF4444";
                  const badgeBg = isBull ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";

                  return (
                    <Link
                      key={`${item.nse_symbol}-${item.signal_type}-${idx}`}
                      href={`/stock/${encodeURIComponent(item.nse_symbol)}?tf=${encodeURIComponent(item.timeframe || "15m")}&smc=true`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        height: "40px",
                        padding: "0 16px",
                        borderBottom: idx === smcSignals.length - 1 ? "none" : "1px solid #F1F5F9",
                        textDecoration: "none",
                        background: "#FFFFFF",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = badgeBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      {/* Left: Company Name */}
                      <span
                        style={{
                          flex: 2,
                          fontSize: "12.5px",
                          fontWeight: 500,
                          color: "#334155",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: "left",
                        }}
                      >
                        {item.company_name}
                      </span>

                      {/* Center: NSE Symbol */}
                      <span
                        style={{
                          flex: 1,
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#0F2044",
                          textAlign: "center",
                        }}
                      >
                        {item.nse_symbol}
                      </span>

                      {/* Right: Signal Badge */}
                      <div style={{ flex: 1.5, textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "12px",
                            color: badgeColor,
                            background: badgeBg,
                            border: `1px solid ${badgeColor}25`,
                            display: "inline-block",
                          }}
                        >
                          {item.signal_type}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STRATEGY 3: TRICK 3 — SMART MONEY CONCEPTS (SMC) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "36px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
                Trick 3 — Smart Money Concepts
              </h2>
            </div>

            {/* Filter Pills: Timeframe, Direction, Category */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Timeframe selector */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {["15m", "1h", "5m", "ALL"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => { setSmcTimeframe(tf); fetchSmcSignals(tf, smcDirection, smcCategory); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcTimeframe === tf ? "#0F2044" : "transparent",
                      color: smcTimeframe === tf ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tf.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Direction selector */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {[
                  { id: "ALL", label: "ALL" },
                  { id: "BULLISH", label: "Bullish", color: "#10B981" },
                  { id: "BEARISH", label: "Bearish", color: "#EF4444" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { setSmcDirection(d.id); fetchSmcSignals(smcTimeframe, d.id, smcCategory); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcDirection === d.id ? (d.color || "#0F2044") : "transparent",
                      color: smcDirection === d.id ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Category selector */}
              <div style={{ display: "flex", alignItems: "center", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                {["ALL", "BOS", "CHOCH", "FVG", "OB", "LIQUIDITY"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setSmcCategory(cat); fetchSmcSignals(smcTimeframe, smcDirection, cat); }}
                    style={{
                      padding: "4px 9px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      background: smcCategory === cat ? "#0F2044" : "transparent",
                      color: smcCategory === cat ? "#FFFFFF" : "#64748B",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SMC Table Section: White Card with Company Name (left), Code (middle/right), SMC Signal (right) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            {/* Sub-header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px 180px",
                padding: "8px 16px",
                background: "#F8FAFC",
                borderBottom: "1px solid #E2E8F0",
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              <span>Company Name</span>
              <span style={{ textAlign: "center" }}>NSE Code</span>
              <span style={{ textAlign: "right" }}>SMC Signal</span>
            </div>

            {/* Rows List */}
            <div style={{ maxHeight: "420px", overflowY: "auto" }}>
              {smcLoading ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
                  Scanning SMC market structure...
                </div>
              ) : smcSignals.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>
                  No SMC signals detected for current filters
                </div>
              ) : (
                smcSignals.map((item, idx) => {
                  const isBull = item.direction === "BULLISH";
                  const badgeBg = isBull ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)";
                  const badgeColor = isBull ? "#059669" : "#DC2626";

                  return (
                    <Link
                      key={`${item.nse_symbol}-${item.signal_type}-${idx}`}
                      href={`/stock/${encodeURIComponent(item.nse_symbol)}?tf=${encodeURIComponent(item.timeframe || "15m")}&smc=true`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 140px 180px",
                        alignItems: "center",
                        height: "40px",
                        padding: "0 16px",
                        borderBottom: idx === smcSignals.length - 1 ? "none" : "1px solid #F1F5F9",
                        textDecoration: "none",
                        background: "#FFFFFF",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isBull ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                    >
                      {/* Left: Company Name */}
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 500,
                          color: "#334155",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.company_name}
                      </span>

                      {/* Middle: NSE Symbol */}
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#0F2044",
                          textAlign: "center",
                        }}
                      >
                        {item.nse_symbol}
                      </span>

                      {/* Right: Signal Badge */}
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}30`,
                            display: "inline-block",
                          }}
                        >
                          {item.signal_type}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
