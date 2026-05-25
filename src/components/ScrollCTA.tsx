"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { SignUpButton } from "@clerk/nextjs";

const COUNTERS = [
  { label: "Live Assets", target: 10, suffix: "+" },
  { label: "Chart Types", target: 5, suffix: "" },
  { label: "Update Speed", target: 0, suffix: "Real-time" },
  { label: "Export Format", target: 0, suffix: ".xlsx" },
];

function AnimatedCounter({ target, suffix, label, triggered }: {
  target: number; suffix: string; label: string; triggered: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!triggered || target === 0) return;
    let start = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 40);
    return () => clearInterval(timer);
  }, [triggered, target]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontFamily: "Satoshi,sans-serif", fontWeight: 900,
        fontSize: "clamp(32px, 5vw, 56px)", color: "#7CFFEF",
        letterSpacing: "-2px", lineHeight: 1,
      }}>
        {target > 0 ? count : ""}{suffix}
      </div>
      <div style={{
        fontFamily: "Satoshi,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)",
        marginTop: 8, fontWeight: 500,
      }}>{label}</div>
    </div>
  );
}

export default function ScrollCTA() {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Reveal heading with blur
      gsap.fromTo(".cta-heading", { opacity: 0, y: 60, scale: 0.9, filter: "blur(12px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "power4.out",
          scrollTrigger: { trigger: ".cta-section", start: "top 70%" } });

      gsap.fromTo(".cta-sub", { opacity: 0, y: 30, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power3.out", delay: 0.2,
          scrollTrigger: { trigger: ".cta-section", start: "top 70%" } });

      gsap.fromTo(".cta-btns", { opacity: 0, y: 20, filter: "blur(4px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out", delay: 0.4,
          scrollTrigger: { trigger: ".cta-section", start: "top 70%" } });

      // Counter trigger
      ScrollTrigger.create({
        trigger: ".cta-counters",
        start: "top 85%",
        onEnter: () => setTriggered(true),
      });

      // Counter card reveals with blur
      gsap.fromTo(".cta-counter", { opacity: 0, y: 30, scale: 0.9, filter: "blur(6px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.7, stagger: 0.1, ease: "back.out(1.4)",
          scrollTrigger: { trigger: ".cta-counters", start: "top 85%" } });

      // Parallax glow
      gsap.to(".cta-glow-1", { y: -80, ease: "none",
        scrollTrigger: { trigger: ".cta-section", scrub: 2 } });
      gsap.to(".cta-glow-2", { y: 60, ease: "none",
        scrollTrigger: { trigger: ".cta-section", scrub: 1.5 } });
    };
    load();
  }, []);

  return (
    <section className="cta-section" style={{
      padding: "9rem 2rem", background: "transparent", position: "relative", overflow: "hidden",
    }}>


      {/* Glows */}
      <div className="cta-glow-1" style={{
        position: "absolute", top: -100, right: -100, width: 600, height: 600,
        background: "radial-gradient(circle, rgba(124,255,239,0.15), transparent 60%)",
        filter: "blur(80px)", borderRadius: "50%",
      }} />
      <div className="cta-glow-2" style={{
        position: "absolute", bottom: -80, left: -80, width: 400, height: 400,
        background: "radial-gradient(circle, rgba(155,48,255,0.08), transparent 60%)",
        filter: "blur(60px)", borderRadius: "50%",
      }} />

      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <h2 className="cta-heading" style={{
          fontFamily: "Satoshi, sans-serif", fontWeight: 900,
          fontSize: "clamp(36px, 6vw, 72px)", color: "#FFFFFF",
          letterSpacing: "-3px", lineHeight: 1.05, marginBottom: "1.5rem",
        }}>
          Ready to trade
          <br />
          <span style={{
            background: "linear-gradient(135deg, #00C9A7, #7CFFEF, #00C9A7)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            animation: "gradientShift 3s ease infinite",
          }}>smarter?</span>
        </h2>

        <p className="cta-sub" style={{
          fontFamily: "Satoshi, sans-serif", fontSize: 18, color: "rgba(255,255,255,0.45)",
          lineHeight: 1.8, maxWidth: 550, margin: "0 auto 3rem",
        }}>
          Join traders who use RapidRatioG for live data, interactive charts, and seamless Excel integration.
        </p>

        <div className="cta-btns" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: "5rem" }}>
          <SignUpButton mode="modal">
            <button style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, #00C9A7, #7CFFEF)", color: "#070B14",
              border: "none", borderRadius: 14, padding: "16px 36px",
              fontFamily: "Satoshi,sans-serif", fontWeight: 700, fontSize: 16, cursor: "pointer",
              boxShadow: "0 8px 32px rgba(124,255,239,0.3)",
              transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px) scale(1.04)"; e.currentTarget.style.boxShadow = "0 16px 48px rgba(124,255,239,0.45)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,255,239,0.3)"; }}
            >
              Get Started Free <ArrowRight size={18} weight="bold" />
            </button>
          </SignUpButton>
          <a href="/prices" style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
            padding: "16px 36px", fontFamily: "Satoshi,sans-serif", fontWeight: 600,
            fontSize: 16, textDecoration: "none",
            transition: "all 0.3s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#7CFFEF"; e.currentTarget.style.color = "#7CFFEF"; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Explore Prices
          </a>
        </div>

        {/* Counters */}
        <div className="cta-counters" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
        }}>
          {COUNTERS.map((c, i) => (
            <div key={c.label} className="cta-counter" style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 20, padding: "2rem 1rem",
            }}>
              <AnimatedCounter target={c.target} suffix={c.suffix} label={c.label} triggered={triggered} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @media(max-width:768px){.cta-counters{grid-template-columns:1fr 1fr!important}}
      `}</style>
    </section>
  );
}
