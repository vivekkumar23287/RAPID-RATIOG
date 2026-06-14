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

const getNiftySetupStatus = (candles: any[]) => {
  if (candles.length < 4) return { matched: false, type: "", text: "No Setup" };
  const [c1, c2, c3, c4] = candles;

  const isBearish = 
    (c1.close < c1.open) && 
    (c2.close > c2.open) && 
    (c2.low < c1.low) && 
    (c3.close < c3.open) && 
    (c3.high > c2.high) && 
    (c4.close < c4.open);

  const isBullish = 
    (c1.close > c1.open) && 
    (c2.close < c2.open) && 
    (c2.high > c1.high) && 
    (c3.close > c3.open) && 
    (c3.low < c2.low) && 
    (c4.close > c4.open);

  if (isBullish) return { matched: true, type: "BULLISH", text: "Bullish Setup Active" };
  if (isBearish) return { matched: true, type: "BEARISH", text: "Bearish Setup Active" };
  
  return { matched: false, type: "", text: "No Active Setup" };
};

export default function TricksInNSE() {
  const router = useRouter();
  
  
  const [loadingGaps, setLoadingGaps] = useState(true);
  const [gapUps, setGapUps] = useState<LiveStockData[]>([]);
  const [gapDowns, setGapDowns] = useState<LiveStockData[]>([]);

  const [loadingMother, setLoadingMother] = useState(true);
  const [motherMatches, setMotherMatches] = useState<any[]>([]);

  
  const [niftyCandles, setNiftyCandles] = useState<any[]>([]);
  const [loadingNiftySetup, setLoadingNiftySetup] = useState(true);

  
  const [signals, setSignals] = useState<SignalData[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UP" | "DOWN">("ALL");
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

  const fetchNiftySetupData = async () => {
    setLoadingNiftySetup(true);
    try {
      const res = await fetch("/api/stock-data?symbol=NIFTY50&interval=15m&range=2d", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.candles) {
          const candles = data.candles;
          let lastCompletedIdx = -1;
          const nowMs = Date.now();
          for (let i = candles.length - 1; i >= 0; i--) {
            const cTimeMs = candles[i].time * 1000;
            if (nowMs - cTimeMs >= 15 * 60 * 1000) {
              lastCompletedIdx = i;
              break;
            }
          }
          if (lastCompletedIdx >= 3) {
            setNiftyCandles([
              candles[lastCompletedIdx - 3],
              candles[lastCompletedIdx - 2],
              candles[lastCompletedIdx - 1],
              candles[lastCompletedIdx]
            ]);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to load Nifty 50 candles:", error);
    } finally {
      setLoadingNiftySetup(false);
    }
  };

  useEffect(() => {
    fetchGaps();
    fetchMotherRange();
    fetchNiftySetupData();
  }, []);

  useEffect(() => {
    
    audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
    
    
    fetch("http://localhost:8080/api/today")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const signalsList = data.data;
          setSignals(signalsList);
          
          if (signalsList.length > 0) {
            
            const latest = signalsList.reduce((acc: any, curr: any) => {
              if (!acc) return curr;
              return new Date(curr.created_at) > new Date(acc.created_at) ? curr : acc;
            }, null);
            
            if (latest && latest.created_at) {
              const updateDate = new Date(latest.created_at);
              setLastUpdated(updateDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            } else {
              setLastUpdated("N/A");
            }
          } else {
            setLastUpdated("N/A");
          }
        } else {
          setLastUpdated("N/A");
        }
      })
      .catch(err => {
        console.warn("Error fetching initial data:", err);
        setLastUpdated("N/A");
      })
      .finally(() => setLoadingSignals(false));

    
    const socket: Socket = io("http://localhost:8080");
    
    socket.on("connect", () => {
      console.log("Connected to live signals stream");
    });

    socket.on("new_signals", (newSignals: SignalData[]) => {
      console.log("Received new signals:", newSignals);
      
      const hasNifty = newSignals.some(s => s.stock_symbol === "NIFTY50");
      if (hasNifty) {
        fetchNiftySetupData();
      }

      setSignals(prev => {
        
        const existingIds = new Set(prev.map(s => s.id || `${s.stock_symbol}-${s.candle_time}`));
        const toAdd = newSignals.filter(s => !existingIds.has(s.id || `${s.stock_symbol}-${s.candle_time}`));
        return [...toAdd, ...prev];
      });

      if (newSignals.length > 0) {
        const latest = newSignals.reduce((acc: any, curr: any) => {
          if (!acc) return curr;
          const currMs = curr.created_at ? new Date(curr.created_at).getTime() : Date.now();
          const accMs = acc.created_at ? new Date(acc.created_at).getTime() : Date.now();
          return currMs > accMs ? curr : acc;
        }, null);

        if (latest) {
          const updateTime = latest.created_at ? new Date(latest.created_at) : new Date();
          setLastUpdated(updateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      }
      
      
      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(e => console.warn("Audio play failed:", e));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [soundEnabled]);

  const handleStockClick = (symbol: string) => {
    router.push(`/stock/${symbol}`);
  };

  const filteredSignals = useMemo(() => {
    return signals.filter(sig => {
      const matchesSearch = sig.stock_symbol.toLowerCase().includes(search.toLowerCase()) || 
                            sig.stock_name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "ALL" || sig.direction === filter;
      return matchesSearch && matchesFilter;
    });
  }, [signals, search, filter]);

  const bullishCount = signals.filter(s => s.direction === "UP").length;
  const bearishCount = signals.filter(s => s.direction === "DOWN").length;

  return (
    <main style={{ background: "#FFFFFF", minHeight: "100vh", paddingBottom: "100px", position: "relative" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 0px", position: "relative", zIndex: 1 }}>
        
        
        <div style={{ marginBottom: "50px" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 44px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "12px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            Tricks in NSE
          </h1>
          <p style={{ 
            color: "#64748B", 
            fontSize: "15px", 
            maxWidth: "680px", 
            margin: "0",
            lineHeight: 1.6
          }}>
            Track overnight opening gaps, 5-Candle Mother Range breakouts, and Live 15-Min Open=High & Open=Low Signals.
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

        
        <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#0F2044", margin: 0 }}>3. Nifty 50 15-Min Special Setup</h2>
          <div style={{ background: "rgba(16,185,129,0.15)", color: "#10B981", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span style={{ width: "6px", height: "6px", background: "#10B981", borderRadius: "50%", display: "inline-block" }} className="pulse"></span>
            ACTIVE TRACKER
          </div>
        </div>

        {(() => {
          const niftySignal = signals.find(s => s.stock_symbol === "NIFTY50");
          
          if (!niftySignal) {
            return (
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
                <div style={{ fontSize: "16px", fontWeight: 800, color: "#0F2044", marginBottom: "6px" }}>No Nifty 50 Setup Detected Today</div>
                <div style={{ fontSize: "13px", color: "#64748B", maxWidth: "420px", lineHeight: "1.5" }}>
                  The strict multi-candle sweep pattern has not been triggered on Nifty 50 today yet. We are scanning tick-by-tick.
                </div>
              </div>
            );
          }

          const isBull = niftySignal.direction === "UP";
          const themeColor = isBull ? "#10B981" : "#EF4444";
          const glowColor = isBull ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

          return (
            <div
              onClick={() => {
                localStorage.setItem("preferredTimeframe", JSON.stringify({ interval: "15m", range: "5d", label: "15M" }));
                router.push("/stock/NIFTY50");
              }}
              style={{
                background: "#FFFFFF",
                border: `1.5px solid ${themeColor}`,
                borderRadius: "24px",
                padding: "32px",
                boxShadow: `0 10px 30px ${glowColor}, 0 2px 12px rgba(0,0,0,0.04)`,
                marginBottom: "60px",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="nifty-setup-card"
            >
              
              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "6px", background: themeColor }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "14px",
                    background: isBull ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    color: themeColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <BellRinging size={28} weight="bold" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 900, color: "#0F2044" }}>Nifty 50 {isBull ? "Bullish Setup" : "Bearish Setup"}</span>
                      <span style={{
                        background: isBull ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                        color: themeColor,
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: 900,
                        letterSpacing: "0.5px"
                      }}>
                        ACTIVE TIME
                      </span>
                    </div>
                    <p style={{ color: "#475569", fontSize: "14px", fontWeight: 600, margin: 0 }}>
                      Setup Formed on: <span style={{ color: "#0F2044", fontWeight: 800 }}>{niftySignal.candle_date}</span> at <span style={{ color: "#0F2044", fontWeight: 800 }}>{niftySignal.candle_time}</span>
                    </p>
                  </div>
                </div>

                
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: themeColor }}>
                    Click to Open 15-Min Candle Chart ➔
                  </span>
                </div>
              </div>

              <style>{`
                .nifty-setup-card:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 16px 36px ${glowColor}, 0 4px 16px rgba(0,0,0,0.06);
                }
              `}</style>
            </div>
          );
        })()}

        
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
