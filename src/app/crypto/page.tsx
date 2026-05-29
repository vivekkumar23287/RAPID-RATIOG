"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";


const cryptoAssets = [
  { name: "Bitcoin", symbol: "BTC-USD" },
  { name: "Ethereum", symbol: "ETH-USD" },
  { name: "Solana", symbol: "SOL-USD" },
  { name: "Ripple", symbol: "XRP-USD" },
  { name: "Dogecoin", symbol: "DOGE-USD" },
  { name: "Cardano", symbol: "ADA-USD" },
  { name: "Polkadot", symbol: "DOT-USD" },
  { name: "Chainlink", symbol: "LINK-USD" },
  { name: "Polygon", symbol: "MATIC-USD" },
  { name: "Shiba Inu", symbol: "SHIB-USD" },
  { name: "Litecoin", symbol: "LTC-USD" },
  { name: "Avalanche", symbol: "AVAX-USD" },
];

export default function CryptoPage() {
  const [livePrices, setLivePrices] = useState<Record<string, { currentPrice: number, change: number, changePercent: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const allSymbols = cryptoAssets.map(s => s.symbol);

    const fetchPrices = async () => {
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

  return (
    <main style={{ background: "#FFFFFF", minHeight: "100vh", position: "relative" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 60px", position: "relative", zIndex: 1 }}>
        <header style={{ marginBottom: "40px" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            background: "rgba(245,158,11,0.1)", 
            padding: "6px 14px", 
            borderRadius: "100px",
            marginBottom: "12px",
            border: "1px solid rgba(245,158,11,0.25)",
          }}>
            <span style={{ color: "#F59E0B", fontWeight: 800, fontSize: "14px" }}>₿</span>
            <span style={{ color: "#F59E0B", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>24/7 Live Crypto</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 900, color: "#0F2044", marginBottom: "12px", letterSpacing: "-1px" }}>
            Crypto <span style={{ background: "linear-gradient(135deg, #F59E0B, #FFC043)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Market</span>
          </h1>
          <p style={{ color: "#64748B", fontSize: "16px", maxWidth: "600px", lineHeight: "1.6" }}>
            Real-time insights and interactive charts for global cryptocurrencies.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "24px" }}>
          {cryptoAssets.map((stock) => (
            <CryptoCard key={stock.symbol} stock={stock} liveData={livePrices[stock.symbol]} isLoaded={isLoaded} />
          ))}
        </div>
      </div>
    </main>
  );
}

function CryptoCard({ stock, liveData, isLoaded }: { stock: any, liveData?: any, isLoaded: boolean }) {
  const currentPrice = liveData?.currentPrice || 0;
  const changePercent = liveData?.changePercent || 0;
  const isPositive = changePercent >= 0;
  const symbolOnly = stock.symbol.split('-')[0];
  
  return (
    <Link href={`/stock/${stock.symbol}`} style={{ textDecoration: "none" }}>
      <div 
        className="crypto-card"
        style={{
          background: "#FFFFFF",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #E2E8F0",
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "130px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: "17px", color: "#0F2044", letterSpacing: "-0.3px" }}>{stock.name}</span>
          <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 700 }}>{symbolOnly}</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px" }}>
          {currentPrice > 0 ? (
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#0F2044", letterSpacing: "-0.5px", fontFamily: "monospace" }}>
              ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : isLoaded ? (
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#94A3B8" }}>N/A</span>
          ) : (
            <span style={{ fontSize: "14px", color: "#94A3B8", fontWeight: 500 }}>Loading...</span>
          )}
          
          <span style={{ 
            fontSize: "13px", 
            fontWeight: 800, 
            color: isPositive ? "#45E180" : "#FF6B7A",
            background: isPositive ? "rgba(69,225,128,0.15)" : "rgba(255,107,122,0.15)",
            padding: "4px 10px",
            borderRadius: "8px",
            border: `1px solid ${isPositive ? "rgba(69,225,128,0.1)" : "rgba(255,107,122,0.1)"}`
          }}>
            {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      <style jsx>{`
        .crypto-card:hover {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(245,158,11,0.25) !important;
          border-color: rgba(245,158,11,0.4) !important;
          background: #F8FAFC !important;
        }
      `}</style>
    </Link>
  );
}
