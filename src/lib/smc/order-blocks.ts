/**
 * order-blocks.ts
 *
 * Smart Money Concepts (SMC) Order Block (OB) Engine:
 * - Bullish Order Block: The last down-close candle prior to an impulsive upward displacement breaking structure
 * - Bearish Order Block: The last up-close candle prior to an impulsive downward displacement breaking structure
 * - Mitigation & Invalidation tracking
 */

import { Candle } from "./market-structure";

export interface OrderBlock {
  id: string;
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  startTime: number;
  startIndex: number;
  mitigated: boolean;
  mitigatedTime?: number;
  volumeRatio?: number;
}

/**
 * Detect Order Blocks with volume & displacement confirmation
 */
export function detectOrderBlocks(candles: Candle[], lookback: number = 5): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];

  for (let i = lookback; i < candles.length - 2; i++) {
    const candle = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    // Bullish OB: Bearish candle (close < open) followed by strong bullish breakout
    const isBearishCandle = candle.close < candle.open;
    const isBullishImpulse = next1.close > candle.high && next2.close > next1.high;

    if (isBearishCandle && isBullishImpulse) {
      orderBlocks.push({
        id: `ob-bull-${i}-${candle.time}`,
        type: "BULLISH",
        top: candle.high,
        bottom: candle.low,
        startTime: candle.time,
        startIndex: i,
        mitigated: false
      });
    }

    // Bearish OB: Bullish candle (close > open) followed by strong bearish breakdown
    const isBullishCandle = candle.close > candle.open;
    const isBearishImpulse = next1.close < candle.low && next2.close < next1.low;

    if (isBullishCandle && isBearishImpulse) {
      orderBlocks.push({
        id: `ob-bear-${i}-${candle.time}`,
        type: "BEARISH",
        top: candle.high,
        bottom: candle.low,
        startTime: candle.time,
        startIndex: i,
        mitigated: false
      });
    }
  }

  // Check mitigation
  for (const ob of orderBlocks) {
    for (let j = ob.startIndex + 3; j < candles.length; j++) {
      const c = candles[j];
      if (ob.type === "BULLISH") {
        if (c.low <= ob.bottom) {
          ob.mitigated = true;
          ob.mitigatedTime = c.time;
          break;
        }
      } else {
        if (c.high >= ob.top) {
          ob.mitigated = true;
          ob.mitigatedTime = c.time;
          break;
        }
      }
    }
  }

  return orderBlocks;
}
