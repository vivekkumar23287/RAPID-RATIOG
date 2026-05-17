"use client";

import React, { useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Lightbulb, ChartLineUp, Target, ShieldCheck, Lightning, TrendUp, MagnifyingGlass, CurrencyInr } from "@phosphor-icons/react";

const tricks = [
  {
    title: "The 9:15 AM Opening Gap",
    description: "Understand how the pre-market session influences the first 15 minutes of trading. Learn to identify high-probability gap-fill trades.",
    icon: <Lightning size={32} weight="duotone" />,
    color: "#FFD700"
  },
  {
    title: "Volume Profile Strategy",
    description: "Use volume as a leading indicator to find 'Point of Control' (POC) where institutional buyers are hiding their orders.",
    icon: <ChartLineUp size={32} weight="duotone" />,
    color: "#E01F2E"
  },
  {
    title: "Option Chain Analysis",
    description: "Decoding Open Interest (OI) to predict support and resistance levels. Identifying 'Max Pain' for expiry day trading.",
    icon: <Target size={32} weight="duotone" />,
    color: "#3B82F6"
  },
  {
    title: "VWAP Reversion",
    description: "Master the Volume Weighted Average Price (VWAP) to identify when a stock is overextended and likely to revert to the mean.",
    icon: <TrendUp size={32} weight="duotone" />,
    color: "#10B981"
  },
  {
    title: "Sector Rotation Intel",
    description: "Identify which sectors are leading the market rally. Shift capital from lagging sectors to leading ones for maximum ROI.",
    icon: <MagnifyingGlass size={32} weight="duotone" />,
    color: "#8B5CF6"
  },
  {
    title: "Risk Management Blueprint",
    description: "The ultimate 1% rule and position sizing tricks to ensure you stay in the game even during volatile market swings.",
    icon: <ShieldCheck size={32} weight="duotone" />,
    color: "#F59E0B"
  }
];

export default function TricksInNSE() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadGSAP = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (containerRef.current) {
        gsap.fromTo(".trick-card", 
          { y: 50, opacity: 0 },
          { 
            y: 0, 
            opacity: 1, 
            duration: 0.8, 
            stagger: 0.2, 
            ease: "power3.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "top 80%",
            }
          }
        );

        gsap.fromTo(".header-animate",
          { y: -30, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power4.out", stagger: 0.2 }
        );
      }
    };
    loadGSAP();
  }, []);

  return (
    <div style={{ background: "#F8F9FC", minHeight: "100vh" }}>
      <Navbar />
      
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 80px" }}>
        <div style={{ textAlign: "center", marginBottom: "80px" }}>
          <div className="header-animate" style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            background: "rgba(224,31,46,0.08)", 
            padding: "8px 16px", 
            borderRadius: "100px",
            color: "#E01F2E",
            fontWeight: 700,
            fontSize: "14px",
            marginBottom: "24px",
            textTransform: "uppercase",
            letterSpacing: "1px"
          }}>
            <Lightbulb weight="fill" /> Exclusive NSE Insights
          </div>
          <h1 className="header-animate" style={{ 
            fontSize: "clamp(32px, 5vw, 56px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "24px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            Master the Market with <br />
            <span style={{ 
              background: "linear-gradient(135deg, #E01F2E 0%, #B8161F 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}>Tricks in NSE</span>
          </h1>
          <p className="header-animate" style={{ 
            color: "#64748B", 
            fontSize: "20px", 
            maxWidth: "700px", 
            margin: "0 auto",
            lineHeight: 1.6
          }}>
            Unlock institutional-grade strategies and secret indicators used by top traders to navigate the Indian stock market.
          </p>
        </div>

        <div ref={containerRef} style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", 
          gap: "32px" 
        }}>
          {tricks.map((trick, index) => (
            <div 
              key={index} 
              className="trick-card"
              style={{
                background: "white",
                padding: "40px",
                borderRadius: "24px",
                boxShadow: "0 10px 40px rgba(15,32,68,0.05)",
                border: "1px solid rgba(226,232,240,0.5)",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{ 
                width: "64px", 
                height: "64px", 
                borderRadius: "16px", 
                background: `${trick.color}15`, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: trick.color,
                marginBottom: "24px"
              }}>
                {trick.icon}
              </div>
              <h3 style={{ 
                fontSize: "22px", 
                fontWeight: 800, 
                color: "#0F2044", 
                marginBottom: "16px" 
              }}>{trick.title}</h3>
              <p style={{ 
                color: "#64748B", 
                fontSize: "16px", 
                lineHeight: 1.6,
                marginBottom: "0"
              }}>{trick.description}</p>
              
              <div className="hover-accent" style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: "4px",
                background: trick.color,
                transform: "scaleX(0)",
                transformOrigin: "left",
                transition: "transform 0.4s ease"
              }} />
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <section style={{ 
          marginTop: "100px", 
          background: "linear-gradient(135deg, #0F2044 0%, #1E293B 100%)",
          borderRadius: "32px",
          padding: "80px 40px",
          textAlign: "center",
          color: "white",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "20px" }}>Ready to Trade Smarter?</h2>
            <p style={{ fontSize: "18px", color: "#94A3B8", marginBottom: "40px", maxWidth: "600px", margin: "0 auto 40px" }}>
              Join 10,000+ traders using RapidRatioG to find high-probability setups in real-time.
            </p>
            <button style={{
              background: "white",
              color: "#E01F2E",
              padding: "16px 40px",
              borderRadius: "12px",
              fontSize: "16px",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 15px 40px rgba(0,0,0,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)"; }}
            >
              Get Started for Free
            </button>
          </div>
          {/* Decorative elements */}
          <div style={{ 
            position: "absolute", 
            top: "-50px", 
            right: "-50px", 
            width: "200px", 
            height: "200px", 
            background: "rgba(224,31,46,0.1)", 
            borderRadius: "50%", 
            filter: "blur(60px)" 
          }} />
          <div style={{ 
            position: "absolute", 
            bottom: "-50px", 
            left: "-50px", 
            width: "200px", 
            height: "200px", 
            background: "rgba(59,130,246,0.1)", 
            borderRadius: "50%", 
            filter: "blur(60px)" 
          }} />
        </section>
      </main>

      <Footer />

      <style jsx>{`
        .trick-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(15,32,68,0.12);
          border-color: rgba(224,31,46,0.2);
        }
        .trick-card:hover .hover-accent {
          transform: scaleX(1);
        }
      `}</style>
    </div>
  );
}
