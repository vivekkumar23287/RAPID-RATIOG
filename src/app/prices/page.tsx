"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { NIFTY_50_STOCKS as nifty50Stocks } from "@/lib/stocks";
import {
  TrendUp,
  TrendDown,
  MagnifyingGlass,
  ArrowUpRight,
  Funnel,
  CaretLeft,
  CaretRight,
  SquaresFour,
  Rows,
} from "@phosphor-icons/react";

export default function PricesPage() {
  const [livePrices, setLivePrices] = useState<Record<string, { currentPrice: number; change: number; changePercent: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("All");
  const [isWrapMode, setIsWrapMode] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  useEffect(() => {
    const allSymbols = nifty50Stocks.map((s) => s.symbol);

    const fetchPrices = async () => {
      if (document.hidden) return;
      try {
        const encodedSymbols = encodeURIComponent(allSymbols.join(","));
        const response = await fetch(`/api/batch-prices?symbols=${encodedSymbols}`);
        if (response.ok) {
          const data = await response.json();
          setLivePrices(data);
          setIsLoaded(true);
        }
      } catch (error) {
        console.warn("Error fetching live prices:", error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  // Extract unique sectors
  const sectors = useMemo(() => {
    const set = new Set<string>();
    nifty50Stocks.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return ["All", ...Array.from(set).sort()];
  }, []);

  // Filter stocks based on search query and sector filter
  const filteredStocks = useMemo(() => {
    return nifty50Stocks.filter((stock) => {
      const matchesSearch =
        stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSector = selectedSector === "All" || stock.sector === selectedSector;
      return matchesSearch && matchesSector;
    });
  }, [searchQuery, selectedSector]);

  // Check scroll position to show/hide scroll arrows
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 10);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [sectors, isWrapMode]);

  const scrollByAmount = (amount: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const handleSectorClick = (sec: string, e: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedSector(sec);
    if (!isWrapMode && e.currentTarget) {
      e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  // Mouse wheel scroll handler with passive: false to trap scroll inside filter section
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheelNonPassive = (e: WheelEvent) => {
      if (isWrapMode) return;
      // Prevent browser from scrolling the main page
      e.preventDefault();
      e.stopPropagation();
      // Scroll filter container horizontally
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener("wheel", handleWheelNonPassive, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheelNonPassive);
    };
  }, [isWrapMode]);

  return (
    <main style={{ background: "#F8FAFC", minHeight: "100vh", position: "relative" }}>
      <Navbar />

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "110px 2rem 80px", position: "relative", zIndex: 1 }}>
        {/* Header & Controls Toolbar */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "100px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    color: "#059669",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#10B981",
                      boxShadow: "0 0 8px #10B981",
                    }}
                  />
                  Live Updates Active
                </span>
                <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 600 }}>
                  Showing {filteredStocks.length} of {nifty50Stocks.length} Companies
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div
              style={{
                position: "relative",
                minWidth: "280px",
                maxWidth: "400px",
                width: "100%",
              }}
            >
              <MagnifyingGlass
                size={18}
                weight="bold"
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94A3B8",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search by company or ticker (e.g., Reliance, BEL)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 16px 11px 42px",
                  borderRadius: "14px",
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#0F2044",
                  outline: "none",
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.03)",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3B82F6";
                  e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E2E8F0";
                  e.target.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.03)";
                }}
              />
            </div>
          </div>

          {/* Sector Category Filter Bar with Smooth Scroll & Layout Toggle */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#475569", fontSize: "13px", fontWeight: 700 }}>
                <Funnel size={15} weight="bold" style={{ color: "#3B82F6" }} />
                <span>Sectors:</span>
                {selectedSector !== "All" && (
                  <button
                    onClick={() => setSelectedSector("All")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#3B82F6",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "0 0 0 6px",
                      textDecoration: "underline",
                    }}
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* View Toggle: Wrap vs Single Row Scroll */}
              <button
                onClick={() => setIsWrapMode(!isWrapMode)}
                title={isWrapMode ? "Switch to Scroll Row View" : "Show All Sectors (Grid View)"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: isWrapMode ? "#0F2044" : "#FFFFFF",
                  color: isWrapMode ? "#FFFFFF" : "#475569",
                  border: "1px solid #E2E8F0",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {isWrapMode ? (
                  <>
                    <Rows size={14} weight="bold" />
                    <span>Row View</span>
                  </>
                ) : (
                  <>
                    <SquaresFour size={14} weight="bold" />
                    <span>Show All ({sectors.length})</span>
                  </>
                )}
              </button>
            </div>

            {/* Scrollable / Wrappable Container */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              {/* Left Scroll Button */}
              {!isWrapMode && showLeftArrow && (
                <button
                  onClick={() => scrollByAmount(-260)}
                  aria-label="Scroll left"
                  style={{
                    position: "absolute",
                    left: 0,
                    zIndex: 10,
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    color: "#0F2044",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.borderColor = "#3B82F6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                  }}
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
              )}

              {/* Pills Box */}
              <div
                ref={scrollContainerRef}
                className="sectors-scroll-container"
                style={{
                  display: "flex",
                  flexWrap: isWrapMode ? "wrap" : "nowrap",
                  alignItems: "center",
                  gap: "8px",
                  overflowX: isWrapMode ? "visible" : "auto",
                  overscrollBehaviorX: "contain",
                  padding: "4px 2px 12px",
                  scrollBehavior: "smooth",
                  width: "100%",
                }}
              >
                {sectors.map((sec) => {
                  const isActive = selectedSector === sec;
                  const count =
                    sec === "All"
                      ? nifty50Stocks.length
                      : nifty50Stocks.filter((s) => s.sector === sec).length;

                  return (
                    <button
                      key={sec}
                      onClick={(e) => handleSectorClick(sec, e)}
                      style={{
                        padding: "7px 16px",
                        borderRadius: "12px",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        border: isActive ? "1px solid #0F2044" : "1px solid #E2E8F0",
                        background: isActive ? "#0F2044" : "#FFFFFF",
                        color: isActive ? "#FFFFFF" : "#475569",
                        boxShadow: isActive ? "0 4px 14px rgba(15, 32, 68, 0.18)" : "0 1px 3px rgba(15, 23, 42, 0.03)",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = "#CBD5E1";
                          e.currentTarget.style.color = "#0F2044";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.borderColor = "#E2E8F0";
                          e.currentTarget.style.color = "#475569";
                          e.currentTarget.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      <span>{sec}</span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "100px",
                          background: isActive ? "rgba(255, 255, 255, 0.2)" : "#F1F5F9",
                          color: isActive ? "#FFFFFF" : "#64748B",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Scroll Button */}
              {!isWrapMode && showRightArrow && (
                <button
                  onClick={() => scrollByAmount(260)}
                  aria-label="Scroll right"
                  style={{
                    position: "absolute",
                    right: 0,
                    zIndex: 10,
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    color: "#0F2044",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.1)";
                    e.currentTarget.style.borderColor = "#3B82F6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                  }}
                >
                  <CaretRight size={16} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stock Cards Grid */}
        <section>
          {filteredStocks.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              {filteredStocks.map((stock) => (
                <StockCard key={stock.symbol} stock={stock} liveData={livePrices[stock.symbol]} isLoaded={isLoaded} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "80px 20px",
                background: "#FFFFFF",
                borderRadius: "24px",
                border: "1px dashed #CBD5E1",
              }}
            >
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#475569", margin: "0 0 6px" }}>No matching companies found</p>
              <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>
                Try searching for another keyword or reset the sector filter.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Styled Smooth Scrollbar CSS */}
      <style jsx global>{`
        .sectors-scroll-container::-webkit-scrollbar {
          height: 6px;
        }
        .sectors-scroll-container::-webkit-scrollbar-track {
          background: #F1F5F9;
          border-radius: 10px;
        }
        .sectors-scroll-container::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
        }
        .sectors-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </main>
  );
}

function StockCard({ stock, liveData, isLoaded }: { stock: any; liveData?: any; isLoaded: boolean }) {
  const currentPrice = liveData?.currentPrice || 0;
  const change = liveData?.change || 0;
  const changePercent = liveData?.changePercent || 0;

  const isPositive = change >= 0;
  const currencySymbol = "₹";

  return (
    <Link href={`/stock/${stock.symbol}`} style={{ textDecoration: "none" }}>
      <div
        className="stock-card"
        style={{
          background: "#FFFFFF",
          padding: "20px 22px",
          borderRadius: "20px",
          border: "1px solid #E2E8F0",
          transition: "all 0.25s ease-in-out",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: "148px",
          boxShadow: "0 4px 18px rgba(15, 23, 42, 0.03)",
          position: "relative",
        }}
      >
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <span
              style={{
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                fontWeight: 800,
                fontSize: "15px",
                color: "#0F172A",
                lineHeight: "1.35",
                letterSpacing: "-0.2px",
                wordBreak: "break-word",
              }}
            >
              {stock.name}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                color: "#94A3B8",
                textTransform: "uppercase",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {stock.symbol}
            </span>
          </div>
          {/* Sector Tag inside the Box */}
          {stock.sector && (
            <div style={{ marginTop: "6px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#64748B",
                  background: "#F1F5F9",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  display: "inline-block",
                  letterSpacing: "0.2px",
                }}
              >
                {stock.sector}
              </span>
            </div>
          )}
        </div>

        {/* Bottom Section: Price + Clean Trend Badge matching the photo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px" }}>
          {/* Live Price */}
          <div>
            {currentPrice > 0 ? (
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.5px",
                  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                  lineHeight: 1,
                }}
              >
                {currencySymbol}
                {currentPrice.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            ) : isLoaded ? (
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#94A3B8" }}>N/A</span>
            ) : (
              <span style={{ fontSize: "13px", color: "#94A3B8", fontWeight: 500 }}>Loading...</span>
            )}
          </div>

          {/* Percentage Change Badge */}
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: isPositive ? "#166534" : "#991B1B",
              background: isPositive ? "#DCFCE7" : "#FEE2E2",
              padding: "5px 12px",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              lineHeight: 1,
            }}
          >
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <style jsx>{`
        .stock-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px -6px rgba(15, 23, 42, 0.08), 0 0 0 1px ${isPositive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"} !important;
          border-color: ${isPositive ? "#86EFAC" : "#FCA5A5"} !important;
        }
      `}</style>
    </Link>
  );
}
