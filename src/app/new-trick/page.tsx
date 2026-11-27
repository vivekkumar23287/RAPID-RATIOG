"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { ArrowClockwise } from "@phosphor-icons/react";

interface CompanyItem {
  company_name: string;
  nse_symbol: string;
  added_at?: string;
  is_new?: boolean;
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

  useEffect(() => {
    loadInitialData();

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
  }, [loadInitialData]);

  // Single refresh handler for entire page
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshStatus("Scanning...");

    try {
      const res = await fetch("/api/new-trick/manual-scan", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
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
    isTrick2: boolean = false,
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

      {/* Column Sub-header */}
      <div
        style={{
          display: "flex",
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
        <span style={{ flex: isTrick2 ? "1.8" : "2.5" }}>Company Name</span>
        <span style={{ flex: "1", textAlign: isTrick2 ? "center" : "right" }}>Code</span>
        {isTrick2 && <span style={{ flex: "1", textAlign: "right" }}>Added At</span>}
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
              <div
                style={{
                  flex: isTrick2 ? "1.8" : "2.5",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
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
                {item.is_new && (
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      backgroundColor: "#10B98122",
                      color: "#059669",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    NEW
                  </span>
                )}
              </div>

              {/* Middle: NSE Symbol / Code */}
              <span
                style={{
                  flex: "1",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0F2044",
                  textAlign: isTrick2 ? "center" : "right",
                }}
              >
                {item.nse_symbol}
              </span>

              {/* Right: Added At (for Trick 2) */}
              {isTrick2 && (
                <span
                  style={{
                    flex: "1",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#64748B",
                    textAlign: "right",
                  }}
                >
                  {item.added_at || "—"}
                </span>
              )}
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
              false,
              isPendingT1
            )}
            {renderTableSection(
              "Gap Down",
              gapDowns,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              false,
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
              "15m Gap Up",
              m15Up,
              "#10B981",
              "rgba(16,185,129,0.08)",
              true,
              isPendingT2
            )}
            {renderTableSection(
              "15m Gap Down",
              m15Down,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              true,
              isPendingT2
            )}
            {renderTableSection(
              "1h Gap Up",
              h1Up,
              "#10B981",
              "rgba(16,185,129,0.08)",
              true,
              isPendingT2
            )}
            {renderTableSection(
              "1h Gap Down",
              h1Down,
              "#EF4444",
              "rgba(239,68,68,0.08)",
              true,
              isPendingT2
            )}
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
