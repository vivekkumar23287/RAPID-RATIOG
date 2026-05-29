"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, TrendUp } from "@phosphor-icons/react";
import { SignUpButton } from "@clerk/nextjs";

const WORDS = ["Intelligence", "Precision", "Speed", "Clarity", "Power"];
const FONT = "Satoshi, sans-serif";

export default function HeroNew() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const wordIdx = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const candle1Ref = useRef<HTMLDivElement>(null);
  const candle2Ref = useRef<HTMLDivElement>(null);
  const candle3Ref = useRef<HTMLDivElement>(null);

  // Mouse tracking for particles
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Particle canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
    const pts: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    for (let i = 0; i < 60; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, r: Math.random() * 1.5 + 0.5, o: Math.random() * 0.35 + 0.05 });
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        const dx = p.x - mouse.current.x, dy = p.y - mouse.current.y;
        if (Math.hypot(dx, dy) < 120) { p.x += dx * 0.008; p.y += dy * 0.008; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,255,239,${p.o})`; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(p.x - pts[j].x, p.y - pts[j].y);
          if (d < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `rgba(124,255,239,${0.04 * (1 - d / 100)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onR = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);

  // Word cycling with blur transition
  useEffect(() => {
    const el = wordRef.current; if (!el) return;
    let iv: NodeJS.Timeout | null = null;
    let isDestroyed = false;

    const run = async () => {
      const { gsap } = await import("gsap");
      if (isDestroyed) return;

      el.textContent = WORDS[0]; gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)" });
      const cycle = () => {
        if (isDestroyed) return;
        gsap.to(el, {
          opacity: 0, y: -20, filter: "blur(8px)", duration: 0.4, ease: "power2.in", onComplete: () => {
            if (isDestroyed) return;
            wordIdx.current = (wordIdx.current + 1) % WORDS.length;
            el.textContent = WORDS[wordIdx.current];
            gsap.fromTo(el, { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out" });
          }
        });
      };
      iv = setInterval(cycle, 2800);
    };
    run();

    return () => {
      isDestroyed = true;
      if (iv) clearInterval(iv);
    };
  }, []);

  // GSAP cinematic entrance + scroll parallax
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const els = [".hn-l1", ".hn-l2", ".hn-sub", ".hn-b1", ".hn-b2", ".hn-stat", ".hn-mock"];
      gsap.set(els, { opacity: 0 });
      gsap.set([".hn-l1", ".hn-l2"], { y: 80, skewY: 2, filter: "blur(6px)" });
      gsap.set(".hn-sub", { y: 40, filter: "blur(4px)" });
      gsap.set([".hn-b1", ".hn-b2"], { y: 30, scale: 0.95 });
      gsap.set(".hn-stat", { y: 24, filter: "blur(4px)" });
      gsap.set(".hn-mock", { x: 100, rotationY: -15, scale: 0.9, filter: "blur(8px)" });

      const tl = gsap.timeline({ delay: 0.3, defaults: { ease: "power4.out" } });
      tl.to(".hn-l1", { opacity: 1, y: 0, skewY: 0, filter: "blur(0px)", duration: 1.1 })
        .to(".hn-l2", { opacity: 1, y: 0, skewY: 0, filter: "blur(0px)", duration: 1.1 }, "-=0.8")
        .to(".hn-sub", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9 }, "-=0.6")
        .to(".hn-b1", { opacity: 1, y: 0, scale: 1, duration: 0.7 }, "-=0.5")
        .to(".hn-b2", { opacity: 1, y: 0, scale: 1, duration: 0.7 }, "-=0.55")
        .to(".hn-stat", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, stagger: 0.12, ease: "back.out(1.4)" }, "-=0.4")
        .to(".hn-mock", { opacity: 1, x: 0, rotationY: 0, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "power3.out" }, "-=1");

      // Scroll parallax
      gsap.to(".hn-left", { y: -100, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 2.0 } });
      gsap.to(".hn-mock", { y: -50, rotationY: 8, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 2.2 } });
      gsap.to(".hn-canvas", { y: 80, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 2.0 } });
    };
    load();
  }, []);

  // Frame-synchronized animation is handled directly by the canvas draw loop below

  return (
    <section ref={sectionRef} className="hn-sec" style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "transparent", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <canvas ref={canvasRef} className="hn-canvas" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />




      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "5%", right: "8%", width: 500, height: 500, background: "radial-gradient(circle, rgba(124,255,239,0.08) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(60px)", animation: "auroraGlow 12s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "3%", width: 400, height: 400, background: "radial-gradient(circle, rgba(155,48,255,0.06) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(50px)", animation: "auroraGlow 15s ease-in-out infinite reverse" }} />

      <CandlestickChart candleRefs={{ candle1Ref, candle2Ref, candle3Ref }} />

      {/* First Candle (Green) */}
      <div
        ref={candle1Ref}
        className="hn-mock-candle"
        style={{
          position: "absolute",
          left: -9999, // Positioned offscreen until animated by draw loop
          top: -9999,
          zIndex: 2,
          width: 320,
          height: 420,
          filter: "drop-shadow(0 15px 40px rgba(124, 255, 239, 0.25)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <TransparentCandle src="/candle-green.png" />
      </div>

      {/* Second Candle (Gemini Image 2) - Positioned dynamically on the spline */}
      <div
        ref={candle2Ref}
        className="hn-mock-candle"
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          zIndex: 2,
          width: 320,
          height: 420,
          filter: "drop-shadow(0 15px 40px rgba(124, 255, 239, 0.25)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <TransparentCandle src="/gemini-image-2.png" />
      </div>

      {/* Third Candle (Gemini Image 3) - Positioned dynamically on the spline */}
      <div
        ref={candle3Ref}
        className="hn-mock-candle"
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          zIndex: 2,
          width: 320,
          height: 420,
          filter: "drop-shadow(0 15px 40px rgba(124, 255, 239, 0.25)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <TransparentCandle src="/gemini-image-3.png" />
      </div>

      {/* Content */}
      <div className="hn-grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 2rem 0", position: "relative", zIndex: 1, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
        <div className="hn-left">
          {/* Headline */}
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(44px, 6vw, 88px)", lineHeight: 1, color: "#FFFFFF", letterSpacing: "-2.5px", marginBottom: "1.5rem", maxWidth: 620 }}>
            <div className="hn-l1">Trade with</div>
            <div className="hn-l2" style={{ color: "#7CFFEF" }}><span ref={wordRef} style={{ display: "inline-block" }} /></div>
          </h1>

          <p className="hn-sub" style={{ fontFamily: FONT, fontSize: "clamp(15px, 1.8vw, 19px)", fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: 500, marginBottom: "2.5rem" }}>
            All your favourite Indian stocks and global cryptocurrencies — live prices, interactive charts, and integrated Excel sheets — in one powerful platform.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: "3.5rem" }}>
            <SignUpButton mode="modal">
              <button className="hn-b1" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #00C9A7 0%, #7CFFEF 100%)", color: "#070B14", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 24px rgba(124,255,239,0.3), inset 0 1px 0 rgba(255,255,255,0.25)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                Start for free <ArrowRight size={17} weight="bold" />
              </button>
            </SignUpButton>
            <a href="/prices" className="hn-b2" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 500, fontSize: 15, cursor: "pointer", textDecoration: "none", backdropFilter: "blur(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <TrendUp size={17} /> View live prices
            </a>
          </div>

          {/* Stats with count-up */}
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            {[{ label: "Assets tracked", value: "10+" }, { label: "Data delay", value: "Real-time" }, { label: "Excel export", value: "Free" }].map(s => (
              <div key={s.label} className="hn-stat">
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: "#7CFFEF", lineHeight: 1, letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 5, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Candlestick Chart */}
        <div className="hn-mock" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
          
        </div>
      </div>

      {/* Premium animated scroll mouse indicator */}
      <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: "rgba(124,255,239,0.45)", letterSpacing: "3px", textTransform: "uppercase" }}>Scroll</span>
        <div style={{
          width: 20,
          height: 32,
          borderRadius: 10,
          border: "2px solid rgba(124,255,239,0.25)",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          paddingTop: 6,
        }}>
          <div style={{
            width: 4,
            height: 8,
            borderRadius: 2,
            background: "linear-gradient(135deg, #00C9A7, #7CFFEF)",
            animation: "scrollMouse 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite",
            boxShadow: "0 0 8px rgba(124,255,239,0.6)",
          }} />
        </div>
      </div>

      <style>{`
        .hn-b1 {
          position: relative !important;
          overflow: hidden !important;
          z-index: 1 !important;
          transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 1.1s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
        .hn-b1::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: linear-gradient(135deg, #00FFCC 0%, #0099FF 100%) !important;
          opacity: 0 !important;
          z-index: -1 !important;
          transition: opacity 1.1s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
        .hn-b1:hover::before {
          opacity: 1 !important;
        }
        .hn-b1:hover {
          color: #070B14 !important;
          transform: translateY(-4px) scale(1.025) !important;
          box-shadow: 0 12px 30px rgba(0, 255, 204, 0.45) !important;
        }
        .hn-b2 {
          position: relative !important;
          overflow: hidden !important;
          z-index: 1 !important;
          transition: all 1.1s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
        .hn-b2::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: rgba(124, 255, 239, 0.12) !important;
          opacity: 0 !important;
          z-index: -1 !important;
          transition: opacity 1.1s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
        .hn-b2:hover::before {
          opacity: 1 !important;
        }
        .hn-b2:hover {
          color: #7CFFEF !important;
          border-color: #7CFFEF !important;
          transform: translateY(-4px) scale(1.025) !important;
          box-shadow: 0 12px 30px rgba(124, 255, 239, 0.15) !important;
        }
        @media(max-width:900px){.hn-grid{grid-template-columns:1fr!important}.hn-mock{display:none!important}.hn-mock-candle{display:none!important}}
        @keyframes candleFloat1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes candleFloat2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes candleFloat3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes candleFloat4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes candleFloat5 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes trendLineDraw { from{stroke-dashoffset:800} to{stroke-dashoffset:0} }
        @keyframes candleFadeIn { from{opacity:0;transform:translateY(20px) scale(0.8)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes glowPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes scrollMouse { 
          0% { transform: translateY(0); opacity: 1; } 
          50% { transform: translateY(8px); opacity: 0.3; } 
          100% { transform: translateY(0); opacity: 1; } 
        }
      `}</style>
    </section>
  );
}

/* Magnetic hover button */
function MagneticButton({ children, as, className, style, ...props }: any) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as || "button";
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.15;
    const y = (e.clientY - r.top - r.height / 2) * 0.15;
    el.style.transform = `translate(${x}px, ${y}px) scale(1.03)`;
    el.style.boxShadow = Tag === "button" ? "0 8px 32px rgba(124,255,239,0.35)" : "none";
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transition = "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease";
    el.style.transform = "translate(0,0) scale(1)";
    el.style.boxShadow = style?.boxShadow || "";
    setTimeout(() => { if (el) el.style.transition = ""; }, 500);
  };
  return <Tag ref={ref} className={className} style={style} onMouseMove={onMove} onMouseLeave={onLeave} {...props}>{children}</Tag>;
}

/* Candlestick Chart — Premium animated neon glowing curve-line with particles */
interface CandleRefs {
  candle1Ref: React.RefObject<HTMLDivElement | null>;
  candle2Ref: React.RefObject<HTMLDivElement | null>;
  candle3Ref: React.RefObject<HTMLDivElement | null>;
}

function CandlestickChart({ candleRefs }: { candleRefs: CandleRefs }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let isDestroyed = false;
    let st: any = null;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    
    // Set high-DPI scaled canvas dimensions to prevent blurriness and pixelation
    let w = window.innerWidth;
    let h = canvas.parentElement?.clientHeight || window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Locate the .hn-mock visual column anchor coordinates on screen
    const mockEl = document.querySelector(".hn-mock");
    const mockRect = mockEl ? mockEl.getBoundingClientRect() : null;
    const canvasRect = canvas.getBoundingClientRect();
    
    // Waypoints starting at 59% height (right) and ending at 88% height (left) with exactly 2 gentle curves
    const buildWaypoints = (vw: number, vh: number) => [
      { x: vw + 30, y: vh * 0.59 },       // Start at 59% height (extreme right)
      { x: vw * 0.66, y: vh * 0.42 },      // Curve 1: Peak rising up to 42% height (at 66% width)
      { x: vw * 0.33, y: vh * 0.72 },      // Curve 2: Trough dipping to 72% height (at 33% width)
      { x: -30, y: vh * 0.88 },            // End at 88% height (extreme left)
    ];
    let waypoints = buildWaypoints(w, h);

    // The t-value where the candle should rest (at the first peak, which is exactly t = 0.33 with 3 segments)
    const candleRestT = 0.33;

    // Direct DOM manipulation function to bypass React state re-renders for buttery 60fps coordinates
    const updateCandleStyles = (p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, opacity: number) => {
      const c1 = candleRefs.candle1Ref.current;
      const c2 = candleRefs.candle2Ref.current;
      const c3 = candleRefs.candle3Ref.current;

      if (c1) {
        c1.style.left = `${p1.x - 160}px`;
        c1.style.top = `${p1.y - 210}px`;
        c1.style.opacity = `${opacity}`;
        c1.style.transform = `scale(${0.85 + opacity * 0.15})`;
      }
      if (c2) {
        c2.style.left = `${p2.x - 160}px`;
        c2.style.top = `${p2.y - 210}px`;
        c2.style.opacity = `${opacity}`;
        c2.style.transform = `scale(${(0.85 + opacity * 0.15) * 1.5})`;
      }
      if (c3) {
        c3.style.left = `${p3.x - 160}px`;
        c3.style.top = `${p3.y - 210}px`;
        c3.style.opacity = `${opacity}`;
        c3.style.transform = `scale(${0.85 + opacity * 0.15})`;
      }
    };

    import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
      if (isDestroyed) return;
      import("gsap").then(({ gsap }) => {
        if (isDestroyed) return;
        gsap.registerPlugin(ScrollTrigger);
        st = ScrollTrigger.create({
          trigger: ".hn-sec",
          start: "top top",
          end: "bottom top",
          scrub: 2.2,
        });
      });
    });

    // Initialize state to completely invisible (offscreen initially)
    updateCandleStyles(waypoints[0], waypoints[0], waypoints[0], 0);

    // Animation progress control (200 frames = ~3.3 seconds at 60fps for a premium cinematic trendline sweep)
    let linearProgress = 0;
    const duration = 200;
    let frame = 0;

    // Candle glide control (150 frames = ~2.5 seconds at 60fps for a silky-smooth landing sweep)
    let candleFrame = 0;
    const candleDuration = 150;

    // Quartic Ease-Out for the trend line
    const easeOutQuart = (x: number): number => {
      return 1 - Math.pow(1 - x, 4);
    };

    // Power-6 Ease-Out for an incredibly soft, gradual, long-tail deceleration landing
    const easeOutPower6 = (x: number): number => {
      return 1 - Math.pow(1 - x, 6);
    };

    // Catmull-Rom spline interpolation through all waypoints
    // t ranges from 0 (first waypoint) to 1 (last waypoint)
    const getSplinePoint = (t: number) => {
      const n = waypoints.length - 1;
      const scaledT = Math.max(0, Math.min(1, t)) * n;
      const seg = Math.min(Math.floor(scaledT), n - 1);
      const lt = scaledT - seg;

      const p0w = waypoints[Math.max(seg - 1, 0)];
      const p1w = waypoints[seg];
      const p2w = waypoints[Math.min(seg + 1, n)];
      const p3w = waypoints[Math.min(seg + 2, n)];

      const lt2 = lt * lt;
      const lt3 = lt2 * lt;

      const x = 0.5 * ((2 * p1w.x) + (-p0w.x + p2w.x) * lt + (2 * p0w.x - 5 * p1w.x + 4 * p2w.x - p3w.x) * lt2 + (-p0w.x + 3 * p1w.x - 3 * p2w.x + p3w.x) * lt3);
      const y = 0.5 * ((2 * p1w.y) + (-p0w.y + p2w.y) * lt + (2 * p0w.y - 5 * p1w.y + 4 * p2w.y - p3w.y) * lt2 + (-p0w.y + 3 * p1w.y - 3 * p2w.y + p3w.y) * lt3);

      return { x, y };
    };

    // Alias for backward-compatible usage in the draw loop
    const getBezierPoint = getSplinePoint;

    const draw = () => {
      if (isDestroyed) return;
      // Clear canvas cleanly every frame to ensure transparency (preserves background gradients)
      ctx.clearRect(0, 0, w * dpr, h * dpr);

      // Advance progress
      if (frame < duration) {
        frame++;
        linearProgress = frame / duration;
      }
      const currentT = easeOutQuart(linearProgress);
      const currentPoint = getBezierPoint(currentT);

      // 1. Draw neon glowing path behind the moving point (only where it has already traveled)
      if (currentT > 0) {
        ctx.save();
        ctx.beginPath();
        const startPt = getBezierPoint(0);
        ctx.moveTo(startPt.x, startPt.y);

        // Divide the active path [0, currentT] into 300 steps for ultra-high-resolution smoothness
        const steps = 300;
        for (let i = 1; i <= steps; i++) {
          const t = (i / steps) * currentT;
          const pt = getBezierPoint(t);
          ctx.lineTo(pt.x, pt.y);
        }

        // Outer Neon Glow (Cyan/turquoise glow bloom)
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(124, 255, 239, 0.78)";
        ctx.strokeStyle = "rgba(124, 255, 239, 0.88)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Inner Sharp White core line (Apple/Tesla style contrast)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      const scrollProgress = st ? st.progress : 0;
      // Check if the drawing point has reached or crossed 50% of the screen width (moving from right to left)
      const reachedHalfWidth = currentPoint.x <= w * 0.5 || scrollProgress > 0;

      // 2. Draw active moving point tip (crisp, matching the line's outer thickness perfectly)
      if (currentT < 1.0) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // 3. Point is at rest: Crisp dot matching the line thickness perfectly
        ctx.save();
        const restPt = getBezierPoint(1);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(restPt.x, restPt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Glide the candles along the curve starting the moment the line passes 50% width
      if (reachedHalfWidth) {
        if (candleFrame < candleDuration) {
          candleFrame++;
        }
        // Entrance progress from 0 to resting point
        const entProgress = easeOutPower6(candleFrame / candleDuration) * candleRestT;
        // Continue traveling to the left based on scroll progress
        const progress1 = entProgress + scrollProgress * (1.0 - entProgress);

        // Candle 2 lags slightly behind Candle 1 (spaced out by 0.08 progress steps along the spline)
        const progress2 = Math.max(0, progress1 - 0.08);
        const pt2 = getSplinePoint(progress2);

        // Candle 3 lags slightly behind Candle 2 (spaced out by another 0.08 progress steps along the spline)
        const progress3 = Math.max(0, progress1 - 0.16);
        const pt3 = getSplinePoint(progress3);

        const pt1 = getSplinePoint(progress1);

        updateCandleStyles(pt1, pt2, pt3, 1);
      } else {
        // Keep the candles invisible during line drawing
        updateCandleStyles(waypoints[0], waypoints[0], waypoints[0], 0);
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    // Recalculate dimensions and curve control points on container resizing
    const handleResize = () => {
      if (isDestroyed) return;
      const currentDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      w = window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      
      canvas.width = w * currentDpr;
      canvas.height = h * currentDpr;
      ctx.scale(currentDpr, currentDpr);
      
      const mEl = document.querySelector(".hn-mock");
      const mRect = mEl ? mEl.getBoundingClientRect() : null;
      const cRect = canvas.getBoundingClientRect();
      
      const tX = mRect ? (mRect.left - cRect.left + mRect.width / 2) : (w * 0.75);
      const tY = mRect ? (mRect.top - cRect.top + mRect.height / 2) : (h * 0.5);

      // Rebuild waypoints for the new dimensions
      waypoints = buildWaypoints(w, h);

      // Set candles to their rest positions on the recalculated spline
      const restPt1 = getSplinePoint(candleRestT);
      const restPt2 = getSplinePoint(Math.max(0, candleRestT - 0.08));
      const restPt3 = getSplinePoint(Math.max(0, candleRestT - 0.16));
      updateCandleStyles(restPt1, restPt2, restPt3, 1);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      if (st) st.kill();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        zIndex: 1,
        pointerEvents: "none"
      }}
    />
  );
}

/* Canvas-based background removal: strips dark/checkerboard pixels */
function TransparentCandle({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Support both vibrant green/blue (green/blue dominant over red) AND vibrant red (red dominant over green/blue)
        const greenBlueExcess = Math.max(g - r, b - r);
        const redExcess = r - Math.max(g, b);
        const colorExcess = Math.max(greenBlueExcess, redExcess);

        // Calculate brightness (0-255)
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        if (colorExcess < 35) {
          // Definitely background (gray checkerboard, white lines, dark areas).
          // Keep only the extremely bright white highlights of the candle's inner glow.
          if (r > 235 && g > 235 && b > 235) {
            const alpha = Math.max(0, Math.floor(((brightness - 235) / 20) * 255));
            data[i + 3] = Math.min(data[i + 3], alpha);
          } else {
            data[i + 3] = 0; // fully transparent
          }
        } else if (colorExcess < 55) {
          // Smooth feathering transition zone for the candle's outer edges
          const factor = (colorExcess - 35) / 20; // 0 to 1
          const alpha = Math.floor(factor * 255);
          data[i + 3] = Math.min(data[i + 3], alpha);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };
    img.src = src;
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
      }}
    />
  );
}
