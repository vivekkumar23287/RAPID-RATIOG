"use client";

import React, { useEffect, useCallback, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Navbar from "@/components/Navbar";
import "@fortune-sheet/react/dist/index.css";

// Dynamically import Workbook with ssr: false — FortuneSheet uses 2D canvas which requires browser APIs
const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((m) => m.Workbook),
  { ssr: false }
);

const INITIAL_DATA = [
  {
    name: "Sheet1",
    id: "sheet_01",
    status: 1,
    row: 100,
    column: 60,
    celldata: [
      { r: 0, c: 0, v: { v: "Welcome to Sheet Flow", m: "Welcome to Sheet Flow", bg: "#0F2044", fc: "#FFFFFF", bl: 1 } },
      { r: 1, c: 0, v: { v: "This is a fully functional Excel clone in your browser." } },
      { r: 3, c: 0, v: { v: "Item", bl: 1 } },
      { r: 3, c: 1, v: { v: "Cost", bl: 1 } },
      { r: 4, c: 0, v: { v: "Apples" } },
      { r: 4, c: 1, v: { v: "5", t: "n" } },
      { r: 5, c: 0, v: { v: "Oranges" } },
      { r: 5, c: 1, v: { v: "10", t: "n" } },
      { r: 6, c: 0, v: { v: "Total", bl: 1 } },
      { r: 6, c: 1, v: { v: "=SUM(B5:B6)", f: "=SUM(B5:B6)" } }
    ]
  }
];

export default function SheetFlowPage() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey) {
        const target = e.target as HTMLElement;
        if (
          target.isContentEditable || 
          target.classList.contains("luckysheet-input-box-inner") ||
          target.classList.contains("fortune-fx-input")
        ) {
          e.stopPropagation(); 
          e.preventDefault();  
          document.execCommand("insertText", false, "\n");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Lock window scroll to 0 — the spreadsheet handles its own internal scrolling
  useEffect(() => {
    const lock = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    window.addEventListener("scroll", lock, { passive: true });
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("scroll", lock);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Intercept wheel events on the spreadsheet container to fix FortuneSheet React state-sync freeze
  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      const scrollbarY = container.querySelector('.luckysheet-scrollbar-y') as HTMLElement;
      const scrollbarX = container.querySelector('.luckysheet-scrollbar-x') as HTMLElement;

      if (!scrollbarY && !scrollbarX) return;

      // Stop FortuneSheet's internal handleGlobalWheel from running (prevents state-sync race condition freeze)
      e.stopPropagation();
      e.preventDefault();

      if (e.deltaY && scrollbarY) {
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 28; // Lines to pixels
        else if (e.deltaMode === 2) dy *= container.clientHeight; // Pages to pixels
        
        scrollbarY.scrollTop += dy;
      }

      if (e.deltaX && scrollbarX) {
        let dx = e.deltaX;
        if (e.deltaMode === 1) dx *= 28;
        else if (e.deltaMode === 2) dx *= container.clientWidth;
        
        scrollbarX.scrollLeft += dx;
      }
    };

    // Attach in capture phase to run BEFORE FortuneSheet's wheel listener
    container.addEventListener("wheel", handleWheel, { capture: true, passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
    };
  }, [mounted]);

  const handleChange = useCallback(() => {}, []);

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", position: "relative", overflow: "hidden" }}>
      <Navbar />
      
      <div 
        ref={containerRef}
        className="excel-scroll-container"
        style={{ 
          flex: 1,
          marginTop: "64px", 
          marginBottom: "16px",
          marginLeft: "20px", 
          marginRight: "20px", 
          position: "relative",
          background: "#FFFFFF",
          borderRadius: "24px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {mounted && (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <Workbook 
              data={INITIAL_DATA} 
              onChange={handleChange}
            />
          </div>
        )}

        <style>{`
          /* 
           * FortuneSheet uses internal scrollbar elements (.luckysheet-scrollbar-y, .luckysheet-scrollbar-x)
           * to manage grid scrolling. We explicitly restore WebKit scrollbar styling for these containers.
           */
          .luckysheet-scrollbar-ltr,
          .luckysheet-scrollbars {
            scrollbar-width: auto !important;
            -ms-overflow-style: auto !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar,
          .luckysheet-scrollbars::-webkit-scrollbar {
            width: 10px !important;
            height: 10px !important;
            display: block !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-track,
          .luckysheet-scrollbars::-webkit-scrollbar-track {
            background: #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-thumb,
          .luckysheet-scrollbars::-webkit-scrollbar-thumb {
            background: #CBD5E1 !important;
            border-radius: 8px !important;
            border: 2px solid #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-thumb:hover,
          .luckysheet-scrollbars::-webkit-scrollbar-thumb:hover {
            background: #94A3B8 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-corner,
          .luckysheet-scrollbars::-webkit-scrollbar-corner {
            background: #F1F5F9 !important;
          }
          .luckysheet-scrollbar-ltr::-webkit-scrollbar-button,
          .luckysheet-scrollbars::-webkit-scrollbar-button {
            display: none !important;
          }
        `}</style>
      </div>
    </main>
  );
}
