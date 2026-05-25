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
  const [candlePos, setCandlePos] = useState({ x: 0, y: 0, opacity: 0 });
  const candleRef = useRef<HTMLDivElement>(null);

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
    let iv: NodeJS.Timeout;
    const run = async () => {
      const { gsap } = await import("gsap");
      el.textContent = WORDS[0]; gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)" });
      const cycle = () => {
        gsap.to(el, {
          opacity: 0, y: -20, filter: "blur(8px)", duration: 0.4, ease: "power2.in", onComplete: () => {
            wordIdx.current = (wordIdx.current + 1) % WORDS.length;
            el.textContent = WORDS[wordIdx.current];
            gsap.fromTo(el, { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out" });
          }
        });
      };
      iv = setInterval(cycle, 2800);
    };
    run();
    return () => clearInterval(iv);
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
      gsap.to(".hn-left", { y: -100, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 1.2 } });
      gsap.to(".hn-mock", { y: -50, rotationY: 8, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 1.8 } });
      gsap.to(".hn-canvas", { y: 80, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 1.5 } });
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

      <CandlestickChart setCandlePos={setCandlePos} />

      {candlePos.x > 0 && (
        <div
          ref={candleRef}
          className="hn-mock-candle"
          style={{
            position: "absolute",
            left: candlePos.x - 160,
            top: candlePos.y - 210,
            zIndex: 2,
            width: 320,
            height: 420,
            filter: "drop-shadow(0 15px 40px rgba(124, 255, 239, 0.25)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
            pointerEvents: "none",
            opacity: candlePos.opacity,
            transform: `scale(${0.85 + candlePos.opacity * 0.15})`
          }}
        >
          <TransparentCandle src="/candle-green.png" />
        </div>
      )}

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
              <MagneticButton className="hn-b1" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #00C9A7 0%, #7CFFEF 100%)", color: "#070B14", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 24px rgba(124,255,239,0.3), inset 0 1px 0 rgba(255,255,255,0.25)", transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
                Start for free <ArrowRight size={17} weight="bold" />
              </MagneticButton>
            </SignUpButton>
            <MagneticButton as="a" href="/prices" className="hn-b2" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1.5px solid rgba(255,255,255,0.15)", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 500, fontSize: 15, cursor: "pointer", textDecoration: "none", backdropFilter: "blur(12px)", transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <TrendUp size={17} /> View live prices
            </MagneticButton>
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

      {/* Scroll indicator */}
      <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "premiumFloat 3s ease-in-out infinite" }}>
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: "rgba(124,255,239,0.6)", letterSpacing: "3px", textTransform: "uppercase" }}>Scroll</span>
        <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, #7CFFEF, transparent)", borderRadius: 1 }} />
      </div>

      <style>{`
        @media(max-width:900px){.hn-grid{grid-template-columns:1fr!important}.hn-mock{display:none!important}.hn-mock-candle{display:none!important}}
        @keyframes candleFloat1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes candleFloat2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes candleFloat3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes candleFloat4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes candleFloat5 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes trendLineDraw { from{stroke-dashoffset:800} to{stroke-dashoffset:0} }
        @keyframes candleFadeIn { from{opacity:0;transform:translateY(20px) scale(0.8)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes glowPulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
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
function CandlestickChart({ setCandlePos }: { setCandlePos: (pos: { x: number; y: number; opacity: number }) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
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
    
    const targetX = mockRect ? (mockRect.left - canvasRect.left + mockRect.width / 2) : (w * 0.75);
    const targetY = mockRect ? (mockRect.top - canvasRect.top + mockRect.height / 2) : (h * 0.5);

    // Spline curve control points relative to full-screen coordinates
    let p0 = { x: w, y: h * 0.45 }; // Starts at the absolute extreme right viewport edge
    let p3 = { x: targetX - 240, y: targetY }; // Ends 240px further to the left for a wider sweep

    const deltaX = p0.x - p3.x;
    let p1 = { x: p0.x - deltaX * 0.35, y: p0.y - h * 0.22 }; // Curves upward
    let p2 = { x: p0.x - deltaX * 0.75, y: p3.y + h * 0.25 }; // Dips downward

    // Initialize state to completely invisible
    setCandlePos({ x: p0.x, y: p0.y, opacity: 0 });

    // Animation progress control (100 frames = ~1.6 seconds at 60fps for crisp, fast trendline sweep)
    let linearProgress = 0;
    const duration = 100;
    let frame = 0;

    // Candle glide control (120 frames = 2 seconds at 60fps)
    let candleFrame = 0;
    const candleDuration = 120;

    // Quartic Ease-Out for an extremely soft, cinematic deceleration curve
    const easeOutQuart = (x: number): number => {
      return 1 - Math.pow(1 - x, 4);
    };

    // Evaluate cubic Bezier spline coordinate at progress t (0 to 1)
    const getBezierPoint = (t: number) => {
      const oneMinusT = 1 - t;
      const mt2 = oneMinusT * oneMinusT;
      const mt3 = mt2 * oneMinusT;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * oneMinusT * t2 * p2.x + t3 * p3.x;
      const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * oneMinusT * t2 * p2.y + t3 * p3.y;

      return { x, y };
    };

    const draw = () => {
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

      // 2. Draw active moving point tip (crisp, matching the line's outer thickness perfectly)
      if (currentT < 1.0) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Keep the candle invisible during line drawing
        setCandlePos({ x: p0.x, y: p0.y, opacity: 0 });
      } else {
        // 3. Point is at rest: Crisp dot matching the line thickness perfectly
        ctx.save();
        const restPt = getBezierPoint(1);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(restPt.x, restPt.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. Glide the candle along the curve after the line has completed its animation
        if (candleFrame < candleDuration) {
          candleFrame++;
          // Scale progress by 0.5 so the candle only travels from the right edge to the middle of the line (t = 0.5)
          const progress = easeOutQuart(candleFrame / candleDuration) * 0.5;
          const pt = getBezierPoint(progress);
          const opacity = Math.min(1, candleFrame / 15); // Smooth fade-in over 15 frames
          setCandlePos({ x: pt.x, y: pt.y, opacity });
        } else {
          // Once the glide is complete, lock the candle perfectly static at its rest position (exactly at the middle of the curve)
          const midPt = getBezierPoint(0.5);
          setCandlePos({ x: midPt.x, y: midPt.y, opacity: 1 });
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    // Recalculate dimensions and curve control points on container resizing
    const handleResize = () => {
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

      p0 = { x: w, y: h * 0.45 };
      p3 = { x: tX - 240, y: tY };

      const dX = p0.x - p3.x;
      p1 = { x: p0.x - dX * 0.35, y: p0.y - h * 0.22 };
      p2 = { x: p0.x - dX * 0.75, y: p3.y + h * 0.25 };

      // Set global coordinates for the candle in the middle of the curve on window resize
      const midPt = getBezierPoint(0.5);
      setCandlePos({ x: midPt.x, y: midPt.y, opacity: 1 });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
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

        // Calculate how much green or blue exceeds red (since the candle is highly vibrant cyan/green,
        // and the entire checkerboard background, lines, and stars are greyscale/neutral).
        const colorExcess = Math.max(g - r, b - r);

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
