"use client";

import { useEffect, useState, useCallback } from "react";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [phase, setPhase] = useState(0);
  
  
  
  

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";

    const startTime = Date.now();
    let current = 0;
    let resourcesLoaded = false;
    let minTimePassed = false;
    let isCleanedUp = false;

    const timeouts: NodeJS.Timeout[] = [];
    const intervals: NodeJS.Timeout[] = [];

    const safeSetTimeout = (cb: () => void, delay: number) => {
      const t = setTimeout(() => {
        if (!isCleanedUp) cb();
      }, delay);
      timeouts.push(t);
      return t;
    };

    const safeSetInterval = (cb: () => void, delay: number) => {
      const i = setInterval(() => {
        if (!isCleanedUp) cb();
      }, delay);
      intervals.push(i);
      return i;
    };

    
    safeSetTimeout(() => setPhase(1), 600);
    safeSetTimeout(() => setPhase(2), 1400);
    safeSetTimeout(() => setPhase(3), 2400);

    const checkComplete = () => {
      if (resourcesLoaded && minTimePassed) {
        setExiting(true);
        safeSetTimeout(() => {
          setVisible(false);
          document.body.style.overflow = "";
        }, 800);
      }
    };

    safeSetTimeout(() => {
      minTimePassed = true;
      checkComplete();
    }, 3200);

    safeSetInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / 3500, 1);
      const natural = (1 - Math.pow(1 - t, 3)) * 90;
      current = Math.max(current, natural);
      setProgress(Math.round(current));
    }, 30);

    const onLoad = () => {
      resourcesLoaded = true;
      const fill = safeSetInterval(() => {
        current = Math.min(current + 3, 100);
        setProgress(Math.round(current));
        if (current >= 100) {
          clearInterval(fill);
          checkComplete();
        }
      }, 20);
    };

    if (document.readyState === "complete") {
      safeSetTimeout(onLoad, 500);
    } else {
      window.addEventListener("load", onLoad);
    }

    safeSetTimeout(() => {
      resourcesLoaded = true;
      minTimePassed = true;
      const fill = safeSetInterval(() => {
        current = Math.min(current + 5, 100);
        setProgress(Math.round(current));
        if (current >= 100) {
          clearInterval(fill);
          setExiting(true);
          safeSetTimeout(() => {
            setVisible(false);
            document.body.style.overflow = "";
          }, 800);
        }
      }, 15);
    }, 6000);

    return () => {
      isCleanedUp = true;
      timeouts.forEach(clearTimeout);
      intervals.forEach(clearInterval);
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
          
          <svg
            viewBox="0 0 500 200"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <defs>
              
              <filter id="blueGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.59  0 0 0 0 0.95  0 0 0 0.6 0" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.69  0 0 0 0 0.31  0 0 0 0.6 0" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              
              <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#42A5F5" stopOpacity="0.2" />
                <stop offset="40%" stopColor="#2196F3" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#1976D2" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="greenGrad" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#66BB6A" stopOpacity="0.2" />
                <stop offset="40%" stopColor="#4CAF50" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#388E3C" stopOpacity="1" />
              </linearGradient>

              
              <radialGradient id="blueDot">
                <stop offset="0%" stopColor="#90CAF9" />
                <stop offset="100%" stopColor="#2196F3" />
              </radialGradient>
              <radialGradient id="greenDot">
                <stop offset="0%" stopColor="#A5D6A7" />
                <stop offset="100%" stopColor="#4CAF50" />
              </radialGradient>
            </defs>

            
            
            <path
              d="M 100 100 C 130 100, 140 60, 170 60 C 200 60, 200 100, 215 100"
              fill="none"
              stroke="url(#blueGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.15"
              style={{
                strokeDasharray: 180,
                strokeDashoffset: phase >= 1 ? 0 : 180,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            
            <path
              d="M 100 100 C 130 100, 140 60, 170 60 C 200 60, 200 100, 215 100"
              fill="none"
              stroke="url(#blueGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              filter={phase >= 1 ? "url(#blueGlow)" : "none"}
              style={{
                strokeDasharray: 180,
                strokeDashoffset: phase >= 1 ? 0 : 180,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            
            {phase >= 1 && (
              <>
                <circle r="4" fill="url(#blueDot)" opacity="0.9" filter="url(#blueGlow)">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path="M 100 100 C 130 100, 140 60, 170 60 C 200 60, 200 100, 215 100"
                  />
                </circle>
                <circle r="2.5" fill="#64B5F6" opacity="0.6">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0.6s"
                    path="M 100 100 C 130 100, 140 60, 170 60 C 200 60, 200 100, 215 100"
                  />
                </circle>
                <circle r="1.5" fill="#BBDEFB" opacity="0.4">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    begin="1.2s"
                    path="M 100 100 C 130 100, 140 60, 170 60 C 200 60, 200 100, 215 100"
                  />
                </circle>
              </>
            )}

            
            
            <path
              d="M 400 100 C 370 100, 360 140, 330 140 C 300 140, 300 100, 285 100"
              fill="none"
              stroke="url(#greenGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.15"
              style={{
                strokeDasharray: 180,
                strokeDashoffset: phase >= 2 ? 0 : 180,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            
            <path
              d="M 400 100 C 370 100, 360 140, 330 140 C 300 140, 300 100, 285 100"
              fill="none"
              stroke="url(#greenGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              filter={phase >= 2 ? "url(#greenGlow)" : "none"}
              style={{
                strokeDasharray: 180,
                strokeDashoffset: phase >= 2 ? 0 : 180,
                transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            
            {phase >= 2 && (
              <>
                <circle r="4" fill="url(#greenDot)" opacity="0.9" filter="url(#greenGlow)">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path="M 400 100 C 370 100, 360 140, 330 140 C 300 140, 300 100, 285 100"
                  />
                </circle>
                <circle r="2.5" fill="#81C784" opacity="0.6">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0.7s"
                    path="M 400 100 C 370 100, 360 140, 330 140 C 300 140, 300 100, 285 100"
                  />
                </circle>
                <circle r="1.5" fill="#C8E6C9" opacity="0.4">
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    begin="1.3s"
                    path="M 400 100 C 370 100, 360 140, 330 140 C 300 140, 300 100, 285 100"
                  />
                </circle>
              </>
            )}

            
            {phase >= 3 && (
              <>
                <circle cx="215" cy="100" r="4" fill="#2196F3" opacity="0">
                  <animate attributeName="opacity" values="0;0.8;0.4;0.8" dur="0.5s" fill="freeze" />
                  <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="285" cy="100" r="4" fill="#4CAF50" opacity="0">
                  <animate attributeName="opacity" values="0;0.8;0.4;0.8" dur="0.5s" fill="freeze" />
                  <animate attributeName="r" values="4;7;4" dur="2s" begin="0.3s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </svg>

          
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
              animation: "centerIconAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both",
              zIndex: 5,
            }}
          >
            <div
              style={{
                width: "96px",
                height: "96px",
                borderRadius: "24px",
                background: phase >= 3
                  ? "linear-gradient(135deg, #1565C0, #0D47A1)"
                  : "linear-gradient(135deg, #e8eaf6, #c5cae9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: phase >= 3
                  ? "0 14px 48px rgba(21, 101, 192, 0.4), 0 4px 12px rgba(21, 101, 192, 0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
                  : "0 8px 28px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                transition: "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: phase >= 3 ? "connectedPulse 2.5s ease-in-out infinite" : "none",
                border: phase >= 3 ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.04)",
              }}
            >
              
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                
                <rect
                  x="6" y="8" width="36" height="32" rx="4"
                  stroke={phase >= 3 ? "#fff" : "#3F51B5"}
                  strokeWidth="2"
                  fill="none"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                
                <path
                  d="M6 16H42"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.4)" : "rgba(63,81,181,0.3)"}
                  strokeWidth="1.5"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                
                <circle cx="11" cy="12" r="1.5"
                  fill={phase >= 3 ? "rgba(255,255,255,0.5)" : "rgba(63,81,181,0.35)"}
                  style={{ transition: "fill 0.8s ease" }}
                />
                <circle cx="16" cy="12" r="1.5"
                  fill={phase >= 3 ? "rgba(255,255,255,0.5)" : "rgba(63,81,181,0.35)"}
                  style={{ transition: "fill 0.8s ease" }}
                />
                <circle cx="21" cy="12" r="1.5"
                  fill={phase >= 3 ? "rgba(255,255,255,0.5)" : "rgba(63,81,181,0.35)"}
                  style={{ transition: "fill 0.8s ease" }}
                />
                
                <circle
                  cx="24" cy="29" r="9"
                  stroke={phase >= 3 ? "#fff" : "#3F51B5"}
                  strokeWidth="1.5"
                  fill="none"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <ellipse
                  cx="24" cy="29" rx="5" ry="9"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.7)" : "rgba(63,81,181,0.5)"}
                  strokeWidth="1"
                  fill="none"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M15 29H33"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.5)" : "rgba(63,81,181,0.35)"}
                  strokeWidth="1"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M16.5 24H31.5"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.3)" : "rgba(63,81,181,0.2)"}
                  strokeWidth="0.8"
                  style={{ transition: "stroke 0.8s ease" }}
                />
                <path
                  d="M16.5 34H31.5"
                  stroke={phase >= 3 ? "rgba(255,255,255,0.3)" : "rgba(63,81,181,0.2)"}
                  strokeWidth="0.8"
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
        @keyframes centerIconAppear {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
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
