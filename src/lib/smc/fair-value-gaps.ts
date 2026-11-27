/**
 * fair-value-gaps.ts
 *
 * Smart Money Concepts (SMC) Fair Value Gap (FVG) Engine:
 * - 3-Candle Imbalance calculation
 * - Bullish FVG: Candle 1 High < Candle 3 Low (Gap zone: [Candle 1 High, Candle 3 Low])
 * - Bearish FVG: Candle 1 Low > Candle 3 High (Gap zone: [Candle 3 High, Candle 1 Low])
 * - Mitigation Tracking: Tracks whether subsequent candles have re-entered or filled the zone
 */

import { Candle } from "./market-structure";

export interface FairValueGap {
  id: string;
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  startTime: number;
  endTime?: number;
  startIndex: number;
  mitigated: boolean;
  mitigatedTime?: number;
}

/**
 * Detect 3-Candle Fair Value Gaps and track mitigation
 */
export function detectFairValueGaps(candles: Candle[], minGapPercent: number = 0.05): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bullish FVG: Candle 3 Low > Candle 1 High
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high;
      const gapPercent = (gapSize / c1.high) * 100;

      if (gapPercent >= minGapPercent) {
        fvgs.push({
          id: `fvg-bull-${i}-${c2.time}`,
          type: "BULLISH",
          top: c3.low,
          bottom: c1.high,
          startTime: c2.time,
          startIndex: i - 1,
          mitigated: false
        });
      }
    }

    // Bearish FVG: Candle 3 High < Candle 1 Low
    if (c3.high < c1.low) {
      const gapSize = c1.low - c3.high;
      const gapPercent = (gapSize / c3.high) * 100;

      if (gapPercent >= minGapPercent) {
        fvgs.push({
          id: `fvg-bear-${i}-${c2.time}`,
          type: "BEARISH",
          top: c1.low,
          bottom: c3.high,
          startTime: c2.time,
          startIndex: i - 1,
          mitigated: false
        });
      }
    }
  }

  // Mitigation tracking: check subsequent price action
  for (const fvg of fvgs) {
    for (let j = fvg.startIndex + 2; j < candles.length; j++) {
      const candle = candles[j];

      if (fvg.type === "BULLISH") {
        // Price dips down into bullish gap
        if (candle.low <= fvg.bottom) {
          fvg.mitigated = true;
          fvg.mitigatedTime = candle.time;
          fvg.endTime = candle.time;
          break;
        }
      } else {
        // Price rallies up into bearish gap
        if (candle.high >= fvg.top) {
          fvg.mitigated = true;
          fvg.mitigatedTime = candle.time;
          fvg.endTime = candle.time;
          break;
        }
      }
    }
  }

  return fvgs;
}
