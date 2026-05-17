"use client";
import { useEffect, useRef } from "react";

const ROW1 = ["Smooth Scroll Animation","3D Animated Website","JavaScript Scroll Effect","CSS Scroll Animation","Website Design Tutorial","Smooth Scrolling JavaScript","CSS 3D Effects"];
const ROW2 = ["Interactive Website Design","Web Animation Tutorial","Frontend Web Development","HTML CSS JavaScript","Web Development for Beginners","Scroll Down Animation","UI/UX Design Animation"];
const FONT = "Satoshi, sans-serif";

export default function MarqueeSection() {
  const r1 = useRef<HTMLDivElement>(null);
  const r2 = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const load = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      if (!section || !r1.current || !r2.current) return;

      // Row 1: moves LEFT when scrolling down, RIGHT when scrolling up
      gsap.fromTo(r1.current,
        { x: "1%" },
        {
          x: "-4%",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 2.5,       // very smooth, luxury slow coupling
            invalidateOnRefresh: true,
          },
        }
      );

      // Row 2: moves RIGHT when scrolling down, LEFT when scrolling up (opposite)
      gsap.fromTo(r2.current,
        { x: "-4%" },
        {
          x: "1%",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            scrub: 2.5,
            invalidateOnRefresh: true,
          },
        }
      );

      // Section fade-in
      gsap.fromTo(section,
        { opacity: 0.3 },
        {
          opacity: 1,
          duration: 0.6,
          scrollTrigger: { trigger: section, start: "top 92%" },
        }
      );

      // Skew effect based on scroll velocity
      let skewProxy = { skew: 0 };
      let clamp = gsap.utils.clamp(-4, 4);

      ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          let skew = clamp(self.getVelocity() / -200);
          if (Math.abs(skew) > Math.abs(skewProxy.skew)) {
            skewProxy.skew = skew;
            gsap.to(skewProxy, {
              skew: 0,
              duration: 0.8,
              ease: "power3.out",
              overwrite: true,
              onUpdate: () => {
                if (r1.current) r1.current.style.transform = `${r1.current.style.transform?.split('skewX')[0] || ''} skewX(${skewProxy.skew}deg)`.replace(/\s+/g, ' ').trim();
                if (r2.current) r2.current.style.transform = `${r2.current.style.transform?.split('skewX')[0] || ''} skewX(${skewProxy.skew}deg)`.replace(/\s+/g, ' ').trim();
              },
            });
          }
        },
      });
    };
    load();
  }, []);

  const renderWord = (word: string, i: number, highlighted: boolean) => (
    <span key={`${word}-${i}`} style={{
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: "clamp(28px, 4vw, 48px)",
      color: highlighted ? "#E01F2E" : "rgba(255,255,255,0.07)",
      whiteSpace: "nowrap",
      letterSpacing: "-1px",
      textShadow: highlighted ? "0 0 40px rgba(224,31,46,0.3)" : "none",
      transition: "color 0.3s ease",
    }}>
      {word}
      <span style={{
        display: "inline-block",
        margin: "0 18px",
        color: highlighted ? "rgba(224,31,46,0.3)" : "rgba(255,255,255,0.05)",
        fontSize: "0.5em",
        verticalAlign: "middle",
      }}>✦</span>
    </span>
  );

  return (
    <section ref={sectionRef} className="mq-sec" style={{
      padding: "5.5rem 0",
      background: "#0F2044",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Dot pattern */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(224,31,46,0.06) 1px, transparent 1px)",
        backgroundSize: "30px 30px",
      }} />

      {/* Center glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: 600, height: 280, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(224,31,46,0.14), transparent 70%)",
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      {/* Row 1 */}
      <div style={{ overflow: "hidden", marginBottom: 20 }}>
        <div ref={r1} style={{
          display: "flex",
          gap: 0,
          width: "max-content",
          willChange: "transform",
        }}>
          {[...ROW1, ...ROW1, ...ROW1, ...ROW1].map((w, i) =>
            renderWord(w, i, i % 2 !== 0)
          )}
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ overflow: "hidden" }}>
        <div ref={r2} style={{
          display: "flex",
          gap: 0,
          width: "max-content",
          willChange: "transform",
        }}>
          {[...ROW2, ...ROW2, ...ROW2, ...ROW2].map((w, i) =>
            renderWord(w, i, i % 2 === 0)
          )}
        </div>
      </div>
    </section>
  );
}
