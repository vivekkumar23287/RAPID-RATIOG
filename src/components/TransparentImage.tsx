"use client";

import { useEffect, useRef } from "react";

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

        
        if (a === 0) continue;

        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min; 
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        
        
        
        
        if (chroma < 30) {
          
          
          
          
          if (brightness > 180 || brightness < 50) {
            data[i + 3] = 0; 
          } else {
            
            const checkerboardGray = Math.abs(brightness - 204);
            if (checkerboardGray < 25) {
              data[i + 3] = 0; 
            } else {
              
              const factor = Math.min(1, (chroma - 10) / 20);
              data[i + 3] = Math.floor(a * factor);
            }
          }
        } else if (chroma < 50) {
          
          
          const factor = (chroma - 30) / 20; 
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

        
        
        
        
        const greenBlueExcess = Math.max(g - r, b - r);
        const colorfulness = Math.max(greenBlueExcess, r - Math.max(g, b));

        if (chroma < 25) {
          
          if (brightness > 230) {
            
            const highlightAlpha = Math.max(0, Math.floor(((brightness - 240) / 15) * 200));
            data[i + 3] = Math.min(a, highlightAlpha);
          } else {
            data[i + 3] = 0;
          }
        } else if (chroma < 45 && colorfulness < 30) {
          
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
