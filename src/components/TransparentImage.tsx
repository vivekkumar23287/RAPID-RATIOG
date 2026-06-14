"use client";

import { useEffect, useRef } from "react";

/**
 * TransparentImage — Canvas-based background removal component.
 * 
 * Strips checkerboard transparency patterns and neutral gray/white
 * background pixels from images so only the actual colorful subject 
 * (logos, icons, objects) is visible. The result blends seamlessly
 * with any website background.
 * 
 * Works by detecting pixels that lack color saturation (grays, whites)
 * and making them transparent, while preserving vibrant colored pixels.
 */
export default function TransparentImage({
  src,
  alt = "",
  style,
  className,
}: {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
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
        const a = data[i + 3];

        // Skip already transparent pixels
        if (a === 0) continue;

        // Calculate color properties
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min; // How "colorful" the pixel is
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        // Checkerboard patterns consist of alternating gray (~204) and white (~255) pixels.
        // Background artifacts are typically low-saturation (grayish/whitish).
        // We remove pixels with very low chroma (no strong color).
        
        if (chroma < 30) {
          // Very low color saturation — likely checkerboard/background
          // Pure white or near-white (brightness > 230) → transparent
          // Gray checkerboard (~192-210) → transparent
          // Dark gray/black → transparent (background shadows)
          if (brightness > 180 || brightness < 50) {
            data[i + 3] = 0; // Fully transparent
          } else {
            // Mid-range grays: soft fade based on distance from typical checkerboard values
            const checkerboardGray = Math.abs(brightness - 204);
            if (checkerboardGray < 25) {
              data[i + 3] = 0; // Checkerboard gray range
            } else {
              // Feather the edge
              const factor = Math.min(1, (chroma - 10) / 20);
              data[i + 3] = Math.floor(a * factor);
            }
          }
        } else if (chroma < 50) {
          // Slight color but mostly gray — likely edge artifacts or faint outlines
          // Apply smooth feathering
          const factor = (chroma - 30) / 20; // 0 at chroma=30, 1 at chroma=50
          data[i + 3] = Math.min(a, Math.floor(factor * 255));
        }
        // chroma >= 50: Keep pixel fully opaque (it has real color content)
      }

      ctx.putImageData(imageData, 0, 0);
    };
    img.src = src;
  }, [src]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={alt}
      className={className}
      style={{
        display: "block",
        objectFit: "contain",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/**
 * TransparentCandle — Specialized background removal for candlestick/crystal images.
 * 
 * Similar to TransparentImage but tuned for the semi-transparent glass/crystal 
 * candle objects that have a checkerboard pattern baked into the image background.
 * Preserves the vibrant cyan/green/blue glow of the candle subjects.
 */
export function TransparentCandle({ src }: { src: string }) {
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
        const a = data[i + 3];

        if (a === 0) continue;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        // For candle images: the subject has strong green/cyan/blue tones
        // Background is neutral gray checkerboard or dark neutral tones
        
        // How much green+blue exceeds red (the candle subject is cyan-dominated)
        const greenBlueExcess = Math.max(g - r, b - r);
        const colorfulness = Math.max(greenBlueExcess, r - Math.max(g, b));

        if (chroma < 25) {
          // Very neutral pixel — definitely background
          if (brightness > 230) {
            // Near-white: keep very bright highlights (glints on the crystal)
            const highlightAlpha = Math.max(0, Math.floor(((brightness - 240) / 15) * 200));
            data[i + 3] = Math.min(a, highlightAlpha);
          } else {
            data[i + 3] = 0;
          }
        } else if (chroma < 45 && colorfulness < 30) {
          // Low saturation and low colorfulness — likely background artifact
          const factor = Math.max(0, (chroma - 25) / 20);
          data[i + 3] = Math.min(a, Math.floor(factor * 255));
        }
        // Pixels with high chroma or high colorfulness: keep as-is (part of the candle)
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
