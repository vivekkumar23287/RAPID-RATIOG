"use client";

import React, { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";

export default function SignalHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [sheetData, setSheetData] = useState([{ name: "Signal History", celldata: [] as any[] }]);

  useEffect(() => {
    fetch("http://localhost:8080/api/history")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const headers = ["ID", "Date", "Time", "Symbol", "Name", "Signal Type", "Direction", "Open", "High", "Low", "Close", "Timeframe"];
          const celldata: any[] = [];
          
          // Setup styling arrays for columns
          const colWidths: Record<string, number> = {
            "0": 60,   // ID
            "1": 100,  // Date
            "2": 100,  // Time
            "3": 120,  // Symbol
            "4": 200,  // Name
            "5": 140,  // Signal
            "6": 100,  // Direction
            "7": 80,   // Open
            "8": 80,   // High
            "9": 80,   // Low
            "10": 80,  // Close
            "11": 80   // Timeframe
          };

          // Add headers
          headers.forEach((h, c) => {
            celldata.push({ r: 0, c, v: { v: h, m: h, bg: "#0F2044", fc: "#FFFFFF", bl: 1 } });
          });

          // Add rows
          data.data.forEach((row: any, rIndex: number) => {
            const r = rIndex + 1;
            const values = [
              row.id,
              row.candle_date,
              row.candle_time,
              row.stock_symbol,
              row.stock_name,
              row.signal_type,
              row.direction,
              row.open_price,
              row.high_price,
              row.low_price,
              row.close_price,
              row.timeframe
            ];

            values.forEach((val, c) => {
              let bg = "#FFFFFF";
              let fc = "#000000";
              let bl = 0;

              // Color rows based on direction
              if (row.direction === "UP") {
                bg = "rgba(16,185,129,0.06)";
              } else if (row.direction === "DOWN") {
                bg = "rgba(239,68,68,0.06)";
              }

              // Emphasize signal type column
              if (c === 5) {
                 bl = 1;
                 fc = row.direction === "UP" ? "#10B981" : "#EF4444";
              }

              // Bold symbols
              if (c === 3) {
                 bl = 1;
              }

              celldata.push({ r, c, v: { v: String(val), m: String(val), bg, fc, bl } });
            });
          });

          setSheetData([{ name: "Signal History", celldata, config: { columnlen: colWidths } } as any]);
        }
      })
      .catch(err => console.warn("Error fetching history:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ padding: "100px 2rem 20px", background: "#F8F9FC" }}>
         <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#0F2044", marginBottom: "8px", letterSpacing: "-0.5px" }}>Signal History</h1>
         <p style={{ color: "#64748B", fontSize: "14px", margin: 0 }}>Explore and analyze historical Trick in NSE data in an interactive Excel-like interface.</p>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B", fontWeight: 600 }}>Loading history...</div>
        ) : (
          <Workbook data={sheetData} />
        )}
      </div>
    </main>
  );
}
