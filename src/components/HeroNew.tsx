"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowRight, TrendUp, Lightning } from "@phosphor-icons/react";
import { SignUpButton } from "@clerk/nextjs";

const WORDS = ["Intelligence.", "Precision.", "Speed.", "Clarity.", "Power."];
const FONT = "Satoshi, sans-serif";

export default function HeroNew() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordRef = useRef<HTMLSpanElement>(null);
  const wordIdx = useRef(0);
  const mouse = useRef({ x: 0, y: 0 });
  const auroraRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for aurora + particles
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (auroraRef.current) {
        auroraRef.current.style.background = `radial-gradient(600px at ${e.clientX}px ${e.clientY}px, rgba(224,31,46,0.06), transparent 70%)`;
      }
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
    for (let i = 0; i < 60; i++) pts.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, r: Math.random()*1.5+0.5, o: Math.random()*0.35+0.05 });
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
        ctx.fillStyle = `rgba(224,31,46,${p.o})`; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(p.x - pts[j].x, p.y - pts[j].y);
          if (d < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `rgba(224,31,46,${0.04*(1-d/100)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
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
    const run = async () => {
      const { gsap } = await import("gsap");
      el.textContent = WORDS[0]; gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)" });
      const cycle = () => {
        gsap.to(el, { opacity: 0, y: -20, filter: "blur(8px)", duration: 0.4, ease: "power2.in", onComplete: () => {
          wordIdx.current = (wordIdx.current + 1) % WORDS.length;
          el.textContent = WORDS[wordIdx.current];
          gsap.fromTo(el, { opacity: 0, y: 24, filter: "blur(8px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out" });
        }});
      };
      const iv = setInterval(cycle, 2800);
      return () => clearInterval(iv);
    };
    run();
  }, []);

  // GSAP cinematic entrance + scroll parallax
  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      const els = [".hn-badge",".hn-l1",".hn-l2",".hn-sub",".hn-b1",".hn-b2",".hn-stat",".hn-mock"];
      gsap.set(els, { opacity: 0 });
      gsap.set(".hn-badge", { y: -30, scale: 0.9, filter: "blur(10px)" });
      gsap.set([".hn-l1",".hn-l2"], { y: 80, skewY: 2, filter: "blur(6px)" });
      gsap.set(".hn-sub", { y: 40, filter: "blur(4px)" });
      gsap.set([".hn-b1",".hn-b2"], { y: 30, scale: 0.95 });
      gsap.set(".hn-stat", { y: 24, filter: "blur(4px)" });
      gsap.set(".hn-mock", { x: 100, rotationY: -15, scale: 0.9, filter: "blur(8px)" });

      const tl = gsap.timeline({ delay: 0.3, defaults: { ease: "power4.out" } });
      tl.to(".hn-badge", { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.8 })
        .to(".hn-l1", { opacity: 1, y: 0, skewY: 0, filter: "blur(0px)", duration: 1.1 }, "-=0.5")
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
      gsap.to(".hn-aurora", { scale: 1.3, opacity: 0, ease: "none", scrollTrigger: { trigger: ".hn-sec", start: "top top", end: "bottom top", scrub: 1 } });
    };
    load();
  }, []);

  return (
    <section ref={sectionRef} className="hn-sec" style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "linear-gradient(160deg, #FFFFFF 0%, #EEF2FF 40%, #FEE8EA 100%)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <canvas ref={canvasRef} className="hn-canvas" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* Aurora mouse-follow */}
      <div ref={auroraRef} className="hn-aurora" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", transition: "background 0.3s ease" }} />

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(14,32,68,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(14,32,68,0.025) 1px, transparent 1px)", backgroundSize: "64px 64px", zIndex: 0 }} />

      {/* Gradient orbs */}
      <div style={{ position: "absolute", top: "5%", right: "8%", width: 500, height: 500, background: "radial-gradient(circle, rgba(224,31,46,0.1) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(60px)", animation: "auroraGlow 12s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "3%", width: 400, height: 400, background: "radial-gradient(circle, rgba(15,32,68,0.06) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(50px)", animation: "auroraGlow 15s ease-in-out infinite reverse" }} />

      {/* Content */}
      <div className="hn-grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "130px 2rem 0", position: "relative", zIndex: 1, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
        <div className="hn-left">
          {/* Badge */}
          <div className="hn-badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(224,31,46,0.06)", border: "1px solid rgba(224,31,46,0.15)", borderRadius: 100, padding: "7px 18px 7px 12px", marginBottom: "2rem", backdropFilter: "blur(8px)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E01F2E", animation: "subtleGlow 2s ease-in-out infinite", boxShadow: "0 0 8px rgba(224,31,46,0.4)" }} />
            <Lightning size={13} color="#E01F2E" weight="fill" />
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: "#E01F2E", letterSpacing: "0.3px" }}>Live market data · Updated in real time</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(44px, 6vw, 88px)", lineHeight: 1, color: "#0F2044", letterSpacing: "-2.5px", marginBottom: "1.5rem", maxWidth: 620 }}>
            <div className="hn-l1">Trade with</div>
            <div className="hn-l2" style={{ color: "#E01F2E" }}><span ref={wordRef} style={{ display: "inline-block" }} /></div>
          </h1>

          <p className="hn-sub" style={{ fontFamily: FONT, fontSize: "clamp(15px, 1.8vw, 19px)", fontWeight: 400, color: "#64748B", lineHeight: 1.75, maxWidth: 500, marginBottom: "2.5rem" }}>
            All your favourite Indian stocks and global cryptocurrencies — live prices, interactive charts, and integrated Excel sheets — in one powerful platform.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: "3.5rem" }}>
            <SignUpButton mode="modal">
              <MagneticButton className="hn-b1" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #E01F2E 0%, #B8161F 100%)", color: "white", border: "none", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 24px rgba(224,31,46,0.3), inset 0 1px 0 rgba(255,255,255,0.15)", transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
                Start for free <ArrowRight size={17} weight="bold" />
              </MagneticButton>
            </SignUpButton>
            <MagneticButton as="a" href="/prices" className="hn-b2" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", color: "#0F2044", border: "1.5px solid #E2E8F0", borderRadius: 14, padding: "15px 30px", fontFamily: FONT, fontWeight: 500, fontSize: 15, cursor: "pointer", textDecoration: "none", backdropFilter: "blur(12px)", transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              <TrendUp size={17} /> View live prices
            </MagneticButton>
          </div>

          {/* Stats with count-up */}
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap" }}>
            {[{ label: "Assets tracked", value: "10+" }, { label: "Data delay", value: "Real-time" }, { label: "Excel export", value: "Free" }].map(s => (
              <div key={s.label} className="hn-stat">
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: "#E01F2E", lineHeight: 1, letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: "#94A3B8", marginTop: 5, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — 3D mockup */}
        <div className="hn-mock" style={{ perspective: 1200 }}>
          <TiltCard />
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animation: "premiumFloat 3s ease-in-out infinite" }}>
        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "3px", textTransform: "uppercase" }}>Scroll</span>
        <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, #E01F2E, transparent)", borderRadius: 1 }} />
      </div>

      <style>{`
        @media(max-width:900px){.hn-grid{grid-template-columns:1fr!important}.hn-mock{display:none!important}}
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
    el.style.boxShadow = Tag === "button" ? "0 8px 32px rgba(224,31,46,0.45)" : "none";
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

/* 3D Tilt Card */
function TiltCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: 50, y: 50 });
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${y * -12}deg) rotateY(${x * 12}deg) scale3d(1.02,1.02,1.02)`;
    setGlow({ x: (x + 0.5) * 100, y: (y + 0.5) * 100 });
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.transform = "rotateX(0) rotateY(0) scale3d(1,1,1)";
    setGlow({ x: 50, y: 50 });
  }, []);

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{
      transition: "transform 0.15s ease", transformStyle: "preserve-3d",
      background: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px) saturate(180%)",
      borderRadius: 24, border: "1px solid rgba(226,232,240,0.7)", padding: "1.75rem",
      boxShadow: "0 32px 80px rgba(15,32,68,0.1), 0 4px 16px rgba(224,31,46,0.04)",
      animation: "premiumFloat 8s ease-in-out infinite", position: "relative",
    }}>
      {/* Glow follow */}
      <div style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", background: `radial-gradient(400px at ${glow.x}% ${glow.y}%, rgba(224,31,46,0.06), transparent)`, transition: "background 0.15s ease" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: "#0F2044" }}>POLYCAB INDIA</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: "#94A3B8", marginTop: 2 }}>NSE · Live</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: "#0F2044", letterSpacing: "-0.5px" }}>₹5,890</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#DCFCE7", color: "#16A34A", borderRadius: 100, padding: "2px 10px", fontSize: 12, fontWeight: 700, fontFamily: FONT, marginTop: 4 }}>▲ +2.18%</div>
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem", position: "relative", zIndex: 1 }}>
        <svg viewBox="0 0 420 100" style={{ width: "100%", height: 90, overflow: "visible" }}>
          <defs>
            <linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E01F2E" stopOpacity="0.15" /><stop offset="100%" stopColor="#E01F2E" stopOpacity="0" /></linearGradient>
          </defs>
          <path d="M0,80 L40,70 L80,60 L120,50 L160,55 L200,35 L240,40 L280,25 L320,30 L360,15 L400,10 L420,8 L420,100 L0,100Z" fill="url(#hcg)" />
          <path d="M0,80 L40,70 L80,60 L120,50 L160,55 L200,35 L240,40 L280,25 L320,30 L360,15 L400,10 L420,8" fill="none" stroke="#E01F2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="420" strokeDashoffset="420" style={{ animation: "lineDraw 2s ease-out 1s forwards" }} />
          <circle cx="420" cy="8" r="3.5" fill="#E01F2E" style={{ animation: "blurIn 0.4s ease 2.8s both" }} />
          <circle cx="420" cy="8" r="8" fill="rgba(224,31,46,0.15)" style={{ animation: "blurIn 0.4s ease 2.8s both" }} />
        </svg>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, position: "relative", zIndex: 1 }}>
        {[{ l: "Open", v: "₹5,760" }, { l: "High", v: "₹5,920" }, { l: "Volume", v: "2.4M" }].map(s => (
          <div key={s.l} style={{ background: "#F8F9FC", borderRadius: 10, padding: 10, border: "1px solid #F1F5F9" }}>
            <div style={{ fontFamily: FONT, fontSize: 10, color: "#94A3B8", fontWeight: 500, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: "#0F2044" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Badge */}
      <div style={{ position: "absolute", top: -18, right: 16, background: "#0F2044", borderRadius: 12, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 8px 24px rgba(15,32,68,0.25)", animation: "premiumFloat 6s ease-in-out 1s infinite", zIndex: 2 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: "white" }}>Live · NSE</span>
      </div>
    </div>
  );
}
