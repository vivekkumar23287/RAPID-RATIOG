"use client";
import { useEffect, useRef, useCallback } from "react";

/*
  Equiduct-inspired animated gradient background.
  
  From the actual screenshot:
    - Base: Deep teal (#0C4A6E → #0E7490) 
    - Large flowing blobs of cyan (#06B6D4), turquoise (#14B8A6), 
      bright teal (#2DD4BF), green (#45E180), sky blue (#38BDF8),
      and deeper blue (#1D4ED8) areas
    - Very large, soft blobs that move slowly across the entire viewport
    - The background is BRIGHT/VIBRANT, not dark
    - Colors shift subtly as user scrolls
*/

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  r: number;
  g: number;
  b: number;
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
      // Large bright cyan blob (top-left area)
      { x: w * 0.15, y: h * 0.2, vx: 0.25, vy: 0.15, radius: baseRadius * 0.55,
        r: 6, g: 182, b: 212, opacity: 0.7, baseOpacity: 0.7, phase: 0 },
      // Turquoise/teal blob (center-right)
      { x: w * 0.7, y: h * 0.35, vx: -0.2, vy: 0.2, radius: baseRadius * 0.5,
        r: 20, g: 184, b: 166, opacity: 0.65, baseOpacity: 0.65, phase: 0.2 },
      // Bright green-teal blob (bottom area)
      { x: w * 0.4, y: h * 0.75, vx: 0.3, vy: -0.15, radius: baseRadius * 0.45,
        r: 45, g: 212, b: 191, opacity: 0.6, baseOpacity: 0.6, phase: 0.4 },
      // Sky blue blob (top-right)
      { x: w * 0.85, y: h * 0.15, vx: -0.15, vy: 0.25, radius: baseRadius * 0.48,
        r: 56, g: 189, b: 248, opacity: 0.55, baseOpacity: 0.55, phase: 0.6 },
      // Deep blue blob (left side)
      { x: w * 0.1, y: h * 0.6, vx: 0.2, vy: -0.1, radius: baseRadius * 0.42,
        r: 29, g: 78, b: 216, opacity: 0.5, baseOpacity: 0.5, phase: 0.15 },
      // Green accent blob  
      { x: w * 0.55, y: h * 0.5, vx: -0.25, vy: -0.2, radius: baseRadius * 0.38,
        r: 69, g: 225, b: 128, opacity: 0.45, baseOpacity: 0.45, phase: 0.75 },
      // Light cyan highlight (moves fast)
      { x: w * 0.3, y: h * 0.3, vx: 0.35, vy: 0.25, radius: baseRadius * 0.35,
        r: 103, g: 232, b: 249, opacity: 0.5, baseOpacity: 0.5, phase: 0.5 },
      // Deep teal base blob (large, slow)
      { x: w * 0.5, y: h * 0.9, vx: 0.1, vy: -0.08, radius: baseRadius * 0.6,
        r: 14, g: 116, b: 144, opacity: 0.6, baseOpacity: 0.6, phase: 0.85 },
      // Warm teal
      { x: w * 0.9, y: h * 0.7, vx: -0.18, vy: -0.12, radius: baseRadius * 0.4,
        r: 8, g: 145, b: 178, opacity: 0.5, baseOpacity: 0.5, phase: 0.35 },
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
      // Re-init blobs on resize for proper sizing
      initBlobs(w, h);
    };
    resize();

    const onScroll = () => { scrollRef.current = window.scrollY; };
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });

    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      const docHeight = Math.max(1, document.documentElement.scrollHeight - h);
      const scrollProgress = Math.min(scrollRef.current / docHeight, 1);

      // Base gradient background — deep teal
      const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
      grad.addColorStop(0, "#0C4A6E");   // deep dark teal
      grad.addColorStop(0.4, "#0E7490"); // mid teal
      grad.addColorStop(0.7, "#0891B2"); // brighter cyan
      grad.addColorStop(1, "#0C4A6E");   // back to deep
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Update & draw blobs
      blobsRef.current.forEach((blob, i) => {
        // Organic drift using sine/cosine
        blob.x += blob.vx + Math.sin(t * 0.5 + i * 1.3) * 0.5;
        blob.y += blob.vy + Math.cos(t * 0.4 + i * 1.7) * 0.4;

        // Wrap around edges smoothly
        const margin = blob.radius * 0.5;
        if (blob.x < -margin) blob.x = w + margin;
        if (blob.x > w + margin) blob.x = -margin;
        if (blob.y < -margin) blob.y = h + margin;
        if (blob.y > h + margin) blob.y = -margin;

        // Gentle mouse repulsion
        const dx = mouseRef.current.x - blob.x;
        const dy = mouseRef.current.y - blob.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300 && dist > 0) {
          blob.x -= dx * 0.002;
          blob.y -= dy * 0.002;
        }

        // Scroll-based opacity wave — creates shifting colors on scroll
        const scrollWave = Math.sin((scrollProgress * Math.PI * 4) + blob.phase * Math.PI * 2 + t * 0.2);
        const opacityMod = 0.5 + 0.5 * scrollWave;
        blob.opacity = blob.baseOpacity * (0.4 + 0.6 * opacityMod);

        // Breathing / pulse
        const pulseScale = 1 + 0.1 * Math.sin(t * 0.6 + i * 0.9);
        const currentRadius = blob.radius * pulseScale;

        // Draw the blob as an organic, morphing fluid shape instead of a perfect circle!
        ctx.beginPath();
        const steps = 60;
        for (let j = 0; j <= steps; j++) {
          const angle = (j / steps) * Math.PI * 2;
          
          // Superimposed sine/cosine waves for fluid organic shape morphing
          const wave1 = Math.sin(angle * 3 + t * 1.5 + i * 2.3) * 0.18;
          const wave2 = Math.cos(angle * 5 - t * 1.0 + i * 1.7) * 0.12;
          const wave3 = Math.sin(angle * 2 + t * 2.4 - i * 3.1) * 0.08;
          
          // Calculate the dynamic, morphed radius at this angle
          const rad = currentRadius * (1 + wave1 + wave2 + wave3);
          
          const px = blob.x + Math.cos(angle) * rad;
          const py = blob.y + Math.sin(angle) * rad;
          
          if (j === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();

        // Shifting light center inside the liquid blob for 3D liquid highlight
        const gradX = blob.x + Math.sin(t * 0.6 + i) * currentRadius * 0.15;
        const gradY = blob.y + Math.cos(t * 0.5 - i * 1.5) * currentRadius * 0.15;

        const gradient = ctx.createRadialGradient(
          gradX, gradY, 0,
          gradX, gradY, currentRadius * 1.25
        );
        gradient.addColorStop(0,   `rgba(${blob.r}, ${blob.g}, ${blob.b}, ${blob.opacity * 0.85})`);
        gradient.addColorStop(0.3, `rgba(${blob.r}, ${blob.g}, ${blob.b}, ${blob.opacity * 0.65})`);
        gradient.addColorStop(0.6, `rgba(${blob.r}, ${blob.g}, ${blob.b}, ${blob.opacity * 0.3})`);
        gradient.addColorStop(1,   `rgba(${blob.r}, ${blob.g}, ${blob.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Bright center highlight — gives that glowing center feel
      const centerGlow = ctx.createRadialGradient(
        w * 0.45 + Math.sin(t * 0.3) * 50,
        h * 0.4 + Math.cos(t * 0.25) * 40,
        0,
        w * 0.45, h * 0.4, w * 0.4
      );
      centerGlow.addColorStop(0, `rgba(103, 232, 249, ${0.15 + 0.05 * Math.sin(t)})`);
      centerGlow.addColorStop(0.5, "rgba(20, 184, 166, 0.05)");
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
