"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Crosshair, Diamond, ChartLineUp } from "@phosphor-icons/react";
import { IconBolt } from "@tabler/icons-react";

const FONT = "Satoshi, sans-serif";
const FEATURES: { title: string; desc: string; gradient: string; icon: ReactNode }[] = [
  { title: "Smooth Scroll Animation", desc: "Buttery-smooth parallax effects powered by Lenis. Every element glides with cinematic precision.", gradient: "linear-gradient(135deg, #E01F2E, #FF6B7A)", icon: <Crosshair size={24} color="white" weight="bold" /> },
  { title: "3D Interactive Design", desc: "Cards tilt and respond to your mouse. Real depth, perspective, and shadows create a tactile experience.", gradient: "linear-gradient(135deg, #0F2044, #1A3460)", icon: <Diamond size={24} color="white" weight="bold" /> },
  { title: "Real-Time Data Streams", desc: "Live stock prices flowing in real-time. Watch the market pulse through beautifully animated visualizations.", gradient: "linear-gradient(135deg, #16A34A, #22C55E)", icon: <IconBolt size={24} color="white" stroke={2} /> },
  { title: "Interactive Charts & Tools", desc: "Candlestick charts, RSI indicators, and drawing tools that rival professional trading terminals.", gradient: "linear-gradient(135deg, #E01F2E, #B8161F)", icon: <ChartLineUp size={24} color="white" weight="bold" /> },
];

/* ─── Canvas-based background removal — same as HeroNew ─── */
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

        const greenBlueExcess = Math.max(g - r, b - r);
        const redExcess = r - Math.max(g, b);
        const colorExcess = Math.max(greenBlueExcess, redExcess);
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        if (colorExcess < 35) {
          if (r > 235 && g > 235 && b > 235) {
            const alpha = Math.max(0, Math.floor(((brightness - 235) / 20) * 255));
            data[i + 3] = Math.min(data[i + 3], alpha);
          } else {
            data[i + 3] = 0;
          }
        } else if (colorExcess < 55) {
          const factor = (colorExcess - 35) / 20;
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
      style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
    />
  );
}

/* ─── Scroll-driven candle + neon-line canvas ─── */
function ScrollCandleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const c1Ref = useRef<HTMLDivElement>(null);
  const c2Ref = useRef<HTMLDivElement>(null);
  const c3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let w = window.innerWidth;
    let h = canvas.parentElement?.clientHeight || window.innerHeight;

    // ── Waypoints: Small & Subtle 2-Curve Pattern (Left → Right) ──
    const buildWaypoints = () => [
      { x: -30,         y: h * 0.50 },   // entry: left (centered vertically)
      { x: w * 0.33,    y: h * 0.62 },   // Curve 1 (Trough): gentle dip at 62% height
      { x: w * 0.66,    y: h * 0.38 },   // Curve 2 (Peak): gentle rise at 38% height
      { x: w + 30,      y: h * 0.50 },   // exit: right (centered vertically)
    ];

    // Catmull-Rom spline (same as HeroNew)
    const getSplinePoint = (t: number, wps: { x: number; y: number }[]) => {
      const n = wps.length - 1;
      const scaledT = Math.max(0, Math.min(1, t)) * n;
      const seg = Math.min(Math.floor(scaledT), n - 1);
      const lt = scaledT - seg;
      const p0 = wps[Math.max(seg - 1, 0)];
      const p1 = wps[seg];
      const p2 = wps[Math.min(seg + 1, n)];
      const p3 = wps[Math.min(seg + 2, n)];
      const lt2 = lt * lt, lt3 = lt2 * lt;
      return {
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * lt + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * lt2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * lt3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * lt + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * lt2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * lt3),
      };
    };

    // Draw the full static neon line across the entire section
    const drawStaticLine = () => {
      ctx.clearRect(0, 0, w, h);
      const wps = buildWaypoints();
      const steps = 400;

      ctx.save();
      ctx.beginPath();
      const start = getSplinePoint(0, wps);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i <= steps; i++) {
        const pt = getSplinePoint(i / steps, wps);
        ctx.lineTo(pt.x, pt.y);
      }

      // Outer neon glow — same cyan as HeroNew
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(124, 255, 239, 0.78)";
      ctx.strokeStyle = "rgba(124, 255, 239, 0.88)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Inner white core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Terminal dot at the left end
      const end = getSplinePoint(1, wps);
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(end.x, end.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const resize = () => {
      w = window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      drawStaticLine();
    };
    resize();

    // ── Position candles via DOM (same pattern as HeroNew) ──
    const CANDLE_W = 260;
    const CANDLE_H = 340;
    // Spacing between the 3 candles along the spline (in t-units)
    const SPACING = 0.07;

    const positionCandles = (t: number) => {
      const wps = buildWaypoints();
      const t1 = Math.max(0, Math.min(1, t));
      const t2 = Math.max(0, t1 - SPACING);
      const t3 = Math.max(0, t2 - SPACING);

      const pt1 = getSplinePoint(t1, wps);
      const pt2 = getSplinePoint(t2, wps);
      const pt3 = getSplinePoint(t3, wps);

      const apply = (el: HTMLDivElement | null, pt: { x: number; y: number }, scale: number) => {
        if (!el) return;
        el.style.left = `${pt.x - CANDLE_W / 2}px`;
        el.style.top  = `${pt.y - CANDLE_H / 2}px`;
        el.style.transform = `scale(${scale})`;
        el.style.opacity = "1";
      };

      apply(c1Ref.current, pt1, 0.90);
      apply(c2Ref.current, pt2, 1.30);   // middle candle is bigger (same as HeroNew)
      apply(c3Ref.current, pt3, 0.90);
    };

    // Start with all candles at the right edge (t=0), invisible
    const hideCandles = () => {
      const wps = buildWaypoints();
      const startPt = getSplinePoint(0, wps);
      [c1Ref.current, c2Ref.current, c3Ref.current].forEach(el => {
        if (!el) return;
        el.style.left = `${startPt.x - CANDLE_W / 2}px`;
        el.style.top  = `${startPt.y - CANDLE_H / 2}px`;
        el.style.opacity = "0";
      });
    };
    hideCandles();

    // ── GSAP scroll-scrub ──
    let cleanup: (() => void) | null = null;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Proxy object that GSAP will tween
      const proxy = { t: 0 };

      const st = ScrollTrigger.create({
        trigger: ".ss-sec",
        start: "top bottom",   // when section top hits viewport bottom → start
        end:   "bottom top",   // when section bottom leaves viewport top → end
        scrub: 1.8,
        onUpdate: (self) => {
          // Map scroll progress (0→1) to t-value along the spline (0→1)
          // Candles travel from right (t=0) to left (t=1) as user scrolls
          const rawT = self.progress;
          positionCandles(rawT);
          // Make candles visible as soon as section enters view
          [c1Ref.current, c2Ref.current, c3Ref.current].forEach(el => {
            if (el) el.style.opacity = rawT > 0.02 ? "1" : "0";
          });
        },
        onLeave: () => {
          // Lock at left end when scrolled past
          positionCandles(1);
        },
        onEnterBack: () => {
          // When scrolling back up into section, restore visibility
          positionCandles(0.98);
        },
      });

      cleanup = () => st.kill();
    })();

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cleanup?.();
    };
  }, []);

  const CANDLE_W = 260;
  const CANDLE_H = 340;

  return (
    <>
      {/* Full-section neon line canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none", zIndex: 1, background: "transparent",
        }}
      />

      {/* Candle 1 — Green */}
      <div
        ref={c1Ref}
        style={{
          position: "absolute", width: CANDLE_W, height: CANDLE_H,
          pointerEvents: "none", zIndex: 2, opacity: 0,
          filter: "drop-shadow(0 15px 40px rgba(124,255,239,0.28)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          transition: "opacity 0.4s ease",
          willChange: "left, top, transform",
        }}
      >
        <TransparentCandle src="/candle-green.png" />
      </div>

      {/* Candle 2 — Gemini 2 (bigger) */}
      <div
        ref={c2Ref}
        style={{
          position: "absolute", width: CANDLE_W, height: CANDLE_H,
          pointerEvents: "none", zIndex: 2, opacity: 0,
          filter: "drop-shadow(0 15px 40px rgba(124,255,239,0.28)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          transition: "opacity 0.4s ease",
          willChange: "left, top, transform",
        }}
      >
        <TransparentCandle src="/gemini-image-2.png" />
      </div>

      {/* Candle 3 — Gemini 3 */}
      <div
        ref={c3Ref}
        style={{
          position: "absolute", width: CANDLE_W, height: CANDLE_H,
          pointerEvents: "none", zIndex: 2, opacity: 0,
          filter: "drop-shadow(0 15px 40px rgba(124,255,239,0.28)) drop-shadow(0 5px 15px rgba(0,0,0,0.35))",
          transition: "opacity 0.4s ease",
          willChange: "left, top, transform",
        }}
      >
        <TransparentCandle src="/gemini-image-3.png" />
      </div>
    </>
  );
}

/* ─── Main section ─── */
export default function ScrollShowcase() {
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      // Heading blur-in
      gsap.fromTo(".ss-ey", { opacity: 0, y: 20, letterSpacing: "8px", filter: "blur(8px)" },
        { opacity: 1, y: 0, letterSpacing: "3px", filter: "blur(0px)", duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ".ss-sec", start: "top 80%" } });
      gsap.fromTo(".ss-hd", { opacity: 0, y: 50, scale: 0.96, filter: "blur(10px)" },
        { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.2, ease: "power4.out",
          scrollTrigger: { trigger: ".ss-sec", start: "top 78%" } });

      // Cards staggered blur-in with 3D
      gsap.fromTo(".ss-card", { opacity: 0, y: 80, rotationX: -10, filter: "blur(6px)" },
        { opacity: 1, y: 0, rotationX: 0, filter: "blur(0px)", duration: 1, stagger: 0.15, ease: "power3.out",
          scrollTrigger: { trigger: ".ss-cards", start: "top 85%" } });

      // Floating elements parallax
      gsap.utils.toArray<HTMLElement>(".ss-fl").forEach((el, i) => {
        gsap.to(el, { y: -30 - i * 15, ease: "none",
          scrollTrigger: { trigger: ".ss-sec", start: "top bottom", end: "bottom top", scrub: 1.2 + i * 0.3 } });
      });
    };
    load();
  }, []);

  return (
    <section className="ss-sec" style={{ padding: "16rem 2rem 8rem", background: "transparent", position: "relative", overflow: "hidden" }}>
      {/* Scroll-driven neon line + candles */}
      <ScrollCandleCanvas />

      {/* Floating shapes */}
      <div className="ss-fl" style={{ position: "absolute", top: 60, right: 80, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: "radial-gradient(circle, rgba(255,255,255,0.03), transparent)" }} />
      <div className="ss-fl" style={{ position: "absolute", bottom: 100, left: 50, width: 100, height: 100, borderRadius: 20, transform: "rotate(45deg)", border: "1px solid rgba(255,255,255,0.08)", background: "radial-gradient(circle, rgba(255,255,255,0.02), transparent)" }} />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 3 }}>
        <div style={{ textAlign: "center", marginBottom: "5rem" }}>
          <span className="ss-ey" style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: "#7CFFEF", letterSpacing: "3px", textTransform: "uppercase", display: "block", marginBottom: "1rem" }}>Scroll-Driven Experience</span>
          <h2 className="ss-hd" style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(32px, 5vw, 60px)", color: "#FFFFFF", letterSpacing: "-2px", lineHeight: 1.05 }}>
            Every scroll tells<br />
            <span style={{ background: "linear-gradient(135deg, #7CFFEF, #45E180)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>a story</span>
          </h2>
        </div>

        <div className="ss-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, perspective: 1200 }}>
          {FEATURES.map((f) => <PremiumCard key={f.title} feature={f} />)}
        </div>
      </div>
    </section>
  );
}

function PremiumCard({ feature }: { feature: typeof FEATURES[0] }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 10;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -10;
    el.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) scale3d(1.02,1.02,1.02)`;
    el.style.boxShadow = "0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(124,255,239,0.15)";
    const sh = el.querySelector(".ss-sh") as HTMLElement;
    if (sh) sh.style.background = `radial-gradient(250px at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(124,255,239,0.08), transparent)`;
  };
  const handleLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)";
    el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.15)";
  };

  return (
    <div ref={ref} className="ss-card" onMouseMove={handleMove} onMouseLeave={handleLeave} style={{
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: "2.25rem",
      position: "relative", overflow: "hidden", transition: "transform 0.12s ease, box-shadow 0.4s ease",
      transformStyle: "preserve-3d", cursor: "default", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", backdropFilter: "blur(16px)",
    }}>
      <div className="ss-sh" style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", zIndex: 1 }} />
      <div style={{ width: 52, height: 52, borderRadius: 16, background: feature.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: "1.4rem", boxShadow: "0 6px 20px rgba(0,0,0,0.08)", transform: "translateZ(15px)" }}>
        {feature.icon}
      </div>
      <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: "#FFFFFF", marginBottom: "0.75rem", letterSpacing: "-0.3px", transform: "translateZ(8px)" }}>{feature.title}</h3>
      <p style={{ fontFamily: FONT, fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.8, transform: "translateZ(4px)" }}>{feature.desc}</p>
      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 2, background: feature.gradient, borderRadius: 2, opacity: 0.4 }} />
    </div>
  );
}
