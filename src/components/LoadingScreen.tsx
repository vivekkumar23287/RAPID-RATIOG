"use client";

import { useEffect, useState, useCallback } from "react";

/* ───────────────────────────────────────────
   LOADING SCREEN — Connection Animation
   API ──→ Website ←── Database
   ─────────────────────────────────────────── */

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [phase, setPhase] = useState(0);
  // phase 0: initial (icons appear)
  // phase 1: API line starts drawing
  // phase 2: Database line starts drawing
  // phase 3: both connected, pulse

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";

    const startTime = Date.now();
    let current = 0;
    let resourcesLoaded = false;
    let minTimePassed = false;

    // Phase timings
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2400);

    const checkComplete = () => {
      if (resourcesLoaded && minTimePassed) {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          document.body.style.overflow = "";
        }, 800);
      }
    };

    const minTimer = setTimeout(() => {
      minTimePassed = true;
      checkComplete();
    }, 3200);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / 3500, 1);
      const natural = (1 - Math.pow(1 - t, 3)) * 90;
      current = Math.max(current, natural);
      setProgress(Math.round(current));
    }, 30);

    const onLoad = () => {
      resourcesLoaded = true;
      const fill = setInterval(() => {
        current = Math.min(current + 3, 100);
        setProgress(Math.round(current));
        if (current >= 100) {
          clearInterval(fill);
          checkComplete();
        }
      }, 20);
    };

    if (document.readyState === "complete") {
      setTimeout(onLoad, 500);
    } else {
      window.addEventListener("load", onLoad);
    }

    const fallback = setTimeout(() => {
      resourcesLoaded = true;
      minTimePassed = true;
      const fill = setInterval(() => {
        current = Math.min(current + 5, 100);
        setProgress(Math.round(current));
        if (current >= 100) {
          clearInterval(fill);
          setExiting(true);
          setTimeout(() => {
            setVisible(false);
            document.body.style.overflow = "";
          }, 800);
        }
      }, 15);
    }, 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(minTimer);
      clearTimeout(fallback);
      clearInterval(interval);
      window.removeEventListener("load", onLoad);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      id="loading-screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f0f7ff 0%, #e8f5e9 30%, #ffffff 60%, #e3f2fd 100%)",
        transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "scale(1.05)" : "scale(1)",
        pointerEvents: exiting ? "none" : "auto",
        overflow: "hidden",
      }}
    >
      {/* Subtle animated background circles */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(33, 150, 243, 0.06) 0%, transparent 70%)",
            top: "-100px",
            right: "-100px",
            animation: "floatBg 8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(76, 175, 80, 0.06) 0%, transparent 70%)",
            bottom: "-80px",
            left: "-80px",
            animation: "floatBg 8s ease-in-out 2s infinite reverse",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(33, 150, 243, 0.04) 0%, transparent 70%)",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            animation: "floatBg 6s ease-in-out 1s infinite",
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "48px",
        }}
      >
        {/* Connection diagram */}
        <div
          style={{
            position: "relative",
            width: "min(500px, 90vw)",
            height: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* SVG for connecting lines */}
          <svg
            viewBox="0 0 500 200"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            {/* API → Website line */}
            <path
              d="M 105 100 C 150 100, 180 100, 210 100"
              fill="none"
              stroke="url(#blueGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                strokeDasharray: 120,
                strokeDashoffset: phase >= 1 ? 0 : 120,
                transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            {/* Data particles on API line */}
            {phase >= 1 && (
              <>
                <circle r="3" fill="#2196F3" opacity="0.8">
                  <animateMotion
                    dur="1.5s"
                    repeatCount="indefinite"
                    path="M 105 100 C 150 100, 180 100, 210 100"
                  />
                </circle>
                <circle r="2" fill="#64B5F6" opacity="0.5">
                  <animateMotion
                    dur="1.5s"
                    repeatCount="indefinite"
                    begin="0.5s"
                    path="M 105 100 C 150 100, 180 100, 210 100"
                  />
                </circle>
              </>
            )}

            {/* Database → Website line */}
            <path
              d="M 395 100 C 350 100, 320 100, 290 100"
              fill="none"
              stroke="url(#greenGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                strokeDasharray: 120,
                strokeDashoffset: phase >= 2 ? 0 : 120,
                transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            {/* Data particles on Database line */}
            {phase >= 2 && (
              <>
                <circle r="3" fill="#4CAF50" opacity="0.8">
                  <animateMotion
                    dur="1.5s"
                    repeatCount="indefinite"
                    path="M 395 100 C 350 100, 320 100, 290 100"
                  />
                </circle>
                <circle r="2" fill="#81C784" opacity="0.5">
                  <animateMotion
                    dur="1.5s"
                    repeatCount="indefinite"
                    begin="0.7s"
                    path="M 395 100 C 350 100, 320 100, 290 100"
                  />
                </circle>
              </>
            )}

            {/* Connection check marks */}
            {phase >= 3 && (
              <>
                {/* API connected dot */}
                <circle cx="210" cy="100" r="5" fill="#2196F3" opacity="0">
                  <animate attributeName="opacity" values="0;1;0.6;1" dur="0.6s" fill="freeze" />
                  <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Database connected dot */}
                <circle cx="290" cy="100" r="5" fill="#4CAF50" opacity="0">
                  <animate attributeName="opacity" values="0;1;0.6;1" dur="0.6s" fill="freeze" />
                  <animate attributeName="r" values="5;8;5" dur="2s" begin="0.3s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Gradients */}
            <defs>
              <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2196F3" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#2196F3" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="greenGrad" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#4CAF50" stopOpacity="1" />
              </linearGradient>
            </defs>
          </svg>

          {/* API Icon (Left) */}
          <div
            style={{
              position: "absolute",
              left: "0",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              animation: "iconAppear 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "18px",
                background: phase >= 1
                  ? "linear-gradient(135deg, #2196F3, #1976D2)"
                  : "linear-gradient(135deg, #e3f2fd, #bbdefb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: phase >= 1
                  ? "0 8px 32px rgba(33, 150, 243, 0.3), 0 2px 8px rgba(33, 150, 243, 0.2)"
                  : "0 4px 16px rgba(0, 0, 0, 0.06)",
                transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* API Icon - Code brackets with gear */}
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <path
                  d="M12 8L6 17L12 26"
                  stroke={phase >= 1 ? "#fff" : "#2196F3"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M22 8L28 17L22 26"
                  stroke={phase >= 1 ? "#fff" : "#2196F3"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M19 6L15 28"
                  stroke={phase >= 1 ? "rgba(255,255,255,0.6)" : "rgba(33,150,243,0.4)"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ transition: "stroke 0.8s ease" }}
                />
              </svg>
            </div>
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: "#2196F3",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: phase >= 1 ? 1 : 0.5,
                transition: "opacity 0.6s ease",
              }}
            >
              API
            </span>
          </div>

          {/* Website Icon (Center) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              animation: "iconAppear 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both",
              zIndex: 5,
            }}
          >
            <div
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "22px",
                background: phase >= 3
                  ? "linear-gradient(135deg, #1565C0, #0D47A1)"
                  : "linear-gradient(135deg, #e8eaf6, #c5cae9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: phase >= 3
                  ? "0 12px 40px rgba(21, 101, 192, 0.35), 0 4px 12px rgba(21, 101, 192, 0.25)"
                  : "0 6px 24px rgba(0, 0, 0, 0.08)",
                transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: phase >= 3 ? "connectedPulse 2s ease-in-out infinite" : "none",
              }}
            >
              {/* Website / Globe icon */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle
                  cx="20"
                  cy="20"
                  r="14"
                  stroke={phase >= 3 ? "#fff" : "#3F51B5"}
                  strokeWidth="2"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <ellipse
                  cx="20"
                  cy="20"
                  rx="8"
                  ry="14"
                  stroke={phase >= 3 ? "#fff" : "#3F51B5"}
                  strokeWidth="1.5"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M6 20H34"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.7)" : "rgba(63,81,181,0.5)"}
                  strokeWidth="1.5"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M8 13H32"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.4)" : "rgba(63,81,181,0.3)"}
                  strokeWidth="1"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M8 27H32"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.4)" : "rgba(63,81,181,0.3)"}
                  strokeWidth="1"
                  style={{ transition: "stroke 0.8s ease" }}
                />
              </svg>
            </div>
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 700,
                color: "#1565C0",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Website
            </span>
          </div>

          {/* Database Icon (Right) */}
          <div
            style={{
              position: "absolute",
              right: "0",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              animation: "iconAppear 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "18px",
                background: phase >= 2
                  ? "linear-gradient(135deg, #4CAF50, #388E3C)"
                  : "linear-gradient(135deg, #e8f5e9, #c8e6c9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: phase >= 2
                  ? "0 8px 32px rgba(76, 175, 80, 0.3), 0 2px 8px rgba(76, 175, 80, 0.2)"
                  : "0 4px 16px rgba(0, 0, 0, 0.06)",
                transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Database icon - cylinder */}
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <ellipse
                  cx="17"
                  cy="10"
                  rx="10"
                  ry="4"
                  stroke={phase >= 2 ? "#fff" : "#4CAF50"}
                  strokeWidth="2"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M7 10V24C7 26.2 11.5 28 17 28C22.5 28 27 26.2 27 24V10"
                  stroke={phase >= 2 ? "#fff" : "#4CAF50"}
                  strokeWidth="2"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M7 17C7 19.2 11.5 21 17 21C22.5 21 27 19.2 27 17"
                  stroke={phase >= 2 ? "rgba(255,255,255,0.5)" : "rgba(76,175,80,0.4)"}
                  strokeWidth="1.5"
                  style={{ transition: "stroke 0.8s ease" }}
                />
              </svg>
            </div>
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: "#4CAF50",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: phase >= 2 ? 1 : 0.5,
                transition: "opacity 0.6s ease",
              }}
            >
              Database
            </span>
          </div>
        </div>

        {/* Status labels under the connection diagram */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: phase >= 1 ? "#2196F3" : "#ccc",
                transition: "background 0.5s ease",
                boxShadow: phase >= 1 ? "0 0 8px rgba(33, 150, 243, 0.5)" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                color: phase >= 1 ? "#1976D2" : "#9e9e9e",
                fontWeight: 500,
                transition: "color 0.5s ease",
              }}
            >
              API Connected
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: phase >= 2 ? "#4CAF50" : "#ccc",
                transition: "background 0.5s ease",
                boxShadow: phase >= 2 ? "0 0 8px rgba(76, 175, 80, 0.5)" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                color: phase >= 2 ? "#388E3C" : "#9e9e9e",
                fontWeight: 500,
                transition: "color 0.5s ease",
              }}
            >
              Database Connected
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: phase >= 3 ? "#1565C0" : "#ccc",
                transition: "background 0.5s ease",
                boxShadow: phase >= 3 ? "0 0 8px rgba(21, 101, 192, 0.5)" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "Inter, Satoshi, sans-serif",
                fontSize: "12px",
                color: phase >= 3 ? "#1565C0" : "#9e9e9e",
                fontWeight: 500,
                transition: "color 0.5s ease",
              }}
            >
              System Ready
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "min(360px, 80vw)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: 4,
              borderRadius: 4,
              background: "rgba(0, 0, 0, 0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                borderRadius: 4,
                background: "linear-gradient(90deg, #2196F3, #4CAF50)",
                transition: "width 0.15s ease-out",
                boxShadow: "0 0 12px rgba(33, 150, 243, 0.3)",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "13px",
              fontWeight: 600,
              color: "#546E7A",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {progress}%
          </span>
        </div>
      </div>

      {/* Inline CSS animations */}
      <style>{`
        @keyframes iconAppear {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.5);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }
        @keyframes connectedPulse {
          0%, 100% {
            box-shadow: 0 12px 40px rgba(21, 101, 192, 0.35), 0 4px 12px rgba(21, 101, 192, 0.25);
          }
          50% {
            box-shadow: 0 12px 50px rgba(21, 101, 192, 0.5), 0 4px 16px rgba(21, 101, 192, 0.35), 0 0 0 6px rgba(21, 101, 192, 0.08);
          }
        }
        @keyframes floatBg {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
