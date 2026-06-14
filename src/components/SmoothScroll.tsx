"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 2.2, // Premium scroll duration for a highly luxurious, silky deceleration curve
      easing: (t: number) => 1 - Math.pow(1 - t, 4), // Quartic ease-out: extremely soft, natural decay
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.92, // Smooths out harsh scroll inputs
      touchMultiplier: 1.25,
      autoRaf: false, // Prevent loop collisions by letting GSAP drive the loop exclusively
    });

    lenisRef.current = lenis;

    let tickFunc: ((time: number) => void) | null = null;
    let activeGsap: any = null;

    
    const initGSAP = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
      activeGsap = gsap;

      lenis.on("scroll", ScrollTrigger.update);
      tickFunc = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(tickFunc);
      gsap.ticker.lagSmoothing(0);
    };
    initGSAP();

    return () => {
      lenis.destroy();
      lenisRef.current = null;
      if (activeGsap && tickFunc) {
        activeGsap.ticker.remove(tickFunc);
      }
    };
  }, []);

  return <>{children}</>;
}
