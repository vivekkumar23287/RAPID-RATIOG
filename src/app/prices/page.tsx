"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";

const premiumStocks = [
  { name: "Nifty 50", symbol: "NIFTY50", isIndex: true, change: 1.2 },
  { name: "India VIX", symbol: "INDIAVIX", isIndex: true, change: -2.4 },
  { name: "Polycab India", symbol: "POLYCAB", change: 2.5 },
  { name: "Vodafone Idea", symbol: "IDEA", change: -0.8 },
  { name: "Indian Energy Exchange", symbol: "IEX", change: -1.5 },
  { name: "Deepak Nitrite", symbol: "DEEPAKNTR", change: 0.5 },
];

const nifty50Stocks = [
  { name: "Reliance Industries", symbol: "RELIANCE", change: 0.45 },
  { name: "TCS", symbol: "TCS", change: -0.22 },
  { name: "HDFC Bank", symbol: "HDFCBANK", change: 1.1 },
  { name: "ICICI Bank", symbol: "ICICIBANK", change: 0.8 },
  { name: "Infosys", symbol: "INFY", change: -1.4 },
  { name: "Hindustan Unilever", symbol: "HINDUNILVR", change: 0.1 },
  { name: "ITC", symbol: "ITC", change: 0.5 },
  { name: "SBI", symbol: "SBIN", change: 1.2 },
  { name: "Bharti Airtel", symbol: "BHARTIARTL", change: 2.1 },
  { name: "Bajaj Finance", symbol: "BAJFINANCE", change: -0.5 },
  { name: "Adani Enterprises", symbol: "ADANIENT", change: 3.2 },
  { name: "Kotak Mahindra Bank", symbol: "KOTAKBANK", change: -0.3 },
  { name: "Larsen & Toubro", symbol: "LT", change: 1.5 },
  { name: "Axis Bank", symbol: "AXISBANK", change: 0.7 },
  { name: "Sun Pharma", symbol: "SUNPHARMA", change: 0.2 },
  { name: "Titan Company", symbol: "TITAN", change: -0.8 },
  { name: "Bajaj Finserv", symbol: "BAJAJFINSV", change: -0.4 },
  { name: "Maruti Suzuki", symbol: "MARUTI", change: 0.9 },
  { name: "UltraTech Cement", symbol: "ULTRACEMCO", change: 0.3 },
  { name: "Tata Steel", symbol: "TATASTEEL", change: 1.8 },
  { name: "NTPC", symbol: "NTPC", change: 2.4 },
  { name: "HCL Technologies", symbol: "HCLTECH", change: -1.1 },
  { name: "Tata Motors CV", symbol: "TMCV", change: 2.7 },
  { name: "JSW Steel", symbol: "JSWSTEEL", change: 1.2 },
  { name: "Asian Paints", symbol: "ASIANPAINT", change: -0.5 },
  { name: "Mahindra & Mahindra", symbol: "M&M", change: 1.6 },
  { name: "Power Grid", symbol: "POWERGRID", change: 0.8 },
  { name: "ONGC", symbol: "ONGC", change: 1.4 },
  { name: "Adani Ports", symbol: "ADANIPORTS", change: 2.5 },
  { name: "Wipro", symbol: "WIPRO", change: -0.9 },
  { name: "Coal India", symbol: "COALINDIA", change: 1.7 },
  { name: "Tech Mahindra", symbol: "TECHM", change: -1.2 },
  { name: "IndusInd Bank", symbol: "INDUSINDBK", change: 0.5 },
  { name: "Nestle India", symbol: "NESTLEIND", change: -0.1 },
  { name: "Zomato", symbol: "ETERNAL", change: -1.5 },
  { name: "Hindalco", symbol: "HINDALCO", change: 2.1 },
  { name: "Britannia", symbol: "BRITANNIA", change: 0.4 },
  { name: "Grasim Industries", symbol: "GRASIM", change: 0.6 },
  { name: "Dr Reddy's", symbol: "DRREDDY", change: 0.2 },
  { name: "Apollo Hospitals", symbol: "APOLLOHOSP", change: -0.4 },
  { name: "Eicher Motors", symbol: "EICHERMOT", change: 1.1 },
  { name: "SBI Life Insurance", symbol: "SBILIFE", change: 0.3 },
  { name: "BPCL", symbol: "BPCL", change: 1.4 },
  { name: "Cipla", symbol: "CIPLA", change: 0.5 },
  { name: "Bajaj Auto", symbol: "BAJAJ-AUTO", change: 1.2 },
  { name: "Divi's Lab", symbol: "DIVISLAB", change: -0.3 },
  { name: "Hero MotoCorp", symbol: "HEROMOTOCO", change: 0.7 },
  { name: "UPL", symbol: "UPL", change: -1.1 },
  { name: "Gland Pharma", symbol: "GLAND", change: -2.5 },
  { name: "TATA Consumer", symbol: "TATACONSUM", change: 0.6 },
];

export default function PricesPage() {
  const [livePrices, setLivePrices] = useState<Record<string, { currentPrice: number, change: number, changePercent: number }>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    
    const allSymbols = [
      ...premiumStocks.map(s => s.symbol),
      ...nifty50Stocks.map(s => s.symbol)
    ];

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
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 900, color: "#0F2044", marginBottom: "12px", letterSpacing: "-1px" }}>
            NSE <span style={{ background: "linear-gradient(135deg, #E01F2E, #FF6B7A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Market</span>
          </h1>
          <p style={{ color: "#64748B", fontSize: "16px", maxWidth: "600px", lineHeight: "1.6" }}>
            Real-time insights and interactive charts for Nifty 50 and premium stocks.
          </p>
        </header>

        
        <section style={{ marginBottom: "60px" }}>
          <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#0F2044", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Premium Watchlist
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "24px" }}>
            {premiumStocks.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} liveData={livePrices[stock.symbol]} isLoaded={isLoaded} />
            ))}
          </div>
        </section>

        
        <section>
          <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#0F2044", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Nifty 50 Companies
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px" }}>
            {nifty50Stocks.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} liveData={livePrices[stock.symbol]} isLoaded={isLoaded} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StockCard({ stock, liveData, isLoaded }: { stock: any, liveData?: any, isLoaded: boolean }) {
  
  const currentPrice = liveData?.currentPrice || 0;
  const change = liveData?.change || stock.change;
  const changePercent = liveData?.changePercent || 0;
  
  const isPositive = change >= 0;
  const isCrypto = stock.symbol.includes("-USD");
  const currencySymbol = isCrypto ? "$" : "₹";
  
  return (
    <Link href={`/stock/${stock.symbol}`} style={{ textDecoration: "none" }}>
      <div 
        className="stock-card"
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
          <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 700 }}>{stock.symbol}</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "20px" }}>
          {currentPrice > 0 ? (
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#0F2044", letterSpacing: "-0.5px", fontFamily: "monospace" }}>
              {currencySymbol}{currentPrice.toLocaleString(isCrypto ? "en-US" : "en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        .stock-card:hover {
          transform: translateY(-5px) scale(1.02);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px ${isPositive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"} !important;
          border-color: ${isPositive ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"} !important;
          background: #F8FAFC !important;
        }
      `}</style>
    </Link>
  );
}
