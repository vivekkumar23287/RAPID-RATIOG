"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, TrendUp, Lightning } from "@phosphor-icons/react";
import { SignUpButton } from "@clerk/nextjs";

const TICKER_STOCKS = [
  { name: "NIFTY 50", value: "22,147.25", change: "+1.24%" },
  { name: "POLYCAB", value: "₹5,890.40", change: "+2.18%" },
  { name: "IEX", value: "₹178.30", change: "+3.45%" },
  { name: "DEEPAK NITRITE", value: "₹2,340.10", change: "+0.87%" },
  { name: "COCHIN SHIPYARD", value: "₹1,920.55", change: "+4.12%" },
  { name: "IFORGE", value: "₹890.70", change: "+1.56%" },
];

const WORDS = ["Intelligence", "Precision", "Speed", "Clarity", "Power"];

export default function Hero() {
  const wordRef = useRef<HTMLSpanElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const wordIdx = useRef(0);
  const blobRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    const el = wordRef.current;
    if (!el) return;

    let interval: NodeJS.Timeout;
    const runCycle = async () => {
      const { gsap } = await import("gsap");
      el.textContent = WORDS[0];
      gsap.set(el, { opacity: 1, y: 0 });

      const cycle = () => {
        gsap.to(el, {
          opacity: 0,
          y: -24,
          duration: 0.35,
          ease: "power2.in",
          onComplete: () => {
            wordIdx.current = (wordIdx.current + 1) % WORDS.length;
            el.textContent = WORDS[wordIdx.current];
            gsap.fromTo(el,
              { opacity: 0, y: 28 },
              { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }
            );
          },
        });
      };

      interval = setInterval(cycle, 2400);
    };

    runCycle();
    return () => clearInterval(interval);
  }, []);

  
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");

      
      gsap.set([".hero-line-1", ".hero-line-2", ".hero-sub", ".hero-btn-primary", ".hero-btn-secondary", ".hero-stat"], {
        opacity: 0,
      });
      gsap.set([".hero-line-1", ".hero-line-2"], { y: 80, skewY: 3 });
      gsap.set(".hero-sub", { y: 40 });
      gsap.set([".hero-btn-primary", ".hero-btn-secondary"], { y: 30, scale: 0.95 });
      gsap.set(".hero-stat", { y: 24 });
      gsap.set(".hero-chart-mock", { opacity: 0, x: 80, rotationY: -15 });

      const tl = gsap.timeline({ delay: 0.15, defaults: { ease: "power4.out" } });

      tl.to(".hero-line-1", { opacity: 1, y: 0, skewY: 0, duration: 1.0 })
        .to(".hero-line-2", { opacity: 1, y: 0, skewY: 0, duration: 1.0 }, "-=0.75")
        .to(".hero-sub", { opacity: 1, y: 0, duration: 0.8 }, "-=0.5")
        .to(".hero-btn-primary", { opacity: 1, y: 0, scale: 1, duration: 0.6 }, "-=0.4")
        .to(".hero-btn-secondary", { opacity: 1, y: 0, scale: 1, duration: 0.6 }, "-=0.45")
        .to(".hero-stat", {
          opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: "back.out(1.4)"
        }, "-=0.3")
        .to(".hero-chart-mock", { opacity: 1, x: 0, rotationY: 0, duration: 1.1, ease: "power3.out" }, "-=0.9");
    };
    load();
  }, []);

  
  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const blob = blobRef.current;
      const glow = cursorGlowRef.current;
      if (blob) {
        blob.style.transform = `translate(${e.clientX * 0.02}px, ${e.clientY * 0.02}px)`;
      }
      if (glow) {
        glow.style.left = `${e.clientX - 150}px`;
        glow.style.top = `${e.clientY - 150}px`;
      }
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.6;
    let rafId: number;
    const animate = () => {
      pos -= speed;
      if (Math.abs(pos) >= el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #FFFFFF 0%, #EEF2FF 45%, #FEE8EA 100%)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      
      <div
        ref={cursorGlowRef}
        style={{
          position: "fixed",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(224,31,46,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
          transition: "left 0.15s ease, top 0.15s ease",
        }}
      />

      
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(14,32,68,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14,32,68,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      
      <div
        ref={blobRef}
        style={{
          position: "absolute",
          top: "10%",
          right: "5%",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(224,31,46,0.13) 0%, transparent 70%)",
          borderRadius: "50%",
          zIndex: 0,
          filter: "blur(50px)",
          transition: "transform 0.4s ease",
          animation: "blobPulse 6s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: "3%",
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(15,32,68,0.07) 0%, transparent 70%)",
          borderRadius: "50%",
          zIndex: 0,
          filter: "blur(40px)",
          animation: "blobPulse 8s ease-in-out infinite reverse",
        }}
      />

      
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 2rem",
          paddingTop: "120px",
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4rem",
          alignItems: "center",
        }}
        className="hero-grid"
      >
        
        <div>
          
          <h1 style={{
            fontFamily: "Satoshi, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(44px, 6vw, 88px)",
            lineHeight: 1.0,
            color: "#0F2044",
            letterSpacing: "-2.5px",
            marginBottom: "1.5rem",
            maxWidth: "620px",
            overflow: "hidden",
          }}>
            <div className="hero-line-1" style={{ display: "block" }}>Trade with</div>
            <div className="hero-line-2" style={{ display: "block", color: "#E01F2E" }}>
              <span
                ref={wordRef}
                style={{ display: "inline-block" }}
              />
            </div>
          </h1>

          
          <p className="hero-sub" style={{
            fontFamily: "Satoshi, sans-serif",
            fontSize: "clamp(15px, 1.8vw, 19px)",
            fontWeight: 400,
            color: "#64748B",
            lineHeight: 1.75,
            maxWidth: "500px",
            marginBottom: "2.5rem",
          }}>
            All your favourite Indian stocks and global cryptocurrencies — live prices, interactive charts,
            and integrated Excel sheets — in one powerful platform.
          </p>

          
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "3.5rem" }}>
            <SignUpButton mode="modal">
              <button
                className="hero-btn-primary magnetic-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#E01F2E",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px 28px",
                  fontFamily: "Satoshi, sans-serif",
                  fontWeight: 600,
                  fontSize: "15px",
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(224,31,46,0.32), 0 1px 0 rgba(255,255,255,0.15) inset",
                  transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 8px 32px rgba(224,31,46,0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(224,31,46,0.32)";
                }}
              >
                Start for free
                <ArrowRight size={17} weight="bold" />
              </button>
            </SignUpButton>

            <a
              href="/prices"
              className="hero-btn-secondary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.7)",
                color: "#0F2044",
                border: "1.5px solid #E2E8F0",
                borderRadius: "12px",
                padding: "14px 28px",
                fontFamily: "Satoshi, sans-serif",
                fontWeight: 500,
                fontSize: "15px",
                cursor: "pointer",
                textDecoration: "none",
                backdropFilter: "blur(8px)",
                transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#E01F2E";
                e.currentTarget.style.color = "#E01F2E";
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.color = "#0F2044";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <TrendUp size={17} />
              View live prices
            </a>
          </div>

          
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            {[
              { label: "Assets tracked", value: "10+" },
              { label: "Data delay", value: "Real-time" },
              { label: "Excel export", value: "Free" },
            ].map((stat) => (
              <div key={stat.label} className="hero-stat" style={{ position: "relative" }}>
                <div style={{
                  fontFamily: "Satoshi, sans-serif",
                  fontWeight: 800,
                  fontSize: "26px",
                  color: "#E01F2E",
                  lineHeight: 1,
                  letterSpacing: "-0.5px",
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontFamily: "Satoshi, sans-serif",
                  fontSize: "12px",
                  color: "#94A3B8",
                  marginTop: "5px",
                  fontWeight: 500,
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        
        <div className="hero-chart-mock" style={{
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <MockChartCard />
        </div>
      </div>

      
      <div style={{
        marginTop: "4rem",
        borderTop: "1px solid rgba(226,232,240,0.8)",
        borderBottom: "1px solid rgba(226,232,240,0.8)",
        background: "rgba(15,32,68,0.015)",
        padding: "13px 0",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "80px",
          background: "linear-gradient(to right, rgba(245,247,255,1), transparent)",
          zIndex: 2, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: "80px",
          background: "linear-gradient(to left, rgba(245,247,255,1), transparent)",
          zIndex: 2, pointerEvents: "none",
        }} />
        <div ref={tickerRef} style={{ display: "flex", gap: "3rem", width: "max-content" }}>
          {[...TICKER_STOCKS, ...TICKER_STOCKS, ...TICKER_STOCKS].map((stock, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <span style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 700, fontSize: "12px", color: "#0F2044", letterSpacing: "0.8px" }}>
                {stock.name}
              </span>
              <span style={{ fontFamily: "Satoshi, sans-serif", fontSize: "12px", color: "#64748B" }}>
                {stock.value}
              </span>
              <span style={{
                fontFamily: "Satoshi, sans-serif", fontSize: "11px", fontWeight: 700,
                color: "#16A34A", background: "#DCFCE7", padding: "2px 8px", borderRadius: "100px",
              }}>
                {stock.change}
              </span>
              <span style={{ color: "#CBD5E1", fontSize: "18px" }}>·</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blobPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes ping {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-8px) rotate(0.5deg); }
          66% { transform: translateY(-4px) rotate(-0.5deg); }
        }
        @keyframes chartLine {
          from { stroke-dashoffset: 400; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-chart-mock {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function MockChartCard() {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  useEffect(() => {
    const checkMarket = () => {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const day = istTime.getDay();
      const timeInMinutes = istTime.getHours() * 60 + istTime.getMinutes();
      const isWeekday = day >= 1 && day <= 5;
      const isOpenTime = timeInMinutes >= (9 * 60 + 15) && timeInMinutes <= (15 * 60 + 30);
      setIsMarketOpen(isWeekday && isOpenTime);
    };
    checkMarket();
    const timer = setInterval(checkMarket, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "480px",
        animation: "float 7s ease-in-out infinite",
        position: "relative",
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        onMouseEnter={() => setIsHovered(true)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          border: "1px solid rgba(226,232,240,0.9)",
          padding: "1.5rem",
          boxShadow: "0 24px 80px rgba(15,32,68,0.12), 0 4px 16px rgba(247,147,26,0.06)",
          transform: isHovered
            ? "translateY(-50px) translateX(30px) rotate(4deg)"
            : "translateY(-30px) translateX(30px) rotate(5deg)",
          opacity: isHovered ? 1 : 0.6,
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          zIndex: 0,
        }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "16px", color: "#0F2044" }}>
              BITCOIN
            </div>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "12px", color: "#F7931A", marginTop: "2px", fontWeight: 700 }}>
              24/7 Live Crypto
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "22px", color: "#0F2044", letterSpacing: "-0.5px" }}>
              $64,230
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              background: "#DCFCE7", color: "#16A34A", borderRadius: "100px",
              padding: "2px 10px", fontSize: "12px", fontWeight: 700,
              fontFamily: "Satoshi, sans-serif", marginTop: "4px",
            }}>
              ▲ +3.12%
            </div>
          </div>
        </div>

        
        <div style={{ marginBottom: "1.25rem" }}>
          <svg viewBox="0 0 420 100" style={{ width: "100%", height: "90px", overflow: "visible" }}>
            <defs>
              <linearGradient id="chartGradBTC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F7931A" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#F7931A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,90 L40,80 L80,85 L120,60 L160,55 L200,45 L240,50 L280,30 L320,35 L360,15 L400,20 L420,10 L420,100 L0,100 Z"
              fill="url(#chartGradBTC)"
            />
            <path
              d="M0,90 L40,80 L80,85 L120,60 L160,55 L200,45 L240,50 L280,30 L320,35 L360,15 L400,20 L420,10"
              fill="none"
              stroke="#F7931A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="420" cy="10" r="4" fill="#F7931A" />
            <circle cx="420" cy="10" r="8" fill="rgba(247,147,26,0.2)" />
          </svg>
        </div>

        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { label: "Open", value: "$62,300" },
            { label: "High", value: "$64,500" },
            { label: "Volume", value: "32B" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#F8F9FC",
              borderRadius: "10px",
              padding: "10px",
              border: "1px solid #F1F5F9",
            }}>
              <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "10px", color: "#94A3B8", fontWeight: 500, marginBottom: "4px" }}>
                {s.label}
              </div>
              <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "13px", fontWeight: 700, color: "#0F2044" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      
      <div style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(20px)",
        borderRadius: "24px",
        border: "1px solid rgba(226,232,240,0.9)",
        padding: "1.5rem",
        boxShadow: "0 24px 80px rgba(15,32,68,0.12), 0 4px 16px rgba(224,31,46,0.06)",
        position: "relative",
        transform: isHovered ? "translateY(20px) translateX(-15px) rotate(-2deg)" : "translateY(0) translateX(0) rotate(0)",
        transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 1,
      }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "16px", color: "#0F2044" }}>
              POLYCAB INDIA
            </div>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>
              NSE · {isMarketOpen ? "Live" : "Closed"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: "22px", color: "#0F2044", letterSpacing: "-0.5px" }}>
              ₹5,890
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              background: "#DCFCE7", color: "#16A34A", borderRadius: "100px",
              padding: "2px 10px", fontSize: "12px", fontWeight: 700,
              fontFamily: "Satoshi, sans-serif", marginTop: "4px",
            }}>
              ▲ +2.18%
            </div>
          </div>
        </div>

        
        <div style={{ marginBottom: "1.25rem" }}>
          <svg viewBox="0 0 420 100" style={{ width: "100%", height: "90px", overflow: "visible" }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E01F2E" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#E01F2E" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            <path
              d="M0,80 L40,70 L80,60 L120,50 L160,55 L200,35 L240,40 L280,25 L320,30 L360,15 L400,10 L420,8 L420,100 L0,100 Z"
              fill="url(#chartGrad)"
            />
            
            <path
              d="M0,80 L40,70 L80,60 L120,50 L160,55 L200,35 L240,40 L280,25 L320,30 L360,15 L400,10 L420,8"
              fill="none"
              stroke="#E01F2E"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="420"
              strokeDashoffset="420"
              style={{ animation: "chartLine 1.8s ease-out 0.8s forwards" }}
            />
            
            <circle cx="420" cy="8" r="4" fill="#E01F2E" style={{ animation: "fadeInUp 0.3s ease 2.4s both" }} />
            <circle cx="420" cy="8" r="8" fill="rgba(224,31,46,0.2)" style={{ animation: "fadeInUp 0.3s ease 2.4s both" }} />
          </svg>
        </div>

        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { label: "Open", value: "₹5,760" },
            { label: "High", value: "₹5,920" },
            { label: "Volume", value: "2.4M" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#F8F9FC",
              borderRadius: "10px",
              padding: "10px",
              border: "1px solid #F1F5F9",
            }}>
              <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "10px", color: "#94A3B8", fontWeight: 500, marginBottom: "4px" }}>
                {s.label}
              </div>
              <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "13px", fontWeight: 700, color: "#0F2044" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      
      <div style={{
        position: "absolute",
        top: "-18px",
        right: "16px",
        background: isMarketOpen ? "#0F2044" : "#1E293B",
        borderRadius: "12px",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        boxShadow: "0 8px 24px rgba(15,32,68,0.25)",
        animation: "float 5s ease-in-out 1s infinite",
        zIndex: 2,
      }}>
        <div style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: isMarketOpen ? "#22C55E" : "#94A3B8",
          animation: isMarketOpen ? "ping 2s infinite" : "none"
        }} />
        <span style={{ fontFamily: "Satoshi, sans-serif", fontSize: "12px", fontWeight: 600, color: "white" }}>
          {isMarketOpen ? "Live · NSE" : "Market Closed"}
        </span>
      </div>

      
      <div style={{
        position: "absolute",
        top: "-45px",
        right: "-10px",
        background: "#F7931A",
        borderRadius: "12px",
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        boxShadow: "0 8px 24px rgba(247,147,26,0.3)",
        animation: "float 5s ease-in-out 1.5s infinite",
        transform: isHovered ? "translateY(-15px) translateX(20px)" : "translateY(0) translateX(0)",
        opacity: isHovered ? 1 : 0.6,
        transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        zIndex: 1,
      }}>
        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "white", animation: "ping 2s infinite" }} />
        <span style={{ fontFamily: "Satoshi, sans-serif", fontSize: "12px", fontWeight: 700, color: "white" }}>
          24/7 Live Crypto
        </span>
      </div>

      
      <div style={{
        position: "absolute",
        bottom: "-25px",
        left: "-25px",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        border: "1px solid #E2E8F0",
        borderRadius: "14px",
        padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(15,32,68,0.1)",
        animation: "float 6s ease-in-out 2s infinite",
        minWidth: "140px",
        zIndex: 2,
      }}>
        <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "10px", color: "#94A3B8", marginBottom: "4px" }}>
          NIFTY 50
        </div>
        <div style={{ fontFamily: "Satoshi, sans-serif", fontSize: "15px", fontWeight: 800, color: "#0F2044" }}>
          22,147 <span style={{ color: "#16A34A", fontSize: "12px" }}>▲</span>
        </div>
      </div>
    </div>
  );
}