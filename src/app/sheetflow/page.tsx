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
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      
      {/* We need to offset the height by the navbar height so it fits perfectly without scrolling the body */}
      <div style={{ flex: 1, marginTop: "72px", position: "relative" }}>
        <Workbook 
          data={sheetData} 
          onChange={(data) => {
            // This captures all changes (typing, formatting, etc.)
            console.log("Sheet data changed", data);
          }}
        />
      </div>
    </main>
  );
}
