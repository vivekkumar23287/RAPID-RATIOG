"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { 
  MagnifyingGlass, Clock, CaretUp, CaretDown, BellRinging, BellSlash, 
  ArrowUpRight, ArrowDownRight, CaretRight, Crosshair, Info 
} from "@phosphor-icons/react";
import { io, Socket } from "socket.io-client";

type SignalData = {
  id: number;
  stock_symbol: string;
  stock_name: string;
  signal_type: string;
  direction: string;
  timeframe: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  candle_time: string;
  candle_date: string;
};

type LiveStockData = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  gapPercent: number;
};

const check3CandleBreakoutSetup = (candles: any[]) => {
  if (candles.length < 3) return { matched: false };
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];

  const isC1Red = c1.close < c1.open;
  const isC2Green = c2.close > c2.open;
  const isC2Breakout = c2.high > c1.high;
  const isC3Green = c3.close > c3.open;
  const isC3Breakout = c3.high > c2.high;

  if (isC1Red && isC2Green && isC2Breakout && isC3Green && isC3Breakout) {
    return {
      matched: true,
      c1,
      c2,
      c3,
      refRange: { high: c1.high, low: c1.low },
      breakoutLevels: { c2High: c2.high, c3High: c3.high },
      triggerPrice: c3.close
    };
  }
  return { matched: false };
};

export default function TricksInNSE() {
  const router = useRouter();
  
  
  const [loadingGaps, setLoadingGaps] = useState(true);
  const [gapUps, setGapUps] = useState<LiveStockData[]>([]);
  const [gapDowns, setGapDowns] = useState<LiveStockData[]>([]);

  const [loadingMother, setLoadingMother] = useState(true);
  const [motherMatches, setMotherMatches] = useState<any[]>([]);

  
  const [breakoutMatches, setBreakoutMatches] = useState<any[]>([]);
  const [loadingBreakout, setLoadingBreakout] = useState(true);

  
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
  const [specialFilter, setSpecialFilter] = useState<"ALL" | "NIFTY">("ALL");
  const [specialSearch, setSpecialSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchGaps = async () => {
    setLoadingGaps(true);
    try {
      const response = await fetch("/api/nse-gaps", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to scan live gaps");
      const data = await response.json();
      setGapUps(data.gapUps || []);
      setGapDowns(data.gapDowns || []);
    } catch (error) {
      console.warn("Scanner load failed:", error);
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
      console.warn("Mother range scanner load failed:", e);
      setMotherMatches([]);
    } finally {
      setLoadingMother(false);
    }
  };

  const fetchBreakoutSetups = async () => {
    setLoadingBreakout(true);
    try {
      const res = await fetch("/api/scanner-3c", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to scan 3-candle breakout");
      const data = await res.json();
      if (data.success) {
        setBreakoutMatches(data.matches || []);
      }
    } catch (error) {
      console.warn("Failed to load 3-candle breakout setups:", error);
      setBreakoutMatches([]);
    } finally {
      setLoadingBreakout(false);
    }
  };

  useEffect(() => {
    fetchGaps();
    fetchMotherRange();
    fetchBreakoutSetups();
  }, []);

  useEffect(() => {
    try {
      audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    } catch (_) {}

    const signalsUrl = process.env.NEXT_PUBLIC_SIGNALS_URL;
    const fetchSignals = async () => {
      try {
        const fetchUrl = signalsUrl ? `${signalsUrl}/api/today` : `/api/signals`;
        const res = await fetch(fetchUrl);
        const data = await res.json();
        if (data.success && data.data) {
          const signalsList = data.data;
          setSignals(signalsList);
          
          if (signalsList.length > 0) {
            const latest = signalsList.reduce((acc: any, curr: any) => {
              if (!acc) return curr;
              const currMs = curr.created_at ? new Date(curr.created_at).getTime() : 0;
              const accMs = acc.created_at ? new Date(acc.created_at).getTime() : 0;
              return currMs > accMs ? curr : acc;
            }, null);
            
            if (latest && latest.created_at) {
              const updateDate = new Date(latest.created_at);
              setLastUpdated(updateDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            } else if (latest && latest.candle_time) {
              setLastUpdated(latest.candle_time);
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching signals:", err);
      } finally {
        setLoadingSignals(false);
      }
    };

    fetchSignals();

    let socket: Socket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    if (signalsUrl) {
      try {
        socket = io(signalsUrl);
        socket.on("connect", () => {
          console.log("Connected to live signals stream");
        });

        socket.on("new_signals", (newSignals: SignalData[]) => {
          fetchBreakoutSetups();

          setSignals(prev => {
            const existingIds = new Set(prev.map(s => s.id || `${s.stock_symbol}-${s.candle_time}`));
            const toAdd = newSignals.filter(s => !existingIds.has(s.id || `${s.stock_symbol}-${s.candle_time}`));
            return [...toAdd, ...prev];
          });

          if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
          }
        });
      } catch (e) {
        console.warn("Socket init failed, falling back to polling:", e);
        pollInterval = setInterval(fetchSignals, 10000);
      }
    } else {
      pollInterval = setInterval(fetchSignals, 10000);
    }

    return () => {
      if (socket) socket.disconnect();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [soundEnabled]);

  // Combine live /api/scanner-3c matches with any live stream 3-candle breakout signals
  const specialSetups = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    breakoutMatches.forEach(item => {
      const key = `${item.symbol}-${item.candle_date}-${item.candle_time}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          id: item.symbol === "NIFTY50" ? 999999 : undefined,
          stock_symbol: item.symbol,
          stock_name: item.name,
          signal_type: item.signal_type || "3-CANDLE BUY BREAKOUT",
          direction: "UP",
          timeframe: "15m",
          open_price: item.open_price,
          high_price: item.high_price,
          low_price: item.low_price,
          close_price: item.close_price,
          candle_time: item.candle_time,
          candle_date: item.candle_date,
          confirmationTime: item.confirmationTime,
          referenceRange: item.referenceRange,
          breakoutLevels: item.breakoutLevels,
          candles: item.candles,
        });
      }
    });

    signals.forEach(s => {
      if (s.signal_type === "3-CANDLE BUY BREAKOUT") {
        const key = `${s.stock_symbol}-${s.candle_date}-${s.candle_time}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(s);
        }
      }
    });

    return list.sort((a, b) => {
      const aIsNifty = a.stock_symbol === "NIFTY50" || a.stock_symbol === "NIFTY";
      const bIsNifty = b.stock_symbol === "NIFTY50" || b.stock_symbol === "NIFTY";
      if (aIsNifty && !bIsNifty) return -1;
      if (!aIsNifty && bIsNifty) return 1;
      return (b.id || 0) - (a.id || 0);
    });
  }, [breakoutMatches, signals]);

  const filteredSpecialSetups = useMemo(() => {
    return specialSetups.filter(item => {
      const matchesSearch =
        item.stock_symbol.toLowerCase().includes(specialSearch.toLowerCase()) ||
        item.stock_name.toLowerCase().includes(specialSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (specialFilter === "NIFTY") return item.stock_symbol === "NIFTY50" || item.stock_symbol === "NIFTY";
      return true;
    });
  }, [specialSetups, specialSearch, specialFilter]);

  const handleStockClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  const ohlSignals = useMemo(() => {
    return signals.filter(sig => 
      sig.signal_type.includes("OPEN =") || 
      sig.signal_type.includes("O=H") || 
      sig.signal_type.includes("O=L")
    );
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return ohlSignals.filter(sig => {
      const matchesSearch = sig.stock_symbol.toLowerCase().includes(search.toLowerCase()) || 
                            sig.stock_name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "ALL" || sig.direction === filter;
      return matchesSearch && matchesFilter;
    });
  }, [ohlSignals, search, filter]);

  const bullishCount = ohlSignals.filter(s => s.direction === "UP").length;
  const bearishCount = ohlSignals.filter(s => s.direction === "DOWN").length;

  return (
    <main style={{ background: "#FFFFFF", minHeight: "100vh", paddingBottom: "100px", position: "relative" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "90px 2rem 0px", position: "relative", zIndex: 1 }}>
        
        
        <div style={{ marginBottom: "50px" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 44px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "12px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            Tricks
          </h1>
          <p style={{ 
            color: "#64748B", 
            fontSize: "15px", 
            maxWidth: "680px", 
            margin: "0",
            lineHeight: 1.6
          }}>
            Track overnight opening gaps, 5-Candle Mother Range breakouts, 3-Candle Bullish Breakout confirmations, and Live 15-Min Open=High & Open=Low Signals.
          </p>
        </div>

        
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>1. True Gap Scanner</h2>
          <div style={{ background: "#F1F5F9", color: "#64748B", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, border: "1px solid #E2E8F0" }}>
            9:15 AM - 9:30 AM
          </div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: "32px", marginBottom: "60px" }}>
          
          
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#45E180" }}>
                <ArrowUpRight size={22} weight="bold" />
              </div>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>Verified Gap Ups</h3>
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
                  background: "rgba(255,255,255,0.02)",
                  border: "2px dashed rgba(255,255,255,0.1)",
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

          
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF6B7A" }}>
                <ArrowDownRight size={22} weight="bold" />
              </div>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>Verified Gap Downs</h3>
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
                  background: "#F8FAFC",
                  border: "2px dashed #E2E8F0",
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

        
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>2. 5-Candle Mother Range Setup</h2>
          <div style={{ background: "#F1F5F9", color: "#64748B", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, border: "1px solid #E2E8F0" }}>
            Intraday Breakout
          </div>
        </div>

        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          marginBottom: "60px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" }}>
              <Crosshair size={22} weight="bold" />
            </div>
            <div>
              <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044", margin: "0" }}>Volatility Contraction (Mother Range)</h3>
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
                background: "#F8FAFC",
                border: "2px dashed #E2E8F0",
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

        
        {/* 15-MIN SPECIAL SETUP — NIFTY 50 & ALL COMPANIES */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>
                3. 15-Minute 3-Candle Breakout Setup (All Companies & Nifty 50)
              </h2>
              <div style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span style={{ width: "6px", height: "6px", background: "#10B981", borderRadius: "50%", display: "inline-block" }} className="pulse"></span>
                BUY BREAKOUT CONFIRMATION
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748B", background: "#F1F5F9", padding: "3px 8px", borderRadius: "6px" }}>
                {filteredSpecialSetups.length} Found
              </span>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: "flex", background: "#F1F5F9", padding: "4px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              {([
                { key: "ALL", label: `All (${specialSetups.length})` },
                { key: "NIFTY", label: "Nifty 50" },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSpecialFilter(tab.key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "7px",
                    border: "none",
                    background: specialFilter === tab.key ? "#FFFFFF" : "transparent",
                    color: specialFilter === tab.key ? "#0F2044" : "#64748B",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: specialFilter === tab.key ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ color: "#64748B", fontSize: "13px", margin: "0 0 16px 0", maxWidth: "800px", lineHeight: "1.5" }}>
            Identifies completed 3-candle breakout confirmation: <strong>Candle 1</strong> (Red reference range) &rarr; <strong>Candle 2</strong> (Green breakout above C1 High) &rarr; <strong>Candle 3</strong> (Green breakout above C2 High). Signal triggers at the <strong>start of Candle 4</strong>.
          </p>

          {/* Search Bar for Special Setups */}
          {specialSetups.length > 2 && (
            <div style={{ position: "relative", maxWidth: "360px", marginBottom: "16px" }}>
              <MagnifyingGlass size={16} color="#94A3B8" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search setup by company or symbol..."
                value={specialSearch}
                onChange={(e) => setSpecialSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  padding: "9px 14px 9px 38px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#0F2044",
                  outline: "none"
                }}
              />
            </div>
          )}
        </div>

        {filteredSpecialSetups.length === 0 ? (
          <div style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "24px",
            padding: "36px 32px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            marginBottom: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "#CBD5E1" }} />
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", marginBottom: "16px" }}>
              <Info size={22} weight="bold" />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", marginBottom: "6px" }}>
              {specialFilter === "NIFTY" ? "No Nifty 50 3-Candle Breakout Active" : "No 3-Candle Breakout Setups Active"}
            </div>
            <div style={{ fontSize: "13px", color: "#64748B", maxWidth: "460px", lineHeight: "1.5" }}>
              {specialFilter === "NIFTY"
                ? "Nifty 50 has not confirmed a 3-candle breakout sequence today yet. Live tick scanner is running."
                : "No stocks currently match the 3-candle breakout sequence (C1 Red &rarr; C2 Green Breakout &rarr; C3 Green Breakout). Scanner evaluates continuously at the start of each 15-minute candle."}
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: filteredSpecialSetups.length === 1 ? "1fr" : "repeat(auto-fill, minmax(380px, 1fr))",
            gap: "20px",
            marginBottom: "60px"
          }}>
            {filteredSpecialSetups.map((setup) => {
              const isNifty = setup.stock_symbol === "NIFTY50" || setup.stock_symbol === "NIFTY";
              const themeColor = "#10B981";
              const glowColor = "rgba(16,185,129,0.12)";

              const refRange = setup.referenceRange || { high: setup.ref_high, low: setup.ref_low };
              const breakoutLevels = setup.breakoutLevels || { c2High: setup.c2_high, c3High: setup.c3_high };

              return (
                <div
                  key={setup.id || `${setup.stock_symbol}-${setup.candle_time}`}
                  onClick={() => {
                    localStorage.setItem("preferredTimeframe", JSON.stringify({ interval: "15m", range: "5d", label: "15M" }));
                    router.push(`/stock/${setup.stock_symbol}`);
                  }}
                  style={{
                    background: "#FFFFFF",
                    border: `1.5px solid ${themeColor}`,
                    borderRadius: "20px",
                    padding: "24px",
                    boxShadow: `0 8px 24px ${glowColor}, 0 2px 10px rgba(0,0,0,0.04)`,
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "220px",
                  }}
                  className="special-setup-card"
                >
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "5px", background: themeColor }} />

                  <div>
                    {/* Header Row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: "rgba(16,185,129,0.12)",
                          color: themeColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          <BellRinging size={22} weight="bold" />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044" }}>
                              {setup.stock_name || setup.stock_symbol}
                            </span>
                            <span style={{
                              background: "#F1F5F9",
                              color: "#475569",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 800
                            }}>
                              {setup.stock_symbol}
                            </span>
                            {isNifty && (
                              <span style={{
                                background: "rgba(59,130,246,0.12)",
                                color: "#2563EB",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: 800
                              }}>
                                INDEX
                              </span>
                            )}
                          </div>
                          <span style={{
                            display: "inline-block",
                            marginTop: "4px",
                            background: "rgba(16,185,129,0.12)",
                            color: themeColor,
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            letterSpacing: "0.3px"
                          }}>
                            BUY / BULLISH BREAKOUT
                          </span>
                        </div>
                      </div>

                      {/* Trigger Price */}
                      {(setup.close_price || setup.open_price) && (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                            Trigger Price
                          </span>
                          <span style={{ fontSize: "16px", fontWeight: 900, color: "#0F2044", fontFamily: "monospace" }}>
                            ₹{Number(setup.close_price || setup.open_price).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timestamp info */}
                    <p style={{ color: "#64748B", fontSize: "12px", fontWeight: 600, margin: "0 0 14px 0" }}>
                      Signal Triggered at Start of Candle 4: <span style={{ color: "#0F2044", fontWeight: 700 }}>{setup.candle_date}</span> at <span style={{ color: "#0F2044", fontWeight: 700 }}>{setup.confirmationTime || setup.candle_time}</span>
                    </p>

                    {/* 3 Breakout Stages Visual Grid */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      background: "#F8FAFC",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      marginBottom: "12px",
                      fontSize: "11px"
                    }}>
                      <div>
                        <span style={{ color: "#DC2626", fontWeight: 800, display: "block" }}>1. Red Ref</span>
                        <div style={{ color: "#64748B", marginTop: "2px" }}>High: <strong style={{ color: "#0F2044" }}>₹{refRange?.high ? Number(refRange.high).toFixed(1) : '-'}</strong></div>
                        <div style={{ color: "#64748B" }}>SL: <strong style={{ color: "#0F2044" }}>₹{refRange?.low ? Number(refRange.low).toFixed(1) : '-'}</strong></div>
                      </div>
                      <div>
                        <span style={{ color: "#16A34A", fontWeight: 800, display: "block" }}>2. Green Breakout 1</span>
                        <div style={{ color: "#64748B", marginTop: "2px" }}>High: <strong style={{ color: "#0F2044" }}>₹{breakoutLevels?.c2High ? Number(breakoutLevels.c2High).toFixed(1) : '-'}</strong></div>
                        <div style={{ color: "#16A34A", fontWeight: 700 }}>&gt; C1 High &check;</div>
                      </div>
                      <div>
                        <span style={{ color: "#16A34A", fontWeight: 800, display: "block" }}>3. Green Breakout 2</span>
                        <div style={{ color: "#64748B", marginTop: "2px" }}>High: <strong style={{ color: "#0F2044" }}>₹{breakoutLevels?.c3High ? Number(breakoutLevels.c3High).toFixed(1) : '-'}</strong></div>
                        <div style={{ color: "#16A34A", fontWeight: 700 }}>&gt; C2 High &check;</div>
                      </div>
                    </div>
                  </div>

                  {/* CTA Footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: themeColor, display: "flex", alignItems: "center", gap: "4px" }}>
                      Open 15m Chart ➔
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <style>{`
          .special-setup-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 14px 32px rgba(15, 32, 68, 0.08);
          }
        `}</style>

        
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>4. Live 15-Min Open=High & Open=Low Signals</h2>
          <div style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", border: "1px solid rgba(59,130,246,0.2)" }}>
            <span style={{ width: "6px", height: "6px", background: "#3B82F6", borderRadius: "50%", display: "inline-block" }} className="pulse"></span>
            LIVE
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
          <div>
            <div style={{ fontSize: "13px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
              <Clock size={16} /> Last Updated: {lastUpdated || "N/A"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <div style={{ background: "rgba(69,225,128,0.15)", border: "1px solid rgba(69,225,128,0.2)", borderRadius: "16px", padding: "16px 24px", minWidth: "140px" }}>
              <div style={{ fontSize: "12px", color: "#16A34A", fontWeight: 800, marginBottom: "4px" }}>BULLISH (O=L)</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0F2044" }}>{bullishCount}</div>
            </div>
            <div style={{ background: "rgba(255,107,122,0.15)", border: "1px solid rgba(255,107,122,0.2)", borderRadius: "16px", padding: "16px 24px", minWidth: "140px" }}>
              <div style={{ fontSize: "12px", color: "#DC2626", fontWeight: 800, marginBottom: "4px" }}>BEARISH (O=H)</div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#0F2044" }}>{bearishCount}</div>
            </div>
          </div>
        </div>

        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: "1px solid #E2E8F0", padding: "16px 24px", borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: "300px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
              <MagnifyingGlass size={18} color="#94A3B8" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Search stocks..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px 16px 12px 44px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#0F2044", outline: "none" }}
              />
            </div>
            
            <div style={{ display: "flex", background: "#F1F5F9", padding: "4px", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
              {(["ALL", "UP", "DOWN"] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: filter === type ? "#FFFFFF" : "transparent",
                    color: filter === type ? "#0F2044" : "#64748B",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: filter === type ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  {type === "UP" ? "Bullish" : type === "DOWN" ? "Bearish" : "All"}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: soundEnabled ? "rgba(59,130,246,0.1)" : "#F1F5F9", color: soundEnabled ? "#3B82F6" : "#64748B", border: "1px solid " + (soundEnabled ? "rgba(59,130,246,0.2)" : "#E2E8F0"), padding: "10px 16px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", transition: "all 0.2s" }}
          >
            {soundEnabled ? <BellRinging size={18} weight="bold" /> : <BellSlash size={18} weight="bold" />}
            Sound Alerts
          </button>
        </div>

        
        <div style={{ background: "#FFFFFF", borderRadius: "20px", overflow: "hidden", border: "1px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Time", "Symbol", "Signal", "Open", "High", "Low", "Close"].map((h) => (
                    <th key={h} style={{ padding: "16px 24px", textAlign: h === "Time" || h === "Symbol" || h === "Signal" ? "left" : "right", fontSize: "12px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingSignals ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748B", fontWeight: 600 }}>Loading signals...</td>
                  </tr>
                ) : filteredSignals.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "60px 40px", textAlign: "center" }}>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044" }}>No signals match your criteria</div>
                      <div style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Try adjusting your filters or wait for the next 15m candle.</div>
                    </td>
                  </tr>
                ) : (
                  filteredSignals.map(sig => {
                    const isUp = sig.direction === "UP";
                    const rowBg = isUp ? "rgba(69,225,128,0.08)" : "rgba(255,107,122,0.08)";
                    const textColor = isUp ? "#16A34A" : "#DC2626";
                    const Icon = isUp ? CaretUp : CaretDown;

                    return (
                      <tr 
                        key={sig.id || `${sig.stock_symbol}-${sig.candle_time}`}
                        style={{ borderBottom: "1px solid #E2E8F0", background: rowBg, transition: "background 0.2s" }}
                      >
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ fontSize: "16px", fontWeight: 900, color: "#0F2044", lineHeight: 1.2 }}>{sig.candle_time}</div>
                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "4px" }}>{sig.candle_date}</div>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F2044", cursor: "pointer" }} onClick={() => router.push(`/stock/${sig.stock_symbol}`)}>{sig.stock_symbol}</div>
                          <div style={{ fontSize: "12px", color: "#94A3B8" }}>{sig.stock_name}</div>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: isUp ? "rgba(69,225,128,0.15)" : "rgba(255,107,122,0.15)", color: textColor, padding: "6px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 800 }}>
                            <Icon weight="bold" /> {sig.signal_type}
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: isUp ? 600 : 900, color: isUp ? "#64748B" : textColor, fontFamily: "monospace", fontSize: "15px" }}>
                          ₹{Number(sig.open_price).toFixed(2)}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: !isUp ? 600 : 900, color: !isUp ? "#64748B" : textColor, fontFamily: "monospace", fontSize: "15px" }}>
                          ₹{Number(sig.high_price).toFixed(2)}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 600, color: "#64748B", fontFamily: "monospace", fontSize: "15px" }}>
                          ₹{Number(sig.low_price).toFixed(2)}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 800, color: "#0F2044", fontFamily: "monospace", fontSize: "15px" }}>
                          ₹{Number(sig.close_price).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        .pulse {
          animation: pulse 2s infinite ease-in-out;
        }
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
    </main>
  );
}

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
        borderColor: hovered ? "#CBD5E1" : "#E2E8F0",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hovered ? "translateY(-2px) scale(1.01)" : "translateY(0)"
      }}
    >
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: isUp ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          color: isUp ? "#16A34A" : "#DC2626",
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

      
      <div style={{ textAlign: "right", marginLeft: "auto", marginRight: "auto" }}>
        <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "16px", fontFamily: "monospace" }}>
          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ 
          fontSize: "11px", 
          color: stock.changePercent >= 0 ? "#16A34A" : "#DC2626", 
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

      
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "120px", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ 
            fontSize: "13px", 
            fontWeight: 800, 
            color: isUp ? "#16A34A" : "#DC2626",
            background: isUp ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            padding: "4px 10px",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px"
          }}>
            {isUp ? "+" : ""}{stock.gapPercent.toFixed(2)}% Gap
          </span>
        </div>

        
        <div style={{ 
          width: "24px", 
          height: "24px", 
          borderRadius: "50%", 
          background: hovered ? (isUp ? "#16A34A" : "#DC2626") : "transparent",
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
        borderColor: hovered ? "#CBD5E1" : "#E2E8F0",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hovered ? "translateY(-2px) scale(1.01)" : "translateY(0)"
      }}
    >
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "rgba(59,130,246,0.15)",
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

      
      <div style={{ textAlign: "right", marginLeft: "auto", marginRight: "auto" }}>
        <span style={{ fontWeight: 800, color: "#0F2044", fontSize: "16px", fontFamily: "monospace" }}>
          ₹{stock.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ 
          fontSize: "11px", 
          color: isUp ? "#16A34A" : "#DC2626", 
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

      
      <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "120px", justifyContent: "flex-end" }}>
        <div style={{ textAlign: "right" }}>
          <span style={{ 
            fontSize: "12px", fontWeight: 700, color: "#0F2044", background: "#F1F5F9",
            padding: "4px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px"
          }}>
            Vol: {(stock.totalVolume / 100000).toFixed(1)}L
          </span>
          <div style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
            {stock.timeDetected}
          </div>
        </div>

        
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
