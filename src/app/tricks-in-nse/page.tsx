"use client";

import React from "react";
import Navbar from "@/components/Navbar";

export default function TricksInNSE() {
  return (
    <div style={{ background: "#F8F9FC", minHeight: "100vh" }}>
      <Navbar />
      
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "140px 2rem 80px" }}>
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 48px)", 
            fontWeight: 900, 
            color: "#0F2044", 
            marginBottom: "16px",
            letterSpacing: "-1px",
            lineHeight: 1.1
          }}>
            Tricks in NSE
          </h1>
          <p style={{ 
            color: "#64748B", 
            fontSize: "18px", 
            maxWidth: "600px", 
            margin: "0 auto",
            lineHeight: 1.6
          }}>
            Exclusive trading setups and secrets are currently being updated. Check back soon.
          </p>
        </div>
      </main>
    </div>
  );
}
