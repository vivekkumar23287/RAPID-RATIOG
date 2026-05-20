"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, CaretRight, Crosshair } from "@phosphor-icons/react";

type LiveStockData = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  gapPercent: number;
};

export default function TricksInNSE() {
  const router = useRouter();
  const [loadingGaps, setLoadingGaps] = useState(true);
  const [gapUps, setGapUps] = useState<LiveStockData[]>([]);
  const [gapDowns, setGapDowns] = useState<LiveStockData[]>([]);

  const [loadingMother, setLoadingMother] = useState(true);
  const [motherMatches, setMotherMatches] = useState<any[]>([]);

  const fetchGaps = async () => {
    setLoadingGaps(true);
    try {
      const response = await fetch("/api/nse-gaps", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to scan live gaps");
      const data = await response.json();
      setGapUps(data.gapUps || []);
      setGapDowns(data.gapDowns || []);
    } catch (error) {
      console.error("Scanner load failed:", error);
      setGapUps([]);
      setGapDowns([]);
    } finally {
      setLoadingGaps(false);
    }
  };

  const fetchMotherRange = async () => {
    setLoadingMother(true);
    try {
      const res = await fetch("/api/scanner-5c", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to scan 5-candle");
      const data = await res.json();
      if (data.success) {
        setMotherMatches(data.matches || []);
      }
    } catch (e) {
      console.error("Mother range scanner load failed:", e);
      setMotherMatches([]);
    } finally {
      setLoadingMother(false);
    }
  };

  useEffect(() => {
    fetchGaps();
    fetchMotherRange();
  }, []);

  const handleStockClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  return (
    <div style={{ background: "#F8F9FC", minHeight: "100vh", paddingBottom: "100px" }}>
      <Navbar />
      
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 0px" }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: "50px" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 44px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "12px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            NSE Tricks & Scanners
          </h1>
          <p style={{ 
            color: "#64748B", 
            fontSize: "15px", 
            maxWidth: "680px", 
            margin: "0",
            lineHeight: 1.6
          }}>
            Track overnight opening gaps and 5-Candle Mother Range breakouts for high-volume NSE stocks. Select any company row to open its real-time interactive chart.
          </p>
        </div>

        {/* Section 1: Gap Scanner */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>1. True Gap Scanner</h2>
          <div style={{ background: "#E2E8F0", color: "#64748B", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
            9:15 AM - 9:30 AM
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "32px", marginBottom: "60px" }}>
          
          {/* Column 1: Gap Ups */}
          <div style={{
            background: "white",
            border: "1px solid rgba(226,232,240,0.8)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 10px 30px rgba(15,32,68,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10B981" }}>
                <ArrowUpRight size={22} weight="bold" />
              </div>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>🚀 Verified Gap Ups</h3>
                <span style={{ fontSize: "12px", color: "#94A3B8" }}>First 15-min low holds above prev day high</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {loadingGaps ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={i} />)
              ) : gapUps.length === 0 ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 24px",
                  borderRadius: "20px",
                  background: "rgba(248,250,252,0.6)",
                  border: "2px dashed rgba(226,232,240,0.8)",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F2044" }}>No Active Gap Ups</div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", maxWidth: "240px", lineHeight: "1.4" }}>
                    No stocks have broken out above yesterday's session peak yet.
                  </div>
                </div>
              ) : (
                gapUps.map((stock) => (
                  <StockRow 
                    key={stock.symbol} 
                    stock={stock} 
                    isUp={true} 
                    onClick={() => handleStockClick(stock.symbol)} 
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: Gap Downs */}
          <div style={{
            background: "white",
            border: "1px solid rgba(226,232,240,0.8)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 10px 30px rgba(15,32,68,0.03)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
                <ArrowDownRight size={22} weight="bold" />
              </div>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>📉 Verified Gap Downs</h3>
                <span style={{ fontSize: "12px", color: "#94A3B8" }}>First 15-min high stays below prev day low</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {loadingGaps ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={i} />)
              ) : gapDowns.length === 0 ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 24px",
                  borderRadius: "20px",
                  background: "rgba(248,250,252,0.6)",
                  border: "2px dashed rgba(226,232,240,0.8)",
                  textAlign: "center"
                }}>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F2044" }}>No Active Gap Downs</div>
                  <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", maxWidth: "240px", lineHeight: "1.4" }}>
                    No stocks have broken down below yesterday's session floor yet.
                  </div>
                </div>
              ) : (
                gapDowns.map((stock) => (
                  <StockRow 
                    key={stock.symbol} 
                    stock={stock} 
                    isUp={false} 
                    onClick={() => handleStockClick(stock.symbol)} 
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Mother Range Scanner */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>2. 5-Candle Mother Range Setup</h2>
          <div style={{ background: "#E2E8F0", color: "#64748B", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
            Intraday Breakout
          </div>
        </div>

        <div style={{
          background: "white",
          border: "1px solid rgba(226,232,240,0.8)",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(15,32,68,0.03)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" }}>
              <Crosshair size={22} weight="bold" />
            </div>
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>🎯 Volatility Contraction (Mother Range)</h3>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>Identifies inside-range consolidation where the first 15-m candle encapsulates the previous and next candles.</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loadingMother ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonLoader key={i} />)
            ) : motherMatches.length === 0 ? (
              <div style={{
                gridColumn: "1 / -1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                borderRadius: "20px",
                background: "rgba(248,250,252,0.6)",
                border: "2px dashed rgba(226,232,240,0.8)",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F2044" }}>No Active Mother Range Setups</div>
                <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px", maxWidth: "240px", lineHeight: "1.4" }}>
                  No stocks match the strict 5-candle inside-range pattern right now.
                </div>
              </div>
            ) : (
              motherMatches.map(stock => (
                <MotherRow 
                  key={stock.symbol} 
                  stock={stock} 
                  onClick={() => handleStockClick(stock.symbol)} 
                />
              ))
            )}
          </div>
        </div>

      </main>

      {/* Global CSS for animations */}
      <style>{`
        .spin-animate {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media(max-width: 900px) {
          main { padding: 120px 1rem 0 !important; }
        }
      `}</style>
    </div>
  );
}

// Sleek individual stock card component for Gaps
function StockRow({ stock, isUp, onClick }: { stock: LiveStockData; isUp: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderRadius: "16px",
        background: hovered ? "#F8FAFC" : "#FFFFFF",
        border: "1px solid",
        borderColor: hovered ? "rgba(226,232,240,0.8)" : "rgba(241,245,249,0.6)",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)"
      }}
    >
      {/* Left section: Icon and Names */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: isUp ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
          color: isUp ? "#10B981" : "#EF4444",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "13px",
          letterSpacing: "-0.5px"
        }}>
          {stock.symbol.substring(0, 3)}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "15px" }}>{stock.symbol}</span>
            <span style={{
              fontSize: "10px",
              fontFamily: "monospace",
              color: "#94A3B8",
              background: "#F1F5F9",
              padding: "2px 6px",
              borderRadius: "4px"
            }}>NSE</span>
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {stock.name}
          </div>
        </div>
      </div>

      {/* Middle section: Price */}
      <div style={{ textAlign: "right", marginLeft: "auto", marginRight: "auto" }}>
        <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "16px", fontFamily: "monospace" }}>
          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ 
          fontSize: "11px", 
          color: stock.changePercent >= 0 ? "#10B981" : "#EF4444", 
          fontWeight: 700, 
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "2px"
        }}>
          {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
        </div>
      </div>

      {/* Right section: Gap and Redirect Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "120px", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: 800, 
            color: isUp ? "#10B981" : "#EF4444",
            background: isUp ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            padding: "4px 10px",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          }}>
            {isUp ? "+" : ""}{stock.gapPercent.toFixed(2)}% Gap
          </span>
        </div>

        {/* Beautiful slide-in caret on hover */}
        <div style={{ 
          width: "24px", 
          height: "24px", 
          borderRadius: "50%", 
          background: hovered ? (isUp ? "#10B981" : "#EF4444") : "transparent",
          color: hovered ? "white" : "#94A3B8",
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          transition: "all 0.2s ease"
        }}>
          <CaretRight size={14} weight="bold" />
        </div>
      </div>
    </div>
  );
}

// Sleek individual stock card component for Mother Range
function MotherRow({ stock, onClick }: { stock: any; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isUp = stock.changePercent >= 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        borderRadius: "16px",
        background: hovered ? "#F8FAFC" : "#FFFFFF",
        border: "1px solid",
        borderColor: hovered ? "rgba(226,232,240,0.8)" : "rgba(241,245,249,0.6)",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)"
      }}
    >
      {/* Left section: Icon and Names */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "rgba(59,130,246,0.06)",
          color: "#3B82F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "13px",
          letterSpacing: "-0.5px"
        }}>
          {stock.symbol.substring(0, 3)}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "15px" }}>{stock.symbol}</span>
            <span style={{
              fontSize: "10px",
              fontFamily: "monospace",
              color: "#94A3B8",
              background: "#F1F5F9",
              padding: "2px 6px",
              borderRadius: "4px"
            }}>NSE</span>
          </div>
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {stock.name}
          </div>
        </div>
      </div>

      {/* Middle section: Price */}
      <div style={{ textAlign: "right", marginLeft: "auto", marginRight: "auto" }}>
        <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "16px", fontFamily: "monospace" }}>
          ₹{stock.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ 
          fontSize: "11px", 
          color: isUp ? "#10B981" : "#EF4444", 
          fontWeight: 700, 
          marginTop: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "2px"
        }}>
          {isUp ? "+" : ""}{stock.changePercent.toFixed(2)}%
        </div>
      </div>

      {/* Right section: Vol/Time and Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "120px", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ 
            fontSize: "12px", fontWeight: 700, color: "#475569", background: "#F1F5F9",
            padding: "4px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px"
          }}>
            Vol: {(stock.totalVolume / 100000).toFixed(1)}L
          </span>
          <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
            {stock.timeDetected}
          </div>
        </div>

        {/* Slide-in caret */}
        <div style={{ 
          width: "24px", height: "24px", borderRadius: "50%", background: hovered ? "#3B82F6" : "transparent",
          color: hovered ? "white" : "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease"
        }}>
          <CaretRight size={14} weight="bold" />
        </div>
      </div>
    </div>
  );
}

// Cool shimmering skeleton loader component
function SkeletonLoader() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderRadius: "16px",
      border: "1px solid rgba(241,245,249,0.6)",
      background: "#FFFFFF"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div className="shimmer" style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#F1F5F9" }} />
        <div>
          <div className="shimmer" style={{ width: "80px", height: "16px", borderRadius: "4px", background: "#F1F5F9" }} />
          <div className="shimmer" style={{ width: "120px", height: "12px", borderRadius: "4px", background: "#F1F5F9", marginTop: "6px" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
        <div className="shimmer" style={{ width: "60px", height: "16px", borderRadius: "4px", background: "#F1F5F9" }} />
        <div className="shimmer" style={{ width: "40px", height: "12px", borderRadius: "4px", background: "#F1F5F9" }} />
      </div>
      <div className="shimmer" style={{ width: "70px", height: "24px", borderRadius: "8px", background: "#F1F5F9" }} />

      <style jsx>{`
        .shimmer {
          position: relative;
          overflow: hidden;
        }
        .shimmer::after {
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.6) 20%,
            rgba(255, 255, 255, 0.8) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: shimmer 1.5s infinite;
          content: '';
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
