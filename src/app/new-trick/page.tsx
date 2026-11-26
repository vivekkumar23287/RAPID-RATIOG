"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowClockwise } from "@phosphor-icons/react";

interface CompanyItem {
  nse_symbol: string;
  company_name: string;
}

export default function NewTrickPage() {
  const [gapUps, setGapUps] = useState<CompanyItem[]>([]);
  const [gapDowns, setGapDowns] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string>("");

  // Load latest cached gap results on mount
  const loadInitialData = useCallback(async () => {
    try {
      const res = await fetch("/api/new-trick/results");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGapUps(data.gapUps || []);
          setGapDowns(data.gapDowns || []);
          if (data.lastRefreshedAt) {
            setRefreshStatus(`Refreshed at ${data.lastRefreshedAt}`);
          }
        }
      }
    } catch (err: any) {
      console.warn("[New Trick] Failed to load initial data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle single refresh button click
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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#060A10", color: "#F1F5F9", padding: "20px 16px" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Top Header Row: Title & Single Refresh Action */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "16px",
            borderBottom: "1px solid #1E293B",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em", color: "#F8FAFC", margin: 0 }}>
              Gap Scanner
            </h1>
          </div>

          {/* Single Refresh Button and Status Timestamp */}
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

        {/* Two-Column Responsive Layout: Gap Up & Gap Down */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Column 1: Gap Up */}
          <div
            style={{
              backgroundColor: "#0B111D",
              border: "1px solid #16A34A33",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: "#16A34A15",
                borderBottom: "1px solid #16A34A33",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#22C55E", letterSpacing: "0.02em" }}>
                GAP UP
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#22C55E",
                  backgroundColor: "#16A34A25",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {gapUps.length}
              </span>
            </div>

            <div style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  Loading...
                </div>
              ) : gapUps.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  No companies found
                </div>
              ) : (
                gapUps.map((item, idx) => (
                  <Link
                    key={`${item.nse_symbol}-${idx}`}
                    href={`/stock/${encodeURIComponent(item.nse_symbol)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      height: "36px",
                      padding: "0 16px",
                      borderBottom: idx === gapUps.length - 1 ? "none" : "1px solid #1E293B44",
                      textDecoration: "none",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16A34A0C")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F5F9" }}>
                      {item.nse_symbol}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#94A3B8",
                        maxWidth: "60%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "right",
                      }}
                    >
                      {item.company_name}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Gap Down */}
          <div
            style={{
              backgroundColor: "#0B111D",
              border: "1px solid #DC262633",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: "#DC262615",
                borderBottom: "1px solid #DC262633",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#EF4444", letterSpacing: "0.02em" }}>
                GAP DOWN
              </span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#EF4444",
                  backgroundColor: "#DC262625",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                {gapDowns.length}
              </span>
            </div>

            <div style={{ maxHeight: "calc(100vh - 160px)", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  Loading...
                </div>
              ) : gapDowns.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748B", fontSize: "13px" }}>
                  No companies found
                </div>
              ) : (
                gapDowns.map((item, idx) => (
                  <Link
                    key={`${item.nse_symbol}-${idx}`}
                    href={`/stock/${encodeURIComponent(item.nse_symbol)}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      height: "36px",
                      padding: "0 16px",
                      borderBottom: idx === gapDowns.length - 1 ? "none" : "1px solid #1E293B44",
                      textDecoration: "none",
                      transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#DC26260C")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#F1F5F9" }}>
                      {item.nse_symbol}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#94A3B8",
                        maxWidth: "60%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "right",
                      }}
                    >
                      {item.company_name}
                    </span>
                  </Link>
                ))
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
