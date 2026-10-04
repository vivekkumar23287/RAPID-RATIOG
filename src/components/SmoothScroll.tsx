"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    let isMounted = true;
    let tickFunc: ((time: number) => void) | null = null;
    let activeGsap: any = null;

    const lenis = new Lenis({
      duration: 2.2,
      easing: (t: number) => 1 - Math.pow(1 - t, 4),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.25,
      autoRaf: false,
    });

    lenisRef.current = lenis;

    const initGSAP = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");

      if (!isMounted) return;

      gsap.registerPlugin(ScrollTrigger);
      activeGsap = gsap;

      lenis.on("scroll", ScrollTrigger.update);
      tickFunc = (time: number) => {
        if (lenisRef.current) {
          lenis.raf(time * 1000);
        }
      };
      gsap.ticker.add(tickFunc);
      gsap.ticker.lagSmoothing(0);
    };

    initGSAP();

    return () => {
      isMounted = false;
      lenis.destroy();
      lenisRef.current = null;
      if (activeGsap && tickFunc) {
        activeGsap.ticker.remove(tickFunc);
      }
    };
  }, []);

  return <>{children}</>;
}
