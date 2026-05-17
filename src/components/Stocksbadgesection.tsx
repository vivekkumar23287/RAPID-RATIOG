"use client";

import { useRef, useEffect } from "react";
import { TrendUp, TrendDown } from "@phosphor-icons/react";

const STOCKS = [
  {
    name: "Nifty 50",
    ticker: "NIFTY",
    price: "22,147.25",
    change: "+1.24%",
    up: true,
    color: "#3B82F6",
    desc: "Benchmark index",
    sparkline: [60, 52, 55, 40, 44, 30, 28, 22, 18, 12],
  },
  {
    name: "Polycab India",
    ticker: "POLYCAB",
    price: "₹5,890.40",
    change: "+2.18%",
    up: true,
    color: "#8B5CF6",
    desc: "Wires & cables",
    sparkline: [70, 60, 58, 50, 42, 38, 30, 22, 15, 8],
  },
  {
    name: "iForge Limited",
    ticker: "IFORGE",
    price: "₹890.70",
    change: "+1.56%",
    up: true,
    color: "#F59E0B",
    desc: "Forging industry",
    sparkline: [65, 60, 50, 55, 42, 38, 35, 25, 18, 10],
  },
  {
    name: "Indian Energy Exchange",
    ticker: "IEX",
    price: "₹178.30",
    change: "+3.45%",
    up: true,
    color: "#10B981",
    desc: "Power exchange",
    sparkline: [72, 65, 60, 48, 40, 32, 28, 20, 14, 6],
  },
  {
    name: "Deepak Nitrite",
    ticker: "DEEPAKNI",
    price: "₹2,340.10",
    change: "+0.87%",
    up: true,
    color: "#EF4444",
    desc: "Specialty chemicals",
    sparkline: [68, 62, 58, 50, 44, 36, 30, 24, 16, 8],
  },
  {
    name: "Cochin Shipyard",
    ticker: "COCHINSHIP",
    price: "₹1,920.55",
    change: "+4.12%",
    up: true,
    color: "#0F766E",
    desc: "Ship building",
    sparkline: [75, 66, 58, 50, 42, 35, 28, 20, 13, 5],
  },
  {
    name: "Bitcoin",
    ticker: "BTC",
    price: "$64,230.00",
    change: "+2.45%",
    up: true,
    color: "#F7931A",
    desc: "Digital Gold",
    sparkline: [40, 45, 42, 50, 55, 60, 58, 65, 70, 75],
  },
  {
    name: "Ethereum",
    ticker: "ETH",
    price: "$3,450.20",
    change: "+1.80%",
    up: true,
    color: "#627EEA",
    desc: "Smart Contracts",
    sparkline: [30, 35, 40, 38, 45, 50, 48, 55, 60, 65],
  },
  {
    name: "Solana",
    ticker: "SOL",
    price: "$145.50",
    change: "+4.12%",
    up: true,
    color: "#14F195",
    desc: "High-performance L1",
    sparkline: [20, 25, 30, 45, 40, 55, 60, 75, 70, 85],
  },
  {
    name: "Dogecoin",
    ticker: "DOGE",
    price: "$0.1540",
    change: "-1.20%",
    up: false,
    color: "#C2A633",
    desc: "The people's coin",
    sparkline: [50, 48, 52, 45, 40, 42, 38, 35, 30, 28],
  },
];

const FONT = "Satoshi, sans-serif";

function StockBadge({
  stock,
  index,
}: {
  stock: (typeof STOCKS)[0];
  index: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    // Start rotated — back face showing
    inner.style.transform = "rotateY(-180deg)";
    inner.style.opacity = "0";

    let triggered = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          observer.disconnect();

          setTimeout(() => {
            inner.style.transition =
              "transform 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.15s ease";
            inner.style.opacity = "1";
            inner.style.transform = "rotateY(0deg)";
          }, index * 120);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [index]);

  const pts = stock.sparkline
    .map((y, x) => `${x * (100 / 9)},${y}`)
    .join(" ");

  return (
    <div
      ref={wrapperRef}
      style={{
        perspective: "800px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        ref={innerRef}
        style={{
          background: "#FFFFFF",
          border: "0.5px solid #E2E8F0",
          borderRadius: "14px",
          padding: "1rem 1.1rem",
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          transformStyle: "preserve-3d",
          willChange: "transform",
          opacity: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#CBD5E1";
          e.currentTarget.style.background = "#F8FAFC";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#E2E8F0";
          e.currentTarget.style.background = "#FFFFFF";
        }}
      >
        {/* Ticker + change badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.5px",
              padding: "3px 8px",
              borderRadius: "6px",
              background: `${stock.color}18`,
              color: stock.color,
            }}
          >
            {stock.ticker}
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 500,
              color: stock.up ? "#16A34A" : "#DC2626",
              background: stock.up ? "#DCFCE7" : "#FEE2E2",
              padding: "3px 8px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            {stock.up ? (
              <TrendUp size={13} weight="bold" />
            ) : (
              <TrendDown size={13} weight="bold" />
            )}
            {stock.change}
          </span>
        </div>

        {/* Name */}
        <p
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: "13px",
            color: "#0F2044",
            margin: "0 0 2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {stock.name}
        </p>

        {/* Desc */}
        <p
          style={{
            fontFamily: FONT,
            fontSize: "12px",
            color: "#94A3B8",
            margin: "0 0 12px",
          }}
        >
          {stock.desc}
        </p>

        {/* Price */}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: "20px",
            color: "#0F2044",
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          {stock.price}
        </div>

        {/* Sparkline */}
        <div style={{ marginTop: "12px" }}>
          <svg
            viewBox="0 0 100 80"
            width="100%"
            height="36"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id={`grad-${stock.ticker}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={stock.color} stopOpacity="0.15" />
                <stop
                  offset="100%"
                  stopColor={stock.color}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            <polygon
              points={`${pts} 100,80 0,80`}
              fill={`url(#grad-${stock.ticker})`}
            />
            <polyline
              points={pts}
              fill="none"
              stroke={stock.color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function StocksBadgeSection() {
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      gsap.fromTo(
        ".stocks-eyebrow",
        { opacity: 0, x: -20, filter: "blur(6px)" },
        {
          opacity: 1,
          x: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: ".stocks-section", start: "top 82%" },
        }
      );
      gsap.fromTo(
        ".stocks-h2",
        { opacity: 0, y: 36, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1.1,
          ease: "power4.out",
          delay: 0.08,
          scrollTrigger: { trigger: ".stocks-section", start: "top 82%" },
        }
      );
      gsap.fromTo(
        ".stocks-sub",
        { opacity: 0, y: 20, filter: "blur(4px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.8,
          ease: "power3.out",
          delay: 0.2,
          scrollTrigger: { trigger: ".stocks-section", start: "top 82%" },
        }
      );
    };
    load();
  }, []);

  return (
    <section
      className="stocks-section"
      style={{
        padding: "9rem 2rem",
        background: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(14,32,68,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,32,68,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          zIndex: 0,
        }}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div ref={headerRef} style={{ marginBottom: "3.5rem" }}>
          <span
            className="stocks-eyebrow"
            style={{
              fontFamily: FONT,
              fontSize: "11px",
              fontWeight: 700,
              color: "#E01F2E",
              letterSpacing: "2.5px",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "1rem",
            }}
          >
            Stocks we track
          </span>
          <h2
            className="stocks-h2"
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: "clamp(28px, 4vw, 50px)",
              color: "#0F2044",
              letterSpacing: "-1.5px",
              lineHeight: 1.05,
              maxWidth: "580px",
              marginBottom: "1rem",
            }}
          >
            Your portfolio,{" "}
            <span style={{ color: "#E01F2E" }}>all in one view</span>
          </h2>
          <p
            className="stocks-sub"
            style={{
              fontFamily: FONT,
              fontSize: "16px",
              fontWeight: 400,
              color: "#64748B",
              maxWidth: "480px",
              lineHeight: 1.75,
            }}
          >
            We currently track carefully selected NSE-listed stocks and cryptocurrencies — with
            more being added based on your demand.
          </p>
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {STOCKS.map((stock, i) => (
            <StockBadge key={stock.ticker} stock={stock} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}