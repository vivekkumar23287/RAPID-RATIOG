"use client";
import { useEffect, useRef, useCallback } from "react";

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  r1: number; g1: number; b1: number; 
  r2: number; g2: number; b2: number; 
  r3: number; g3: number; b3: number; 
  r4: number; g4: number; b4: number; 
  opacity: number;
  baseOpacity: number;
  phase: number;
}

export default function EquiductBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const scrollRef = useRef(0);
  const blobsRef = useRef<Blob[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  const initBlobs = useCallback((w: number, h: number) => {
    const baseRadius = Math.min(w, h);
    const blobs: Blob[] = [
      
      { x: w * 0.15, y: h * 0.2, vx: 0.25, vy: 0.15, radius: baseRadius * 0.55,
        r1: 6, g1: 182, b1: 212, r2: 13, g2: 148, b2: 136, r3: 56, g3: 189, b3: 248, r4: 217, g4: 119, b4: 6, opacity: 0.7, baseOpacity: 0.7, phase: 0 },
      
      { x: w * 0.7, y: h * 0.35, vx: -0.2, vy: 0.2, radius: baseRadius * 0.5,
        r1: 20, g1: 184, b1: 166, r2: 20, g2: 110, b2: 80, r3: 96, g3: 165, b3: 250, r4: 245, g4: 158, b4: 11, opacity: 0.65, baseOpacity: 0.65, phase: 0.2 },
      
      { x: w * 0.4, y: h * 0.75, vx: 0.3, vy: -0.15, radius: baseRadius * 0.45,
        r1: 45, g1: 212, b1: 191, r2: 16, g2: 185, b2: 129, r3: 129, g3: 140, b3: 248, r4: 251, g4: 191, b4: 36, opacity: 0.6, baseOpacity: 0.6, phase: 0.4 },
      
      { x: w * 0.85, y: h * 0.15, vx: -0.15, vy: 0.25, radius: baseRadius * 0.48,
        r1: 56, g1: 189, b1: 248, r2: 8, g2: 145, b2: 178, r3: 147, g3: 197, b3: 253, r4: 252, g4: 211, b4: 77, opacity: 0.55, baseOpacity: 0.55, phase: 0.6 },
      
      { x: w * 0.1, y: h * 0.6, vx: 0.2, vy: -0.1, radius: baseRadius * 0.42,
        r1: 29, g1: 78, b1: 216, r2: 6, g2: 95, b2: 70, r3: 37, g3: 99, b3: 235, r4: 202, g4: 138, b4: 4, opacity: 0.5, baseOpacity: 0.5, phase: 0.15 },
      
      { x: w * 0.55, y: h * 0.5, vx: -0.25, vy: -0.2, radius: baseRadius * 0.38,
        r1: 69, g1: 225, b1: 128, r2: 45, g2: 212, b2: 191, r3: 29, g3: 78, b3: 216, r4: 234, g4: 179, b4: 8, opacity: 0.45, baseOpacity: 0.45, phase: 0.75 },
      
      { x: w * 0.3, y: h * 0.3, vx: 0.35, vy: 0.25, radius: baseRadius * 0.35,
        r1: 103, g1: 232, b1: 249, r2: 4, g2: 120, b2: 87, r3: 103, g3: 232, b3: 249, r4: 253, g4: 224, b4: 71, opacity: 0.5, baseOpacity: 0.5, phase: 0.5 },
      
      { x: w * 0.5, y: h * 0.9, vx: 0.1, vy: -0.08, radius: baseRadius * 0.6,
        r1: 14, g1: 116, b1: 144, r2: 2, g2: 44, b2: 34, r3: 15, g3: 32, b3: 84, r4: 120, g4: 53, b4: 4, opacity: 0.6, baseOpacity: 0.6, phase: 0.85 },
      
      { x: w * 0.9, y: h * 0.7, vx: -0.18, vy: -0.12, radius: baseRadius * 0.4,
        r1: 8, g1: 145, b1: 178, r2: 15, g2: 118, b2: 110, r3: 59, g3: 130, b3: 246, r4: 146, g4: 64, b4: 14, opacity: 0.5, baseOpacity: 0.5, phase: 0.35 },
    ];
    blobsRef.current = blobs;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      initBlobs(w, h);
    };
    resize();

    const onScroll = () => { scrollRef.current = window.scrollY; };
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });

    
    const screen1Stops = [
      [10, 126, 140], // vibrant Equiduct cyan
      [20, 160, 150], // bright turquoise
      [6, 170, 190],  // glowing sky teal
      [10, 126, 140]
    ];

    
    const screen2Stops = [
      [6, 75, 62],    // deep Equiduct green
      [12, 90, 80],   // rich dark forest green
      [15, 110, 100], // deep teal green
      [6, 75, 62]
    ];

    
    const screen3Stops = [
      [15, 60, 140],  // lighter royal/sky blue (#0F3C8C)
      [28, 80, 180],  // mid-tone bright royal blue (#1C50B4)
      [40, 115, 230], // glowing sky blue highlight (#2873E6)
      [15, 60, 140]
    ];

    
    const screen5Stops = [
      [74, 46, 0],    // deep dark honey (#4A2E00)
      [99, 64, 0],    // rich dark amber (#634000)
      [163, 107, 0],  // glowing gold highlight (#A36B00)
      [74, 46, 0]
    ];

    const interpolateColor = (c1: number[], c2: number[], p: number) => {
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * p),
        Math.round(c1[1] + (c2[1] - c1[1]) * p),
        Math.round(c1[2] + (c2[2] - c1[2]) * p)
      ];
    };

    const rgbStr = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      
      
      const p1 = Math.min(Math.max(0, scrollRef.current / h), 1);
      
      
      const p2 = Math.min(Math.max(0, (scrollRef.current - h) / (h * 1.2)), 1);

      
      const p4 = Math.min(Math.max(0, (scrollRef.current - h * 3.4) / (h * 1.4)), 1);

      
      let stops;
      if (scrollRef.current <= h) {
        stops = screen1Stops.map((c, idx) => interpolateColor(c, screen2Stops[idx], p1));
      } else if (scrollRef.current <= h * 3.4) {
        stops = screen2Stops.map((c, idx) => interpolateColor(c, screen3Stops[idx], p2));
      } else {
        stops = screen3Stops.map((c, idx) => interpolateColor(c, screen5Stops[idx], p4));
      }

      const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
      grad.addColorStop(0, rgbStr(stops[0]));
      grad.addColorStop(0.4, rgbStr(stops[1]));
      grad.addColorStop(0.7, rgbStr(stops[2]));
      grad.addColorStop(1, rgbStr(stops[3]));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      
      blobsRef.current.forEach((blob, i) => {
        
        blob.x += blob.vx + Math.sin(t * 0.5 + i * 1.3) * 0.5;
        blob.y += blob.vy + Math.cos(t * 0.4 + i * 1.7) * 0.4;

        
        const margin = blob.radius * 0.5;
        if (blob.x < -margin) blob.x = w + margin;
        if (blob.x > w + margin) blob.x = -margin;
        if (blob.y < -margin) blob.y = h + margin;
        if (blob.y > h + margin) blob.y = -margin;

        
        const dx = mouseRef.current.x - blob.x;
        const dy = mouseRef.current.y - blob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300 && dist > 0) {
          blob.x -= dx * 0.002;
          blob.y -= dy * 0.002;
        }

        
        const activeProgress = scrollRef.current <= h ? p1 : (scrollRef.current <= h * 3.4 ? p2 : p4);
        const scrollWave = Math.sin((activeProgress * Math.PI * 4) + blob.phase * Math.PI * 2 + t * 0.2);
        const opacityMod = 0.5 + 0.5 * scrollWave;
        blob.opacity = blob.baseOpacity * (0.4 + 0.6 * opacityMod);

        
        const pulseScale = 1 + 0.1 * Math.sin(t * 0.6 + i * 0.9);
        const currentRadius = blob.radius * pulseScale;

        
        ctx.beginPath();
        const steps = 60;
        for (let j = 0; j <= steps; j++) {
          const angle = (j / steps) * Math.PI * 2;
          const wave1 = Math.sin(angle * 3 + t * 1.5 + i * 2.3) * 0.18;
          const wave2 = Math.cos(angle * 5 - t * 1.0 + i * 1.7) * 0.12;
          const wave3 = Math.sin(angle * 2 + t * 2.4 - i * 3.1) * 0.08;
          const rad = currentRadius * (1 + wave1 + wave2 + wave3);
          const px = blob.x + Math.cos(angle) * rad;
          const py = blob.y + Math.sin(angle) * rad;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        
        const gradX = blob.x + Math.sin(t * 0.6 + i) * currentRadius * 0.15;
        const gradY = blob.y + Math.cos(t * 0.5 - i * 1.5) * currentRadius * 0.15;

        
        let r, g, b;
        if (scrollRef.current <= h) {
          r = Math.round(blob.r1 + (blob.r2 - blob.r1) * p1);
          g = Math.round(blob.g1 + (blob.g2 - blob.g1) * p1);
          b = Math.round(blob.b1 + (blob.b2 - blob.b1) * p1);
        } else if (scrollRef.current <= h * 3.4) {
          r = Math.round(blob.r2 + (blob.r3 - blob.r2) * p2);
          g = Math.round(blob.g2 + (blob.g3 - blob.g2) * p2);
          b = Math.round(blob.b2 + (blob.b3 - blob.b2) * p2);
        } else {
          r = Math.round(blob.r3 + (blob.r4 - blob.r3) * p4);
          g = Math.round(blob.g3 + (blob.g4 - blob.g3) * p4);
          b = Math.round(blob.b3 + (blob.b4 - blob.b3) * p4);
        }

        const gradient = ctx.createRadialGradient(
          gradX, gradY, 0,
          gradX, gradY, currentRadius * 1.25
        );
        gradient.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${blob.opacity * 0.85})`);
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${blob.opacity * 0.65})`);
        gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${blob.opacity * 0.3})`);
        gradient.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fill();
      });

      
      const centerGlow = ctx.createRadialGradient(
        w * 0.45 + Math.sin(t * 0.3) * 50,
        h * 0.4 + Math.cos(t * 0.25) * 40,
        0,
        w * 0.45, h * 0.4, w * 0.4
      );
      
      const glowOpacity1 = 0.15 + 0.05 * Math.sin(t);
      const glowOpacity2 = 0.06 + 0.03 * Math.sin(t);
      const glowOpacity3 = 0.18 + 0.06 * Math.sin(t);
      const glowOpacity4 = 0.16 + 0.05 * Math.sin(t);

      let activeOpacity, glowR1, glowG1, glowB1;
      if (scrollRef.current <= h) {
        activeOpacity = glowOpacity1 + (glowOpacity2 - glowOpacity1) * p1;
        glowR1 = Math.round(103 + (15 - 103) * p1);
        glowG1 = Math.round(232 + (110 - 232) * p1);
        glowB1 = Math.round(249 + (100 - 249) * p1);
      } else if (scrollRef.current <= h * 3.4) {
        activeOpacity = glowOpacity2 + (glowOpacity3 - glowOpacity2) * p2;
        glowR1 = Math.round(15 + (22 - 15) * p2);
        glowG1 = Math.round(110 + (50 - 110) * p2);
        glowB1 = Math.round(100 + (255 - 100) * p2);
      } else {
        activeOpacity = glowOpacity3 + (glowOpacity4 - glowOpacity3) * p4;
        glowR1 = Math.round(22 + (167 - 22) * p4);
        glowG1 = Math.round(50 + (139 - 50) * p4);
        glowB1 = Math.round(255 + (250 - 255) * p4);
      }

      centerGlow.addColorStop(0, `rgba(${glowR1}, ${glowG1}, ${glowB1}, ${activeOpacity})`);
      if (scrollRef.current <= h) {
        centerGlow.addColorStop(0.5, `rgba(20, 184, 166, ${0.05 * (1 - p1)})`);
      } else if (scrollRef.current <= h * 3.4) {
        centerGlow.addColorStop(0.5, `rgba(22, 50, 100, ${0.06 * p2})`);
      } else {
        centerGlow.addColorStop(0.5, `rgba(139, 92, 246, ${0.06 * p4})`);
      }
      centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [initBlobs]);

  return (
    <canvas
      ref={canvasRef}
      id="equiduct-gradient-bg"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
