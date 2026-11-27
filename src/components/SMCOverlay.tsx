"use client";

import React, { useState, useEffect } from "react";

export interface SMCSettings {
  enabled: boolean;
  bos: boolean;
  choch: boolean;
  fvg: boolean;
  orderBlocks: boolean;
  liquidity: boolean;
  premiumDiscount: boolean;
}

interface SMCOverlayProps {
  symbol: string;
  timeframe: string;
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  priceToCoordinate: (price: number) => number | null;
  timeToCoordinate: (time: number) => number | null;
  chartWidth: number;
  chartHeight: number;
  settings: SMCSettings;
  onToggleSettings: (newSettings: SMCSettings) => void;
}

export default function SMCOverlay({
  symbol,
  timeframe,
  candles,
  priceToCoordinate,
  timeToCoordinate,
  chartWidth,
  chartHeight,
  settings,
  onToggleSettings,
}: SMCOverlayProps) {
  const [smcData, setSmcData] = useState<any>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    if (!settings.enabled || !symbol) return;

    let cancelled = false;
    const intervalParam = ["1m", "5m", "15m", "30m", "60m"].includes(timeframe) ? timeframe : "15m";

    fetch(`/api/smc/analysis?symbol=${encodeURIComponent(symbol)}&interval=${intervalParam}&range=5d`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && data.smc) {
          setSmcData(data.smc);
        }
      })
      .catch((err) => console.warn("[SMC-OVERLAY] Fetch error:", err));

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, settings.enabled]);

  if (!settings.enabled || !smcData) {
    return (
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 30 }}>
        <button
          onClick={() => onToggleSettings({ ...settings, enabled: true })}
          style={{
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#0F2044",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          SMC: OFF
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Top Floating Controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 30, display: "flex", gap: "8px" }}>
        <button
          onClick={() => onToggleSettings({ ...settings, enabled: false })}
          style={{
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "1px solid #10B981",
            background: "#10B98115",
            color: "#059669",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          SMC: ON
        </button>
        <button
          onClick={() => setShowSettingsModal(!showSettingsModal)}
          style={{
            padding: "5px 10px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#475569",
            cursor: "pointer",
          }}
        >
          ⚙️ Layers
        </button>
      </div>

      {/* Settings Dropdown */}
      {showSettingsModal && (
        <div
          style={{
            position: "absolute",
            top: 48,
            right: 12,
            zIndex: 40,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            width: "200px",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: 800, color: "#0F2044", marginBottom: "8px" }}>SMC Indicators</div>
          {[
            { key: "bos", label: "Break of Structure (BOS)" },
            { key: "choch", label: "Change of Character (CHoCH)" },
            { key: "fvg", label: "Fair Value Gaps (FVG)" },
            { key: "orderBlocks", label: "Order Blocks (OB)" },
            { key: "liquidity", label: "Equal Highs/Lows (EQH/EQL)" },
            { key: "premiumDiscount", label: "Premium / Discount Zones" },
          ].map(({ key, label }) => (
            <label
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 0",
                cursor: "pointer",
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={(settings as any)[key]}
                onChange={(e) => onToggleSettings({ ...settings, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* SVG Canvas for Drawing SMC Structures */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: chartWidth,
          height: chartHeight,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {/* 1. Fair Value Gaps (FVG) */}
        {settings.fvg &&
          smcData.fvgs?.map((fvg: any) => {
            const yTop = priceToCoordinate(fvg.top);
            const yBottom = priceToCoordinate(fvg.bottom);
            const xStart = timeToCoordinate(fvg.startTime);
            const xEnd = fvg.mitigated && fvg.mitigatedTime ? timeToCoordinate(fvg.mitigatedTime) : chartWidth - 60;

            if (yTop == null || yBottom == null || xStart == null) return null;
            const width = Math.max(30, (xEnd || chartWidth - 60) - xStart);
            const height = Math.abs(yBottom - yTop);
            const isBull = fvg.type === "BULLISH";

            return (
              <g key={fvg.id}>
                <rect
                  x={xStart}
                  y={Math.min(yTop, yBottom)}
                  width={width}
                  height={Math.max(2, height)}
                  fill={isBull ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}
                  stroke={isBull ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}
                  strokeWidth="1"
                  strokeDasharray={fvg.mitigated ? "3,3" : "none"}
                />
                <text
                  x={xStart + 6}
                  y={Math.min(yTop, yBottom) + 12}
                  fontSize="10"
                  fontWeight="bold"
                  fill={isBull ? "#059669" : "#DC2626"}
                >
                  {isBull ? "+FVG" : "-FVG"}
                </text>
              </g>
            );
          })}

        {/* 2. Order Blocks (OB) */}
        {settings.orderBlocks &&
          smcData.orderBlocks?.map((ob: any) => {
            const yTop = priceToCoordinate(ob.top);
            const yBottom = priceToCoordinate(ob.bottom);
            const xStart = timeToCoordinate(ob.startTime);
            const xEnd = ob.mitigated && ob.mitigatedTime ? timeToCoordinate(ob.mitigatedTime) : chartWidth - 60;

            if (yTop == null || yBottom == null || xStart == null) return null;
            const width = Math.max(30, (xEnd || chartWidth - 60) - xStart);
            const height = Math.abs(yBottom - yTop);
            const isBull = ob.type === "BULLISH";

            return (
              <g key={ob.id}>
                <rect
                  x={xStart}
                  y={Math.min(yTop, yBottom)}
                  width={width}
                  height={Math.max(2, height)}
                  fill={isBull ? "rgba(59, 130, 246, 0.18)" : "rgba(234, 88, 12, 0.18)"}
                  stroke={isBull ? "#2563EB" : "#EA580C"}
                  strokeWidth="1"
                />
                <text
                  x={xStart + 6}
                  y={Math.min(yTop, yBottom) + 12}
                  fontSize="10"
                  fontWeight="bold"
                  fill={isBull ? "#1D4ED8" : "#C2410C"}
                >
                  {isBull ? "+OB" : "-OB"}
                </text>
              </g>
            );
          })}

        {/* 3. Market Structure Breakouts (BOS / CHoCH) */}
        {smcData.structureSignals?.map((sig: any, idx: number) => {
          if (sig.type === "BOS" && !settings.bos) return null;
          if (sig.type === "CHoCH" && !settings.choch) return null;

          const y = priceToCoordinate(sig.brokenLevel);
          const x = timeToCoordinate(sig.time);
          if (y == null || x == null) return null;

          const isBull = sig.direction === "BULLISH";
          const color = isBull ? "#10B981" : "#EF4444";

          return (
            <g key={`struct-${idx}`}>
              {/* Horizontal breakout dashed reference line */}
              <line
                x1={Math.max(0, x - 80)}
                y1={y}
                x2={x + 20}
                y2={y}
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4,3"
              />
              {/* Structure badge label */}
              <rect
                x={x - 24}
                y={isBull ? y - 18 : y + 4}
                width="48"
                height="16"
                rx="4"
                fill={color}
              />
              <text
                x={x}
                y={isBull ? y - 6 : y + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#FFFFFF"
              >
                {sig.type}
              </text>
            </g>
          );
        })}

        {/* 4. Liquidity Pools (EQH / EQL) */}
        {settings.liquidity &&
          smcData.liquidity?.map((liq: any) => {
            const y = priceToCoordinate(liq.level);
            const x1 = timeToCoordinate(liq.time1);
            const x2 = timeToCoordinate(liq.time2);

            if (y == null || x1 == null || x2 == null) return null;
            const xRight = liq.swept && liq.sweptTime ? timeToCoordinate(liq.sweptTime) : chartWidth - 80;

            return (
              <g key={liq.id}>
                <line
                  x1={x1}
                  y1={y}
                  x2={xRight || chartWidth - 80}
                  y2={y}
                  stroke="#8B5CF6"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                <circle cx={x1} cy={y} r="3" fill="#8B5CF6" />
                <circle cx={x2} cy={y} r="3" fill="#8B5CF6" />
                <text
                  x={(x1 + x2) / 2}
                  y={liq.type === "EQH" ? y - 6 : y + 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#7C3AED"
                >
                  {liq.type === "EQH" ? "x x (EQH)" : "x x (EQL)"}
                </text>
              </g>
            );
          })}

        {/* 5. Premium / Discount Equilibrium Zone */}
        {settings.premiumDiscount && smcData.premiumDiscount && (() => {
          const yEq = priceToCoordinate(smcData.premiumDiscount.equilibrium);
          if (yEq == null) return null;

          return (
            <g key="prem-disc-zone">
              <line
                x1={0}
                y1={yEq}
                x2={chartWidth - 60}
                y2={yEq}
                stroke="#64748B"
                strokeWidth="1"
                strokeDasharray="5,5"
              />
              <text
                x={chartWidth - 140}
                y={yEq - 4}
                fontSize="10"
                fontWeight="bold"
                fill="#64748B"
              >
                EQ (0.5)
              </text>
            </g>
          );
        })()}
      </svg>
    </>
  );
}
