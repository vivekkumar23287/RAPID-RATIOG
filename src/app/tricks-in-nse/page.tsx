"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, CaretRight } from "@phosphor-icons/react";

type LiveStockData = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  gapPercent: number;
};

type ScanCache = {
  dateString: string;
  timestamp: string;
  gapUps: LiveStockData[];
  gapDowns: LiveStockData[];
  isLocked: boolean;
};

const FALLBACK_GAP_UPS: LiveStockData[] = [
  { symbol: "POLYCAB", name: "Polycab India", price: 5890.40, changePercent: 2.18, gapPercent: 1.45 },
  { symbol: "RELIANCE", name: "Reliance Industries", price: 2450.25, changePercent: 1.12, gapPercent: 0.85 },
  { symbol: "TATAMOTORS", name: "Tata Motors", price: 980.50, changePercent: 1.85, gapPercent: 1.25 },
  { symbol: "SBIN", name: "State Bank of India", price: 790.30, changePercent: 1.56, gapPercent: 0.95 },
  { symbol: "ITC", name: "ITC Limited", price: 430.20, changePercent: 1.15, gapPercent: 0.75 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", price: 1210.40, changePercent: 1.68, gapPercent: 1.10 }
];

const FALLBACK_GAP_DOWNS: LiveStockData[] = [
  { symbol: "TCS", name: "TCS", price: 3890.00, changePercent: -1.24, gapPercent: -0.75 },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1510.40, changePercent: -0.87, gapPercent: -0.45 },
  { symbol: "ICICIBANK", name: "ICICI Bank", price: 1080.50, changePercent: -1.15, gapPercent: -0.65 },
  { symbol: "INFY", name: "Infosys", price: 1420.30, changePercent: -1.56, gapPercent: -0.90 },
  { symbol: "DEEPAKNTR", name: "Deepak Nitrite", price: 2340.10, changePercent: -0.95, gapPercent: -0.55 }
];

export default function TricksInNSE() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gapUps, setGapUps] = useState<LiveStockData[]>([]);
  const [gapDowns, setGapDowns] = useState<LiveStockData[]>([]);
  const [scanStatus, setScanStatus] = useState<{
    date: string;
    time: string;
    isLocked: boolean;
    reason: string;
  }>({
    date: "",
    time: "",
    isLocked: false,
    reason: ""
  });

  const checkScanScheduleAndFetch = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = 9 * 60 + 30; // 9:30 AM
      const isPastTargetTime = currentMinutes >= targetMinutes;

      // Indian standard date representation for checks
      const todayDateString = now.toLocaleDateString("en-IN", { year: "numeric", month: "2-digit", day: "2-digit" });

      // Retrieve previous scans cache
      const cachedData = localStorage.getItem("nse_gaps_scanner_cache");
      let cache: ScanCache | null = null;

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // Only validate cache if it has actual populated stock rows inside
          if (parsed && parsed.gapUps?.length > 0 && parsed.gapDowns?.length > 0) {
            cache = parsed;
          }
        } catch (e) {
          console.error("Failed to parse scanner cache");
        }
      }

      // Check if we need to perform a fresh scan
      // Rule: Perform fresh scan ONLY if it's a weekday, it's past 9:30 AM, and we haven't scanned today after 9:30 AM.
      const needsFreshScan = isWeekday && isPastTargetTime && (cache?.dateString !== todayDateString);

      if (needsFreshScan) {
        // Fetch fresh gaps calculations from server API
        const response = await fetch("/api/nse-gaps", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to scan live gaps");
        const data = await response.json();

        const freshUps: LiveStockData[] = data.gapUps || [];
        const freshDowns: LiveStockData[] = data.gapDowns || [];

        // Save fresh scan to localStorage cache, marked as locked for the rest of today
        const newCache: ScanCache = {
          dateString: todayDateString,
          timestamp: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          gapUps: freshUps,
          gapDowns: freshDowns,
          isLocked: true
        };

        localStorage.setItem("nse_gaps_scanner_cache", JSON.stringify(newCache));

        setGapUps(freshUps);
        setGapDowns(freshDowns);
        setScanStatus({
          date: todayDateString,
          time: newCache.timestamp,
          isLocked: true,
          reason: "Locked range (9:30 AM opening candle settled for today)."
        });
      } else if (cache) {
        // Use cached range (either locked range from earlier today, or Friday's closing ranges if weekend/before 9:30 AM)
        setGapUps(cache.gapUps);
        setGapDowns(cache.gapDowns);
        
        let statusReason = "Showing locked opening range from previous session.";
        if (isWeekday && !isPastTargetTime) {
          statusReason = "Awaiting 9:30 AM opening candle completion. Showing previous session.";
        } else if (!isWeekday) {
          statusReason = "Market is closed for the weekend. Showing Friday's 9:30 AM settled range.";
        } else {
          statusReason = "Locked range (9:30 AM opening candle settled for today).";
        }

        setScanStatus({
          date: cache.dateString,
          time: cache.timestamp,
          isLocked: true,
          reason: statusReason
        });
      } else {
        // No cache exists yet (first time visiting), perform immediate scan to hydrate the dashboard
        const response = await fetch("/api/nse-gaps", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch first time scan");
        const data = await response.json();

        const initialUps: LiveStockData[] = data.gapUps || [];
        const initialDowns: LiveStockData[] = data.gapDowns || [];

        const initialCache: ScanCache = {
          dateString: todayDateString,
          timestamp: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          gapUps: initialUps,
          gapDowns: initialDowns,
          isLocked: isWeekday && isPastTargetTime
        };

        localStorage.setItem("nse_gaps_scanner_cache", JSON.stringify(initialCache));

        setGapUps(initialUps);
        setGapDowns(initialDowns);
        setScanStatus({
          date: todayDateString,
          time: initialCache.timestamp,
          isLocked: initialCache.isLocked,
          reason: isWeekday && isPastTargetTime 
            ? "First-time scan hydrated. Range locked." 
            : "First-time scan hydrated. Will lock at next 9:30 AM session."
        });
      }
    } catch (error) {
      console.error("Scanner schedule load failed, using fallbacks:", error);
      // Fallback state guarantees user never sees a blank dashboard
      setGapUps(FALLBACK_GAP_UPS);
      setGapDowns(FALLBACK_GAP_DOWNS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkScanScheduleAndFetch();
  }, []);

  const handleStockClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  return (
    <div style={{ background: "#F8F9FC", minHeight: "100vh", paddingBottom: "100px" }}>
      <Navbar />
      
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 0px" }}>
        
        {/* Page Header */}
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 44px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "12px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            NSE Gap Scanner
          </h1>
          <p style={{ 
            color: "#64748B", 
            fontSize: "15px", 
            maxWidth: "680px", 
            margin: "0",
            lineHeight: 1.6
          }}>
            Track overnight opening gaps and intraday breakouts for high-volume NSE stocks. Select any company row to open its real-time interactive chart.
          </p>
        </div>

        {/* Scanner Grid Dashboard */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "32px" }}>
          
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
                <span style={{ fontSize: "12px", color: "#94A3B8" }}>Opening range gapping &ge; 0.20% higher than prev close</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonLoader key={i} />)
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
                <span style={{ fontSize: "12px", color: "#94A3B8" }}>Opening range gapping &le; -0.20% lower than prev close</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonLoader key={i} />)
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

      </main>

      {/* Global CSS for reload icon spinning */}
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

// Sleek individual stock card component
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
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "130px", justifyContent: "flex-end" }}>
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
