"use client";

import { useRef, useState, useEffect } from "react";
import { TrendUp, ChartBar, FileXls } from "@phosphor-icons/react";

interface CardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  tag: string;
  items: { label: string; visual: string }[];
  accent?: boolean;
  index: number;
}

function ThreeDCard({ title, description, icon, tag, items, accent, index }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1000px) rotateX(0deg) rotateY(0deg)");
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -10;
    const rotY = ((x - cx) / cx) * 10;
    setTransform(`perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.04,1.04,1.04)`);
    setGlow({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)");
    setGlow({ x: 50, y: 50 });
  };

  return (
    <div
      ref={cardRef}
      className={`service-card service-card-${index}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: "transform 0.12s ease",
        background: accent
          ? "rgba(255,255,255,0.1)"
          : "rgba(255,255,255,0.06)",
        border: accent ? "1px solid rgba(124,255,239,0.3)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: "24px",
        padding: "2.25rem",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        transformStyle: "preserve-3d",
        boxShadow: accent
          ? "0 20px 60px rgba(0,0,0,0.25)"
          : "0 4px 24px rgba(0,0,0,0.12)",
        backdropFilter: "blur(16px)",
        opacity: 0, // GSAP will animate this
      }}
    >
      
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(300px at ${glow.x}% ${glow.y}%, ${accent ? "rgba(124,255,239,0.12)" : "rgba(124,255,239,0.06)"}, transparent)`,
        transition: "background 0.12s",
        borderRadius: "24px",
        pointerEvents: "none",
        zIndex: 1,
      }} />

      
      {accent && (
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: "120px", height: "120px",
          background: "radial-gradient(circle at top right, rgba(124,255,239,0.2), transparent 70%)",
          zIndex: 0,
        }} />
      )}

      
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        background: accent ? "rgba(124,255,239,0.15)" : "rgba(124,255,239,0.1)",
        color: accent ? "#7CFFEF" : "#7CFFEF",
        borderRadius: "100px", padding: "5px 14px",
        fontSize: "11px", fontFamily: "Satoshi, sans-serif",
        fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase",
        marginBottom: "1.4rem", position: "relative", zIndex: 2,
        border: accent ? "1px solid rgba(124,255,239,0.3)" : "1px solid rgba(124,255,239,0.2)",
      }}>
        {icon}
        {tag}
      </div>

      
      <h3 style={{
        fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "22px",
        color: "#FFFFFF",
        marginBottom: "0.75rem", position: "relative", zIndex: 2, lineHeight: 1.15,
      }}>
        {title}
      </h3>

      
      <p style={{
        fontFamily: "Satoshi, sans-serif", fontSize: "14px",
        color: "rgba(255,255,255,0.55)",
        lineHeight: 1.75, marginBottom: "1.75rem", position: "relative", zIndex: 2,
      }}>
        {description}
      </p>

      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", position: "relative", zIndex: 2 }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "12px", padding: "11px 16px",
              border: "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.2s ease",
              animation: `fadeInRow 0.4s ease ${0.1 + i * 0.08}s both`,
            }}
          >
            <span style={{
              fontFamily: "Satoshi, sans-serif", fontSize: "13px", fontWeight: 500,
              color: "rgba(255,255,255,0.75)",
            }}>
              {item.label}
            </span>
            <span style={{
              fontFamily: "Satoshi, sans-serif", fontSize: "13px", fontWeight: 700,
              color: "#7CFFEF",
              background: "rgba(124,255,239,0.12)",
              padding: "2px 10px", borderRadius: "100px",
            }}>
              {item.visual}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServicesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      
      gsap.fromTo(".services-label",
        { opacity: 0, y: 24, letterSpacing: "6px", filter: "blur(8px)" },
        {
          opacity: 1, y: 0, letterSpacing: "2px", filter: "blur(0px)", duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ".services-section", start: "top 80%" },
        }
      );
      gsap.fromTo(".services-h2",
        { opacity: 0, y: 40, filter: "blur(10px)" },
        {
          opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: "power4.out", delay: 0.1,
          scrollTrigger: { trigger: ".services-section", start: "top 80%" },
        }
      );

      
      gsap.fromTo(".service-card",
        { opacity: 0, y: 70, scale: 0.94, rotationX: -8, filter: "blur(6px)" },
        {
          opacity: 1, y: 0, scale: 1, rotationX: 0, filter: "blur(0px)",
          duration: 1.2, stagger: 0.18, ease: "power3.out",
          scrollTrigger: { trigger: ".services-grid", start: "top 85%" },
        }
      );
    };
    load();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ padding: "9rem 2rem", background: "transparent", position: "relative" }}
      className="services-section"
    >

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        
        <div style={{ textAlign: "center", marginBottom: "4.5rem" }}>
          <span
            className="services-label"
            style={{
              fontFamily: "Satoshi, sans-serif", fontSize: "11px", fontWeight: 700,
              color: "#7CFFEF", letterSpacing: "2px", textTransform: "uppercase",
              display: "block", marginBottom: "1rem",
            }}
          >
            What we offer
          </span>
          <h2
            className="services-h2"
            style={{
              fontFamily: "Satoshi, sans-serif", fontWeight: 800,
              fontSize: "clamp(30px, 4vw, 52px)",
              color: "#FFFFFF", letterSpacing: "-1.5px", lineHeight: 1.1,
            }}
          >
            Everything you need to
            <br />
            <span style={{ color: "#7CFFEF" }}>trade smarter</span>
          </h2>
        </div>

        
        <div
          className="services-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          <ThreeDCard
            index={0}
            tag="Live Prices"
            icon={<TrendUp size={22} color="#7CFFEF" weight="bold" />}
            title="Real-Time Stock Prices"
            description="Watch all your favourite NSE stocks and cryptocurrencies update live — prices, % change, and volume at a glance."
            items={[
              { label: "NIFTY 50", visual: "22,147 ↑ 1.24%" },
              { label: "POLYCAB", visual: "₹5,890 ↑ 2.18%" },
              { label: "BITCOIN", visual: "$64,230 ↑ 3.12%" },
            ]}
          />
          <ThreeDCard
            index={1}
            tag="Charts"
            icon={<ChartBar size={22} color="#7CFFEF" weight="bold" />}
            title="Interactive Charts"
            description="Beautiful, interactive charts for each stock — zoom in, compare timeframes, spot patterns instantly."
            items={[
              { label: "Chart view", visual: "Candlestick" },
              { label: "Timeframe", visual: "1D / 1W / 1M" },
              { label: "Indicators", visual: "RSI, MACD, MA" },
            ]}
          />
          <ThreeDCard
            index={2}
            tag="Excel"
            icon={<FileXls size={22} color="#7CFFEF" weight="bold" />}
            title="Integrated Excel Sheets"
            description="Edit your data right in the browser — your spreadsheet, synced with live prices, downloadable as .xlsx."
            items={[
              { label: "Edit in browser", visual: "✓ Supported" },
              { label: "Download format", visual: ".xlsx" },
              { label: "Auto-sync", visual: "Live data" },
            ]}
          />
        </div>
      </div>

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}