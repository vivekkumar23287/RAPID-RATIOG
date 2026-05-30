"use client";

import React, { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";


export default function SheetFlowPage() {
  // Intercept Shift+Enter to insert a new line instead of moving cells
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.shiftKey) {
        const target = e.target as HTMLElement;
        // Check if we are typing inside the FortuneSheet cell editor
        if (
          target.isContentEditable || 
          target.classList.contains("luckysheet-input-box-inner") ||
          target.classList.contains("fortune-fx-input")
        ) {
          e.stopPropagation(); // Stop FortuneSheet from moving the cell up
          e.preventDefault();  // Stop default browser behavior
          
          // Insert a line break (like Alt+Enter)
          document.execCommand("insertText", false, "\n");
        }
      }
    };

    // Use capture phase (true) to intercept the event BEFORE FortuneSheet handles it
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
  const [sheetData, setSheetData] = useState([
    {
      name: "Sheet1",
      row: 84,
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
  ]);

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#FFFFFF", position: "relative", overflow: "hidden" }}>
      <Navbar />
      
      {/* We need to offset the height by the navbar height so it fits perfectly without scrolling the body */}
      <div 
        className="excel-scroll-container"
        style={{ 
          height: "calc(100vh - 124px)", 
          marginTop: "84px", 
          marginLeft: "20px", 
          marginRight: "20px", 
          position: "relative",
          background: "#FFFFFF",
          borderRadius: "24px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          overflow: "scroll" // Force browser scrollbars to always show
        }}
      >
        <div style={{ width: "3200px", height: "1800px" }}>
          <Workbook 
            data={sheetData} 
            onChange={(data) => {
              // This captures all changes (typing, formatting, etc.)
              console.log("Sheet data changed", data);
            }}
          />
        </div>

        <style>{`
          /* Premium Custom Scrollbars for the Excel Sheet page only */
          .excel-scroll-container::-webkit-scrollbar {
            width: 16px !important;
            height: 16px !important;
            display: block !important;
          }
          .excel-scroll-container::-webkit-scrollbar-track {
            background: #F8FAFC !important;
            border-left: 1px solid #E2E8F0 !important;
            border-top: 1px solid #E2E8F0 !important;
            border-bottom-right-radius: 24px;
            border-top-right-radius: 24px;
          }
          .excel-scroll-container::-webkit-scrollbar-thumb {
            background: #CBD5E1 !important;
            border-radius: 10px !important;
            border: 4px solid #F8FAFC !important;
          }
          .excel-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #94A3B8 !important;
          }
          /* Corner spacer where horizontal and vertical scrollbars meet */
          .excel-scroll-container::-webkit-scrollbar-corner {
            background: #F8FAFC !important;
            border-bottom-right-radius: 24px;
          }
        `}</style>
      </div>
    </main>
  );
}
