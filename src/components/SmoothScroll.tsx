"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t: number) => 1 - Math.pow(1 - t, 4), // Quartic ease-out: extremely soft, luxury-grade natural decay
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.2,
    });

    lenisRef.current = lenis;

    // Integrate with GSAP ScrollTrigger
    const initGSAP = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((time: number) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    };
    initGSAP();

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
