/**
 * market-structure.ts
 *
 * Smart Money Concepts (SMC) Market Structure Engine:
 * - Swing Highs & Swing Lows (Fractal pivot points)
 * - Break of Structure (BOS): Trend continuation breakout
 * - Change of Character (CHoCH): Trend reversal breakout
 * - Internal & Swing structure tracking
 */

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "HIGH" | "LOW";
  broken?: boolean;
}

export interface StructureSignal {
  type: "BOS" | "CHoCH";
  direction: "BULLISH" | "BEARISH";
  time: number;
  price: number;
  brokenLevel: number;
  candleIndex: number;
}

/**
 * Identify confirmed swing pivot highs and lows
 * @param candles OHLC array
 * @param length Left & right confirmation bars (e.g., 5 for swing, 3 for internal)
 */
export function detectSwingPoints(candles: Candle[], length: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let i = length; i < candles.length - length; i++) {
    const current = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= length; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high > current.high) {
        isHigh = false;
      }
      if (candles[i - j].low <= current.low || candles[i + j].low < current.low) {
        isLow = false;
      }
    }

    if (isHigh) {
      swings.push({ index: i, time: current.time, price: current.high, type: "HIGH" });
    }
    if (isLow) {
      swings.push({ index: i, time: current.time, price: current.low, type: "LOW" });
    }
  }

  return swings;
}

/**
 * Detect BOS (Break of Structure) and CHoCH (Change of Character)
 */
export function detectMarketStructure(candles: Candle[], swingLength: number = 5): {
  signals: StructureSignal[];
  swings: SwingPoint[];
  currentTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
} {
  const swings = detectSwingPoints(candles, swingLength);
  const signals: StructureSignal[] = [];

  let trend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (let i = swingLength * 2; i < candles.length; i++) {
    const candle = candles[i];

    // Find latest confirmed swings up to this point
    const availableSwings = swings.filter(s => s.index < i);
    const activeHighs = availableSwings.filter(s => s.type === "HIGH" && !s.broken);
    const activeLows = availableSwings.filter(s => s.type === "LOW" && !s.broken);

    const prevHigh = activeHighs.length > 0 ? activeHighs[activeHighs.length - 1] : null;
    const prevLow = activeLows.length > 0 ? activeLows[activeLows.length - 1] : null;

    // Check Bullish Breakout (Candle Close breaks above Swing High)
    if (prevHigh && candle.close > prevHigh.price) {
      prevHigh.broken = true;
      const isReversal = trend === "BEARISH";
      signals.push({
        type: isReversal ? "CHoCH" : "BOS",
        direction: "BULLISH",
        time: candle.time,
        price: candle.close,
        brokenLevel: prevHigh.price,
        candleIndex: i
      });
      trend = "BULLISH";
    }

    // Check Bearish Breakdown (Candle Close breaks below Swing Low)
    if (prevLow && candle.close < prevLow.price) {
      prevLow.broken = true;
      const isReversal = trend === "BULLISH";
      signals.push({
        type: isReversal ? "CHoCH" : "BOS",
        direction: "BEARISH",
        time: candle.time,
        price: candle.close,
        brokenLevel: prevLow.price,
        candleIndex: i
      });
      trend = "BEARISH";
    }
  }

  return { signals, swings, currentTrend: trend };
}
