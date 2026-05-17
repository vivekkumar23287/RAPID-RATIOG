"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
        console.error("Error fetching live prices:", error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: "#F8F9FC", minHeight: "100vh" }}>
      <Navbar />
      
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 2rem 60px" }}>
        <header style={{ marginBottom: "40px" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            background: "rgba(245,158,11,0.1)", 
            padding: "4px 12px", 
            borderRadius: "100px",
            marginBottom: "12px",
            border: "1px solid rgba(245,158,11,0.2)"
          }}>
            <span style={{ color: "#F59E0B", fontWeight: 800, fontSize: "14px" }}>₿</span>
            <span style={{ color: "#F59E0B", fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>24/7 Live Crypto</span>
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#0F2044", marginBottom: "10px" }}>
            Crypto <span style={{ color: "#F59E0B" }}>Market</span>
          </h1>
          <p style={{ color: "#64748B", fontSize: "16px" }}>
            Real-time insights and interactive charts for global cryptocurrencies.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
          {cryptoAssets.map((stock) => (
            <CryptoCard key={stock.symbol} stock={stock} liveData={livePrices[stock.symbol]} isLoaded={isLoaded} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
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
          background: "white",
          padding: "24px",
          borderRadius: "16px",
          border: "2px solid transparent",
          transition: "all 0.3s ease",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "120px",
          boxShadow: "0 4px 12px rgba(15,32,68,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "16px", color: "#0F2044" }}>{stock.name}</span>
          <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 600 }}>{symbolOnly}</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "16px" }}>
          {currentPrice > 0 ? (
            <span style={{ fontSize: "20px", fontWeight: 800, color: "#0F2044" }}>
              ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : isLoaded ? (
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#94A3B8" }}>N/A</span>
          ) : (
            <span style={{ fontSize: "14px", color: "#94A3B8" }}>Loading...</span>
          )}
          
          <span style={{ 
            fontSize: "13px", 
            fontWeight: 700, 
            color: isPositive ? "#22C55E" : "#EF4444",
            background: isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            padding: "4px 8px",
            borderRadius: "6px"
          }}>
            {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      <style jsx>{`
        .crypto-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(15,32,68,0.08);
          border-color: #F59E0B !important;
        }
      `}</style>
    </Link>
  );
}
