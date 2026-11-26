"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowClockwise } from "@phosphor-icons/react";

interface CompanyItem {
  company_name: string;
  nse_symbol: string;
}

export default function NewTrickPage() {
  // Trick 1: Gap Up & Gap Down
  const [gapUps, setGapUps] = useState<CompanyItem[]>([]);
  const [gapDowns, setGapDowns] = useState<CompanyItem[]>([]);

  // Trick 2: 3-Candle Gap (15m & 1h)
  const [m15Up, setM15Up] = useState<CompanyItem[]>([]);
  const [m15Down, setM15Down] = useState<CompanyItem[]>([]);
  const [h1Up, setH1Up] = useState<CompanyItem[]>([]);
  const [h1Down, setH1Down] = useState<CompanyItem[]>([]);

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
          setM15Up(data.m15Up || []);
          setM15Down(data.m15Down || []);
          setH1Up(data.h1Up || []);
          setH1Down(data.h1Down || []);
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
        setM15Up(data.m15Up || []);
        setM15Down(data.m15Down || []);
        setH1Up(data.h1Up || []);
        setH1Down(data.h1Down || []);
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

  // Reusable compact table component
  const renderTableSection = (
    title: string,
    items: CompanyItem[],
    accentColor: string, // "#22C55E" (green) or "#EF4444" (red)
    borderColor: string,
    bgColor: string
  ) => (
    <div
      style={{
        backgroundColor: "#0B111D",
        border: `1px solid ${borderColor}`,
        borderRadius: "10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Table Header: Category Title and Count */}
      <div
        style={{
          padding: "8px 14px",
          backgroundColor: bgColor,
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: accentColor,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: accentColor,
            backgroundColor: `${accentColor}1A`,
            padding: "2px 7px",
            borderRadius: "10px",
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Column Sub-header: Company Name (left) | Code (right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 14px",
          backgroundColor: "#0F172A40",
          borderBottom: "1px solid #1E293B40",
          fontSize: "11px",
          fontWeight: 600,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        <span>Company Name</span>
        <span>Code</span>
      </div>

      {/* Rows List */}
      <div style={{ maxHeight: "360px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "20px 14px", textAlign: "center", color: "#64748B", fontSize: "12px" }}>
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "20px 14px", textAlign: "center", color: "#64748B", fontSize: "12px" }}>
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
                padding: "0 14px",
                borderBottom: idx === items.length - 1 ? "none" : "1px solid #1E293B44",
                textDecoration: "none",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${accentColor}0D`)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {/* Left: Company Name */}
              <span
                style={{
                  fontSize: "12.5px",
                  color: "#94A3B8",
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
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#F1F5F9" }}>
                {item.nse_symbol}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060A10", color: "#F1F5F9", padding: "20px 16px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Top Header: Title & Single Refresh Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: "1px solid #1E293B",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em", color: "#F8FAFC", margin: 0 }}>
              New Trick
            </h1>
          </div>

          {/* Single Refresh Button and IST Timestamp */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {refreshStatus && (
              <span
                style={{
                  fontSize: "12px",
                  color: refreshStatus.includes("failed") ? "#EF4444" : "#94A3B8",
                  fontWeight: 500,
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
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid #334155",
                backgroundColor: refreshing ? "#1E293B" : "#0F172A",
                color: "#E2E8F0",
                cursor: refreshing ? "not-allowed" : "pointer",
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
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>
              Trick 1 — Gap Up & Down
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {renderTableSection(
              "Gap Up",
              gapUps,
              "#22C55E",
              "#16A34A33",
              "#16A34A15"
            )}
            {renderTableSection(
              "Gap Down",
              gapDowns,
              "#EF4444",
              "#DC262633",
              "#DC262615"
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STRATEGY 2: TRICK 2 — 3-CANDLE GAP */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#E2E8F0", margin: 0 }}>
              Trick 2 — 3-Candle Gap
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {renderTableSection(
              "15m Gap Up",
              m15Up,
              "#22C55E",
              "#16A34A33",
              "#16A34A15"
            )}
            {renderTableSection(
              "15m Gap Down",
              m15Down,
              "#EF4444",
              "#DC262633",
              "#DC262615"
            )}
            {renderTableSection(
              "1h Gap Up",
              h1Up,
              "#22C55E",
              "#16A34A33",
              "#16A34A15"
            )}
            {renderTableSection(
              "1h Gap Down",
              h1Down,
              "#EF4444",
              "#DC262633",
              "#DC262615"
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
