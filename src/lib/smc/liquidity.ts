/**
 * liquidity.ts
 *
 * Smart Money Concepts (SMC) Liquidity & Zones Engine:
 * - Equal Highs (EQH) & Equal Lows (EQL) (Liquidity pools)
 * - Premium, Discount & Equilibrium zones
 */

import { Candle, SwingPoint, detectSwingPoints } from "./market-structure";

export interface LiquidityLevel {
  id: string;
  type: "EQH" | "EQL";
  level: number;
  time1: number;
  time2: number;
  swept: boolean;
  sweptTime?: number;
}

export interface PremiumDiscountZones {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  premiumZone: [number, number];
  discountZone: [number, number];
}

/**
 * Detect Equal Highs (EQH) and Equal Lows (EQL) within a threshold percentage
 */
export function detectLiquidity(candles: Candle[], thresholdPercent: number = 0.15): LiquidityLevel[] {
  const swings = detectSwingPoints(candles, 3);
  const levels: LiquidityLevel[] = [];

  const highs = swings.filter(s => s.type === "HIGH");
  const lows = swings.filter(s => s.type === "LOW");

  // Check Equal Highs
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < Math.min(i + 5, highs.length); j++) {
      const h1 = highs[i];
      const h2 = highs[j];
      const diffPercent = Math.abs(h1.price - h2.price) / h1.price * 100;

      if (diffPercent <= thresholdPercent) {
        levels.push({
          id: `eqh-${h1.time}-${h2.time}`,
          type: "EQH",
          level: Math.max(h1.price, h2.price),
          time1: h1.time,
          time2: h2.time,
          swept: false
        });
      }
    }
  }

  // Check Equal Lows
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < Math.min(i + 5, lows.length); j++) {
      const l1 = lows[i];
      const l2 = lows[j];
      const diffPercent = Math.abs(l1.price - l2.price) / l1.price * 100;

      if (diffPercent <= thresholdPercent) {
        levels.push({
          id: `eql-${l1.time}-${l2.time}`,
          type: "EQL",
          level: Math.min(l1.price, l2.price),
          time1: l1.time,
          time2: l2.time,
          swept: false
        });
      }
    }
  }

  // Check sweeps by later candles
  for (const lvl of levels) {
    const afterTime = Math.max(lvl.time1, lvl.time2);
    for (const c of candles) {
      if (c.time > afterTime) {
        if (lvl.type === "EQH" && c.high > lvl.level) {
          lvl.swept = true;
          lvl.sweptTime = c.time;
          break;
        }
        if (lvl.type === "EQL" && c.low < lvl.level) {
          lvl.swept = true;
          lvl.sweptTime = c.time;
          break;
        }
      }
    }
  }

  return levels;
}

/**
 * Calculate Premium, Discount, and Equilibrium zones from major swing range
 */
export function calculatePremiumDiscount(candles: Candle[], lookbackBars: number = 50): PremiumDiscountZones | null {
  if (candles.length < lookbackBars) return null;
  const recent = candles.slice(-lookbackBars);
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;

  for (const c of recent) {
    if (c.high > rangeHigh) rangeHigh = c.high;
    if (c.low < rangeLow) rangeLow = c.low;
  }

  if (rangeHigh === -Infinity || rangeLow === Infinity) return null;

  const equilibrium = (rangeHigh + rangeLow) / 2;

  return {
    rangeHigh,
    rangeLow,
    equilibrium,
    premiumZone: [equilibrium, rangeHigh],
    discountZone: [rangeLow, equilibrium]
  };
}
