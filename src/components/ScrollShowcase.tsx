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
    <section className="ss-sec" style={{ padding: "8rem 2rem", background: "#FFFFFF", position: "relative", overflow: "hidden" }}>
      {/* Floating shapes */}
      <div className="ss-fl" style={{ position: "absolute", top: 60, right: 80, width: 160, height: 160, borderRadius: "50%", border: "1px solid rgba(224,31,46,0.08)", background: "radial-gradient(circle, rgba(224,31,46,0.03), transparent)" }} />
      <div className="ss-fl" style={{ position: "absolute", bottom: 100, left: 50, width: 100, height: 100, borderRadius: 20, transform: "rotate(45deg)", border: "1px solid rgba(15,32,68,0.05)", background: "radial-gradient(circle, rgba(15,32,68,0.02), transparent)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(14,32,68,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(14,32,68,0.018) 1px, transparent 1px)", backgroundSize: "52px 52px" }} />

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "5rem" }}>
          <span className="ss-ey" style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: "#E01F2E", letterSpacing: "3px", textTransform: "uppercase", display: "block", marginBottom: "1rem" }}>Scroll-Driven Experience</span>
          <h2 className="ss-hd" style={{ fontFamily: FONT, fontWeight: 800, fontSize: "clamp(32px, 5vw, 60px)", color: "#0F2044", letterSpacing: "-2px", lineHeight: 1.05 }}>
            Every scroll tells<br />
            <span style={{ background: "linear-gradient(135deg, #E01F2E, #FF6B7A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>a story</span>
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
    el.style.boxShadow = "0 20px 60px rgba(15,32,68,0.1), 0 0 0 1px rgba(224,31,46,0.1)";
    const sh = el.querySelector(".ss-sh") as HTMLElement;
    if (sh) sh.style.background = `radial-gradient(250px at ${e.clientX - r.left}px ${e.clientY - r.top}px, rgba(224,31,46,0.08), transparent)`;
  };
  const handleLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)";
    el.style.boxShadow = "0 4px 24px rgba(15,32,68,0.05)";
  };

  return (
    <div ref={ref} className="ss-card" onMouseMove={handleMove} onMouseLeave={handleLeave} style={{
      background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 24, padding: "2.25rem",
      position: "relative", overflow: "hidden", transition: "transform 0.12s ease, box-shadow 0.4s ease",
      transformStyle: "preserve-3d", cursor: "default", boxShadow: "0 4px 24px rgba(15,32,68,0.05)",
    }}>
      <div className="ss-sh" style={{ position: "absolute", inset: 0, borderRadius: 24, pointerEvents: "none", zIndex: 1 }} />
      <div style={{ width: 52, height: 52, borderRadius: 16, background: feature.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: "1.4rem", boxShadow: "0 6px 20px rgba(0,0,0,0.08)", transform: "translateZ(15px)" }}>
        {feature.icon}
      </div>
      <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: "#0F2044", marginBottom: "0.75rem", letterSpacing: "-0.3px", transform: "translateZ(8px)" }}>{feature.title}</h3>
      <p style={{ fontFamily: FONT, fontSize: 14, color: "#64748B", lineHeight: 1.8, transform: "translateZ(4px)" }}>{feature.desc}</p>
      <div style={{ position: "absolute", bottom: 0, left: "10%", right: "10%", height: 2, background: feature.gradient, borderRadius: 2, opacity: 0.4 }} />
    </div>
  );
}
