"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, TrendUp, FileXls } from "@phosphor-icons/react";

const STEPS = [
  { num: "01", title: "Search Any Stock", desc: "Type any NSE-listed stock or crypto and get instant results with live pricing data.", color: "#7CFFEF" },
  { num: "02", title: "Analyze with Charts", desc: "Interactive candlestick charts with RSI, MACD indicators and professional drawing tools.", color: "#8B5CF6" },
  { num: "03", title: "Export to Excel", desc: "Download your analysis as formatted .xlsx spreadsheets — or edit right in the browser.", color: "#10B981" },
];

export default function InteractiveDemo() {
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (el) {
      el.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(${active * 2 - 2}deg) scale3d(1, 1, 1)`;
    }
  }, [active]);

  const handlePanelMove = (e: React.MouseEvent) => {
    const el = panelRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 6;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -6;
    el.style.transition = "transform 0.1s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = `perspective(1000px) rotateX(${y}deg) rotateY(${active * 2 - 2 + x}deg) scale3d(1.01, 1.01, 1.01)`;
  };

  const handlePanelLeave = () => {
    const el = panelRef.current; if (!el) return;
    el.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(${active * 2 - 2}deg) scale3d(1, 1, 1)`;
  };

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      gsap.fromTo(".id-eyebrow", { opacity: 0, x: -20, filter: "blur(6px)" },
        { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".id-section", start: "top 75%" } });

      gsap.fromTo(".id-heading", { opacity: 0, y: 50, filter: "blur(10px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, ease: "power4.out",
          scrollTrigger: { trigger: ".id-section", start: "top 75%" } });

      // Steps stagger
      gsap.fromTo(".id-step", { opacity: 0, x: -40, filter: "blur(4px)" },
        { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.8, stagger: 0.12, ease: "power3.out",
          scrollTrigger: { trigger: ".id-steps", start: "top 82%" } });

      // Right panel
      gsap.fromTo(".id-panel", { opacity: 0, x: 80, rotationY: -10, filter: "blur(8px)" },
        { opacity: 1, x: 0, rotationY: 0, filter: "blur(0px)", duration: 1.4, ease: "power3.out",
          scrollTrigger: { trigger: ".id-section", start: "top 70%" } });
    };
    load();
  }, []);

  // Auto-cycle steps
  useEffect(() => {
    const timer = setInterval(() => {
      setActive(p => (p + 1) % STEPS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="id-section" style={{
      padding: "9rem 2rem", background: "transparent", position: "relative", overflow: "hidden",
    }}>


      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div className="id-grid" style={{
          display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "5rem", alignItems: "center",
        }}>
          {/* Left — steps */}
          <div>
            <span className="id-eyebrow" style={{
              fontFamily: "Satoshi, sans-serif", fontSize: 11, fontWeight: 700,
              color: "#7CFFEF", letterSpacing: "2.5px", textTransform: "uppercase",
              display: "block", marginBottom: "1rem",
            }}>How it works</span>

            <h2 className="id-heading" style={{
              fontFamily: "Satoshi, sans-serif", fontWeight: 800,
              fontSize: "clamp(28px, 4vw, 52px)", color: "#FFFFFF",
              letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: "3rem",
            }}>
              Three steps to{" "}
              <span style={{ color: "#7CFFEF" }}>market mastery</span>
            </h2>

            <div className="id-steps" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {STEPS.map((step, i) => (
                <div key={step.num} className="id-step"
                  onClick={() => setActive(i)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 20, padding: "1.5rem",
                    borderRadius: 18, cursor: "pointer",
                    background: active === i ? "rgba(255,255,255,0.1)" : "transparent",
                    border: active === i ? `1px solid rgba(124,255,239,0.3)` : "1px solid transparent",
                    boxShadow: active === i ? `0 8px 32px rgba(0,0,0,0.15)` : "none",
                    transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                    transform: active === i ? "translateX(8px)" : "translateX(0)",
                  }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: active === i ? step.color : "rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <span style={{
                      fontFamily: "Satoshi,sans-serif", fontWeight: 800, fontSize: 14,
                      color: active === i ? "white" : "#94A3B8",
                    }}>{step.num}</span>
                  </div>
                  <div>
                    <h3 style={{
                      fontFamily: "Satoshi,sans-serif", fontWeight: 700, fontSize: 17,
                      color: "#FFFFFF", marginBottom: 4,
                      opacity: active === i ? 1 : 0.6,
                      transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}>{step.title}</h3>
                    <p style={{
                      fontFamily: "Satoshi,sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)",
                      lineHeight: 1.7,
                      transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                      opacity: active === i ? 1 : 0.35,
                    }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{
              marginTop: 24, height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", background: STEPS[active].color, borderRadius: 3,
                width: `${((active + 1) / STEPS.length) * 100}%`,
                transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1), background 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              }} />
            </div>
          </div>

          {/* Right — visual panel */}
          <div className="id-panel" style={{ perspective: 1000 }} onMouseMove={handlePanelMove} onMouseLeave={handlePanelLeave}>
            <div ref={panelRef} style={{
              background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)",
              borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)", padding: "2rem",
              boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
              transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: `perspective(1000px) rotateX(0deg) rotateY(${active * 2 - 2}deg) scale3d(1, 1, 1)`,
              transformStyle: "preserve-3d",
            }}>
              {/* Mock search bar */}
              <div style={{
                background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "12px 18px",
                border: "1px solid rgba(255,255,255,0.1)", marginBottom: 20,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <MagnifyingGlass size={16} color="#94A3B8" weight="bold" />
                <span style={{
                  fontFamily: "Satoshi,sans-serif", fontSize: 14, color: active === 0 ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                  fontWeight: active === 0 ? 600 : 400,
                  transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                }}>
                  {active === 0 ? "POLYCAB INDIA" : "Search stocks & crypto..."}
                </span>
              </div>

              {/* Mock chart area */}
              <div style={{
                background: active === 1 ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.05)",
                borderRadius: 18, padding: "1.5rem", marginBottom: 16,
                transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)", minHeight: 200,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden",
              }}>
                {active === 1 ? (
                  <svg viewBox="0 0 400 120" style={{ width: "100%", height: 120 }}>
                    <defs>
                      <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7CFFEF" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#7CFFEF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,100 L40,85 L80,90 L120,60 L160,50 L200,55 L240,35 L280,40 L320,20 L360,25 L400,10 L400,120 L0,120Z" fill="url(#demoGrad)" />
                    <path d="M0,100 L40,85 L80,90 L120,60 L160,50 L200,55 L240,35 L280,40 L320,20 L360,25 L400,10" fill="none" stroke="#7CFFEF" strokeWidth="2.5" strokeLinecap="round" />
                    {/* Candlesticks */}
                    {[40,80,120,160,200,240,280,320,360].map((x, i) => (
                      <g key={i}>
                        <line x1={x} y1={90-i*8} x2={x} y2={70-i*8} stroke={i%2===0?"#16A34A":"#DC2626"} strokeWidth="4" strokeLinecap="round" />
                        <line x1={x} y1={95-i*8} x2={x} y2={65-i*8} stroke={i%2===0?"#16A34A":"#DC2626"} strokeWidth="1" />
                      </g>
                    ))}
                  </svg>
                ) : active === 2 ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><FileXls size={48} color="#0F2044" weight="duotone" /></div>
                    <div style={{ fontFamily: "Satoshi,sans-serif", fontWeight: 700, fontSize: 16, color: "#0F2044" }}>Export Ready</div>
                    <div style={{ fontFamily: "Satoshi,sans-serif", fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Download as .xlsx</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><TrendUp size={48} color="#0F2044" weight="duotone" /></div>
                    <div style={{ fontFamily: "Satoshi,sans-serif", fontWeight: 700, fontSize: 16, color: "#0F2044" }}>₹5,890.40</div>
                    <div style={{
                      fontFamily: "Satoshi,sans-serif", fontSize: 12, fontWeight: 700,
                      color: "#16A34A", background: "#DCFCE7", padding: "2px 10px",
                      borderRadius: 100, display: "inline-block", marginTop: 8,
                    }}>▲ +2.18%</div>
                  </div>
                )}
              </div>

              {/* Step indicator */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {STEPS.map((_, i) => (
                  <div key={i} style={{
                    width: active === i ? 24 : 8, height: 8, borderRadius: 4,
                    background: active === i ? STEPS[i].color : "rgba(255,255,255,0.15)",
                    transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)", cursor: "pointer",
                  }} onClick={() => setActive(i)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:900px){.id-grid{grid-template-columns:1fr!important}.id-panel{margin-top:2rem}}
      `}</style>
    </section>
  );
}
