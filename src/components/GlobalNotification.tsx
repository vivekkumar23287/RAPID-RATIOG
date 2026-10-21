"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { BellRinging, X, TrendUp, TrendDown } from "@phosphor-icons/react";

type NotificationItem = {
  id: string;
  type: "BULLISH" | "BEARISH";
  title: string;
  message: string;
  price: number;
  time: string;
};

export default function GlobalNotification() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    
    audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");

    const signalsUrl = process.env.NEXT_PUBLIC_SIGNALS_URL;
    let socket: Socket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const processSignals = (newSignals: any[]) => {
      newSignals.forEach((sig) => {
        const signalKey = `${sig.stock_symbol}-${sig.candle_date}-${sig.candle_time}-${sig.direction}`;
        const lastNotifiedKey = `setup_notified_${sig.stock_symbol}`;
        const lastNotified = localStorage.getItem(lastNotifiedKey);

        if (lastNotified !== signalKey) {
          localStorage.setItem(lastNotifiedKey, signalKey);

          const isBullish = sig.direction === "UP";
          const isNifty = sig.stock_symbol === "NIFTY50" || sig.stock_symbol === "NIFTY";
          const newNotification: NotificationItem = {
            id: `${Date.now()}-${Math.random()}`,
            type: isBullish ? "BULLISH" : "BEARISH",
            title: isNifty
              ? isBullish ? "Nifty 50 Bullish Setup" : "Nifty 50 Bearish Setup"
              : `${sig.stock_name || sig.stock_symbol} ${isBullish ? "Bullish Setup" : "Bearish Setup"}`,
            message: isBullish
              ? `Bullish Break detected! ${isNifty ? "Nifty 50" : sig.stock_name || sig.stock_symbol} completed a positive 15m setup.`
              : `Bearish Break detected! ${isNifty ? "Nifty 50" : sig.stock_name || sig.stock_symbol} completed a negative 15m setup.`,
            price: Number(sig.close_price),
            time: sig.candle_time?.split(" - ")[1] || sig.candle_time || "",
          };

          if (audioRef.current) {
            audioRef.current.play().catch((e) => console.warn("Audio play blocked by browser:", e));
          }

          setNotifications((prev) => [...prev, newNotification]);

          const timerId = setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
            timersRef.current.delete(timerId);
          }, 6000);
          timersRef.current.add(timerId);
        }
      });
    };

    if (signalsUrl) {
      try {
        socket = io(signalsUrl);
        socket.on("connect", () => {
          console.log("Global Notification connected to signals stream");
        });
        socket.on("new_signals", (newSignals: any[]) => {
          processSignals(newSignals);
        });
      } catch (e) {
        console.warn("Global Notification socket failed:", e);
      }
    } else {
      // Built-in polling
      const pollSignals = async () => {
        try {
          const res = await fetch("/api/signals");
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
              // Only alert for the latest signal on first check or changes
              const latest = data.data.slice(0, 3);
              processSignals(latest);
            }
          }
        } catch (_) {}
      };
      pollSignals();
      pollInterval = setInterval(pollSignals, 15000);
    }

    return () => {
      if (socket) socket.disconnect();
      if (pollInterval) clearInterval(pollInterval);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "84px",
        right: "24px",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        pointerEvents: "none",
        maxWidth: "380px",
        width: "100%",
      }}
    >
      {notifications.map((n) => {
        const isBull = n.type === "BULLISH";
        const themeColor = isBull ? "#10B981" : "#EF4444";
        const bgColor = isBull ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)";
        const borderGlow = isBull ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

        return (
          <div
            key={n.id}
            style={{
              pointerEvents: "auto",
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(20px) saturate(180%)",
              border: `1.5px solid ${themeColor}`,
              boxShadow: `0 12px 40px ${borderGlow}, 0 4px 12px rgba(0, 0, 0, 0.05)`,
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              animation: "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              position: "relative",
              overflow: "hidden",
            }}
          >
            
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: "5px",
                background: themeColor,
              }}
            />

            
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: isBull ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: themeColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              {isBull ? <TrendUp size={22} weight="bold" /> : <TrendDown size={22} weight="bold" />}
              <span
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  borderRadius: "10px",
                  border: `2px solid ${themeColor}`,
                  animation: "pingGlow 2s infinite ease-in-out",
                }}
              />
            </div>

            
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#0F2044",
                  marginBottom: "4px",
                  lineHeight: 1.2,
                }}
              >
                {n.title}
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  color: "#475569",
                  lineHeight: 1.4,
                  fontWeight: 500,
                  marginBottom: "6px",
                }}
              >
                {n.message}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", fontWeight: 700 }}>
                <span
                  style={{
                    color: themeColor,
                    background: isBull ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                  }}
                >
                  CMP: ₹{n.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span style={{ color: "#94A3B8" }}>at {n.time}</span>
              </div>
            </div>

            
            <button
              onClick={() => removeNotification(n.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#0F2044")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              <X size={16} weight="bold" />
            </button>

            
            <style>{`
              @keyframes slideInRight {
                from {
                  transform: translateX(100%) translateY(-10px);
                  opacity: 0;
                }
                to {
                  transform: translateX(0) translateY(0);
                  opacity: 1;
                }
              }
              @keyframes pingGlow {
                0% {
                  transform: scale(1);
                  opacity: 0.8;
                }
                70% {
                  transform: scale(1.3);
                  opacity: 0;
                }
                100% {
                  transform: scale(1);
                  opacity: 0;
                }
              }
            `}</style>
          </div>
        );
      })}
    </div>
  );
}
