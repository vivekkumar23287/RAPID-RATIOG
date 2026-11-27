/**
 * smc-engine.ts
 *
 * Master Smart Money Concepts (SMC) Calculation Engine:
 * Coordinates Market Structure, FVGs, Order Blocks, and Liquidity into normalized signal outputs.
 */

import { Candle, detectMarketStructure, StructureSignal, SwingPoint } from "./market-structure";
import { detectFairValueGaps, FairValueGap } from "./fair-value-gaps";
import { detectOrderBlocks, OrderBlock } from "./order-blocks";
import { detectLiquidity, calculatePremiumDiscount, LiquidityLevel, PremiumDiscountZones } from "./liquidity";

export interface SMCSignal {
  id: string;
  symbol: string;
  companyName: string;
  timeframe: "5m" | "15m" | "30m" | "1h" | "1d";
  category: "BOS" | "CHoCH" | "FVG" | "OB" | "LIQUIDITY";
  direction: "BULLISH" | "BEARISH";
  title: string;
  price: number;
  time: number; // Unix seconds
  timestampIST: string;
  details?: Record<string, any>;
}

export interface SMCAnalysisResult {
  symbol: string;
  timeframe: string;
  signals: SMCSignal[];
  structure: {
    signals: StructureSignal[];
    swings: SwingPoint[];
    currentTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  };
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquidity: LiquidityLevel[];
  premiumDiscount: PremiumDiscountZones | null;
}

/**
 * Runs full Smart Money Concepts analysis on candle series
 */
export function analyzeSMC(
  symbol: string,
  companyName: string,
  candles: Candle[],
  timeframe: "5m" | "15m" | "30m" | "1h" | "1d" = "15m"
): SMCAnalysisResult {
  const structure = detectMarketStructure(candles, 5);
  const fvgs = detectFairValueGaps(candles, 0.05);
  const orderBlocks = detectOrderBlocks(candles, 5);
  const liquidity = detectLiquidity(candles, 0.15);
  const premiumDiscount = calculatePremiumDiscount(candles, 60);

  const signals: SMCSignal[] = [];

  // Helper for IST time
  const formatIST = (ts: number) => {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      day: "2-digit",
      month: "short"
    }).format(new Date(ts * 1000));
  };

  // 1. Structure Signals (Latest BOS / CHoCH within recent bars)
  const recentStructure = structure.signals.slice(-3);
  for (const s of recentStructure) {
    signals.push({
      id: `${symbol}-${timeframe}-${s.type}-${s.direction}-${s.time}`,
      symbol,
      companyName,
      timeframe,
      category: s.type,
      direction: s.direction,
      title: `${s.direction === "BULLISH" ? "Bullish" : "Bearish"} ${s.type}`,
      price: s.price,
      time: s.time,
      timestampIST: formatIST(s.time),
      details: { brokenLevel: s.brokenLevel }
    });
  }

  // 2. Active Fair Value Gaps
  const activeFVGs = fvgs.filter(f => !f.mitigated).slice(-3);
  for (const f of activeFVGs) {
    signals.push({
      id: `${symbol}-${timeframe}-FVG-${f.type}-${f.startTime}`,
      symbol,
      companyName,
      timeframe,
      category: "FVG",
      direction: f.type,
      title: `${f.type === "BULLISH" ? "Bullish" : "Bearish"} FVG`,
      price: f.top,
      time: f.startTime,
      timestampIST: formatIST(f.startTime),
      details: { top: f.top, bottom: f.bottom }
    });
  }

  // 3. Active Order Blocks
  const activeOBs = orderBlocks.filter(o => !o.mitigated).slice(-3);
  for (const ob of activeOBs) {
    signals.push({
      id: `${symbol}-${timeframe}-OB-${ob.type}-${ob.startTime}`,
      symbol,
      companyName,
      timeframe,
      category: "OB",
      direction: ob.type,
      title: `${ob.type === "BULLISH" ? "Bullish" : "Bearish"} OB`,
      price: ob.top,
      time: ob.startTime,
      timestampIST: formatIST(ob.startTime),
      details: { top: ob.top, bottom: ob.bottom }
    });
  }

  // 4. Equal Highs / Lows (Liquidity)
  const activeLiquidity = liquidity.filter(l => !l.swept).slice(-2);
  for (const l of activeLiquidity) {
    signals.push({
      id: `${symbol}-${timeframe}-${l.type}-${l.time2}`,
      symbol,
      companyName,
      timeframe,
      category: "LIQUIDITY",
      direction: l.type === "EQH" ? "BULLISH" : "BEARISH",
      title: l.type === "EQH" ? "Equal Highs (EQH)" : "Equal Lows (EQL)",
      price: l.level,
      time: l.time2,
      timestampIST: formatIST(l.time2),
      details: { level: l.level }
    });
  }

  return {
    symbol,
    timeframe,
    signals,
    structure,
    fvgs,
    orderBlocks,
    liquidity,
    premiumDiscount
  };
}
