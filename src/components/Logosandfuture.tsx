"use client";

import { useRef, useState, useEffect } from "react";
import { Sparkle, ArrowRight, Rocket, ChartLine, FileCsv } from "@phosphor-icons/react";

const LOGOS = [
  { name: "NSE", full: "National Stock Exchange", color: "#7CFFEF" },
  { name: "BTC", full: "Bitcoin", color: "#F7931A" },
  { name: "ETH", full: "Ethereum", color: "#627EEA" },
  { name: "SOL", full: "Solana", color: "#14F195" },
  { name: "DOGE", full: "Dogecoin", color: "#C2A633" },
  { name: "XRP", full: "Ripple", color: "#23292F" },
];

function BacklightLogo({ logo, index }: { logo: typeof LOGOS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<number | null>(null);
  const pulseRef = useRef<number | null>(null);
  const tRef = useRef(0);

  const handleEnter = () => {
    const box = boxRef.current;
    const wrap = ref.current;
    if (!box || !wrap) return;

    box.style.background = `${logo.color}10`;
    box.style.borderColor = `${logo.color}66`;
    box.style.boxShadow = `0 0 0 2px ${logo.color}55, 0 0 18px 6px ${logo.color}33`;

    tRef.current = 0;
    floatRef.current = window.setInterval(() => {
      tRef.current += 0.07;
      const y = Math.sin(tRef.current) * 6;
      wrap.style.transform = `translateY(${y}px)`;
    }, 16);

    let scale = 1, dir = 1;
    pulseRef.current = window.setInterval(() => {
      scale += dir * 0.003;
      if (scale > 1.04) dir = -1;
      if (scale < 0.97) dir = 1;
      box.style.transform = `scale(${scale})`;
    }, 16);
  };

  const handleLeave = () => {
    const box = boxRef.current;
    const wrap = ref.current;
    if (!box || !wrap) return;

    clearInterval(floatRef.current!);
    clearInterval(pulseRef.current!);

    box.style.background = "rgba(255,255,255,0.08)";
    box.style.borderColor = "rgba(255,255,255,0.15)";
    box.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    box.style.transform = "scale(1)";
    wrap.style.transform = "translateY(0px)";
  };

  return (
    <div
      ref={ref}
      className="logo-item"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "1.5rem 1rem",
        borderRadius: "16px",
        cursor: "default",
        opacity: 0,
        transition: "transform 0.1s ease",
      }}
    >
      <div
        ref={boxRef}
        style={{
          width: "76px",
          height: "76px",
          background: "rgba(255,255,255,0.08)",
          border: "1.5px solid rgba(255,255,255,0.15)",
          borderRadius: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, transform 0.1s ease",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <span
          style={{
            fontFamily: "Satoshi, sans-serif",
            fontWeight: 800,
            fontSize: "15px",
            color: "#FFFFFF",
            letterSpacing: "-0.3px",
          }}
        >
          {logo.name}
        </span>
      </div>

      <span
        style={{
          fontFamily: "Satoshi, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          color: "#94A3B8",
          textAlign: "center",
          maxWidth: "90px",
          lineHeight: 1.4,
        }}
      >
        {logo.full}
      </span>
    </div>
  );
}

export function LogosSection() {
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      gsap.fromTo(".logos-label",
        { opacity: 0, y: 20, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: ".logos-section", start: "top 85%" } }
      );
      gsap.fromTo(".logo-item",
        { opacity: 0, y: 30, scale: 0.9, filter: "blur(4px)" },
        {
          opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
          duration: 0.7, stagger: 0.08, ease: "back.out(1.5)",
          scrollTrigger: { trigger: ".logos-grid", start: "top 88%" },
        }
      );
    };
    load();
  }, []);

  return (
    <section
      className="logos-section"
      style={{
        padding: "5.5rem 2rem",
        background: "transparent",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <p
          className="logos-label"
          style={{
            textAlign: "center",
            fontFamily: "Satoshi, sans-serif", fontSize: "12px", fontWeight: 600,
            color: "#94A3B8", letterSpacing: "1.5px", textTransform: "uppercase",
            marginBottom: "2.5rem",
          }}
        >
          Aligned with NSE & Global Crypto Markets
        </p>
        <div
          className="logos-grid"
          style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "1rem" }}
        >
          {LOGOS.map((logo, i) => (
            <BacklightLogo key={logo.name} logo={logo} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FutureSection() {
  const items = [
    {
      icon: <ChartLine size={24} color="#E6A100" weight="bold" />,
      title: "More stocks",
      desc: "We'll keep adding companies based on what our users request — your demand shapes our roadmap.",
    },
    {
      icon: <FileCsv size={24} color="#E6A100" weight="bold" />,
      title: "Advanced Excel tools",
      desc: "Deeper formula support, multi-sheet linking, and auto-refresh from live price feeds.",
    },
    {
      icon: <Rocket size={24} color="#E6A100" weight="bold" />,
      title: "Portfolio tracker",
      desc: "Track your personal holdings, P&L, and performance — all integrated with the live data.",
    },
  ];

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Heading
      gsap.fromTo(".future-eyebrow",
        { opacity: 0, x: -24, filter: "blur(6px)" },
        { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: ".future-section", start: "top 80%" } }
      );
      gsap.fromTo(".future-h2",
        { opacity: 0, y: 40, filter: "blur(12px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: "power4.out", delay: 0.1,
          scrollTrigger: { trigger: ".future-section", start: "top 80%" } }
      );
      gsap.fromTo(".future-sub",
        { opacity: 0, y: 24, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out", delay: 0.25,
          scrollTrigger: { trigger: ".future-section", start: "top 80%" } }
      );

      // Cards with blur
      gsap.fromTo(".future-card",
        { opacity: 0, y: 50, scale: 0.95, filter: "blur(6px)" },
        {
          opacity: 1, y: 0, scale: 1, filter: "blur(0px)",
          duration: 0.8, stagger: 0.13, ease: "power3.out",
          scrollTrigger: { trigger: ".future-cards", start: "top 85%" },
        }
      );

      // CTA button
      gsap.fromTo(".future-cta",
        { opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "back.out(1.5)",
          scrollTrigger: { trigger: ".future-cta", start: "top 92%" } }
      );

      // Parallax background glow
      gsap.to(".future-glow",
        { y: -80, ease: "none",
          scrollTrigger: { trigger: ".future-section", scrub: 2 } }
      );
    };
    load();
  }, []);

  return (
    <section
      className="future-section"
      style={{
        padding: "9rem 2rem",
        background: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >

      {/* Parallax glow */}
      <div className="future-glow" style={{
        position: "absolute", top: "-100px", right: "-100px",
        width: "700px", height: "700px",
        background: "radial-gradient(circle, rgba(230,161,0,0.1) 0%, transparent 60%)",
        filter: "blur(80px)", zIndex: 0,
      }} />
      <div className="future-glow" style={{
        position: "absolute", bottom: -100, right: 100, width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(230,161,0,0.06) 0%, transparent 60%)",
        filter: "blur(60px)", zIndex: 0,
      }} />

      <div style={{ maxWidth: "1280px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Eyebrow */}
        <div className="future-eyebrow" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1.5rem" }}>
          <Sparkle size={16} color="#E6A100" weight="fill" />
          <span style={{
            fontFamily: "Satoshi, sans-serif", fontSize: "11px", fontWeight: 700,
            color: "#E6A100", letterSpacing: "2px", textTransform: "uppercase",
          }}>
            What's coming
          </span>
        </div>

        {/* Heading */}
        <h2 className="future-h2" style={{
          fontFamily: "Satoshi, sans-serif", fontWeight: 800,
          fontSize: "clamp(28px, 4vw, 56px)",
          color: "#FFFFFF", letterSpacing: "-1.5px", lineHeight: 1.05,
          marginBottom: "1.25rem", maxWidth: "620px",
        }}>
          The future of{" "}
          <span style={{ color: "#E6A100" }}>Rapid RatioG</span>
        </h2>

        <p className="future-sub" style={{
          fontFamily: "Satoshi, sans-serif", fontSize: "16px",
          color: "rgba(255,255,255,0.45)", maxWidth: "480px",
          lineHeight: 1.75, marginBottom: "3.5rem",
        }}>
          We're just getting started. Here's what's on the horizon — shaped entirely by user feedback.
        </p>

        {/* Cards */}
        <div
          className="future-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginBottom: "3rem",
          }}
        >
          {items.map((item, i) => (
            <div
              key={item.title}
              className="future-card"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "20px",
                padding: "2rem",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                opacity: 0, // GSAP animates
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(230,161,0,0.45)";
                e.currentTarget.style.background = "rgba(230,161,0,0.05)";
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 16px 48px rgba(230,161,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: "52px", height: "52px",
                background: "rgba(230,161,0,0.12)",
                borderRadius: "14px",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: "1.4rem",
                border: "1px solid rgba(230,161,0,0.2)",
              }}>
                {item.icon}
              </div>
              <h3 style={{
                fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "19px",
                color: "#FFFFFF", marginBottom: "0.75rem", letterSpacing: "-0.3px",
              }}>
                {item.title}
              </h3>
              <p style={{
                fontFamily: "Satoshi, sans-serif", fontSize: "14px",
                color: "rgba(255,255,255,0.45)", lineHeight: 1.75,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <a
            href="/prices"
            className="future-cta"
            style={{
              display: "inline-flex", alignItems: "center", gap: "10px",
              background: "linear-gradient(135deg, #C68000 0%, #E6A100 100%)",
              color: "#070B14", borderRadius: "14px", padding: "15px 32px",
              fontFamily: "Satoshi, sans-serif", fontWeight: 700, fontSize: "15px",
              textDecoration: "none",
              transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              boxShadow: "0 6px 24px rgba(230,161,0,0.35)",
              opacity: 0, // GSAP animates
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px) scale(1.03)";
              e.currentTarget.style.boxShadow = "0 12px 40px rgba(230,161,0,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              e.currentTarget.style.boxShadow = "0 6px 24px rgba(230,161,0,0.35)";
            }}
          >
            Explore prices now
            <ArrowRight size={18} weight="bold" />
          </a>
        </div>
      </div>
    </section>
  );
}