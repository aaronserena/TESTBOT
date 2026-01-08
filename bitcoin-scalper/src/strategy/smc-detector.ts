/**
 * SMC Detector - Smart Money Concepts Pattern Detection
 * Production-grade Bitcoin Scalping Bot
 * 
 * Detects SMC patterns: Break of Structure (BOS), Change of Character (CHoCH),
 * Fair Value Gaps (FVG), and Order Blocks.
 */

import { injectable, inject } from 'inversify';
import type { Candle } from '../types/core.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { TYPES } from '../di/types.js';

export interface SwingPoint {
    type: 'HIGH' | 'LOW';
    price: number;
    index: number;
    timestamp: number;
}

export interface StructureBreak {
    type: 'BOS' | 'CHOCH';
    direction: 'BULLISH' | 'BEARISH';
    price: number;
    timestamp: number;
    confirmed: boolean;
}

export interface FairValueGap {
    type: 'BULLISH' | 'BEARISH';
    high: number;
    low: number;
    midpoint: number;
    timestamp: number;
    filled: boolean;
}

export interface OrderBlock {
    type: 'BULLISH' | 'BEARISH';
    high: number;
    low: number;
    timestamp: number;
    tested: boolean;
    invalidated: boolean;
}

@injectable()
export class SMCDetector {
    private swingPoints: SwingPoint[] = [];
    private structureBreaks: StructureBreak[] = [];
    private fairValueGaps: FairValueGap[] = [];
    private orderBlocks: OrderBlock[] = [];
    private currentTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator
    ) {
        console.log('[SMCDetector] Initialized');
    }

    /**
     * Update all SMC analysis
     */
    update(): void {
        const candles = this.candles.getCandles('5m', 100);
        if (candles.length < 10) return;

        this.detectSwingPoints(candles);
        this.detectStructureBreaks(candles);
        this.detectFairValueGaps(candles);
        this.detectOrderBlocks(candles);
        this.updateFVGStatus(candles);
        this.updateOrderBlockStatus(candles);
    }

    /**
     * Detect swing highs and lows
     */
    private detectSwingPoints(candles: Candle[]): void {
        this.swingPoints = [];
        const lookback = 3;

        for (let i = lookback; i < candles.length - lookback; i++) {
            // Check for swing high
            let isSwingHigh = true;
            let isSwingLow = true;

            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j === i) continue;
                if (candles[j].high >= candles[i].high) isSwingHigh = false;
                if (candles[j].low <= candles[i].low) isSwingLow = false;
            }

            if (isSwingHigh) {
                this.swingPoints.push({
                    type: 'HIGH',
                    price: candles[i].high,
                    index: i,
                    timestamp: candles[i].openTime
                });
            }

            if (isSwingLow) {
                this.swingPoints.push({
                    type: 'LOW',
                    price: candles[i].low,
                    index: i,
                    timestamp: candles[i].openTime
                });
            }
        }

        // Sort by timestamp
        this.swingPoints.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Detect Break of Structure and Change of Character
     */
    private detectStructureBreaks(candles: Candle[]): void {
        this.structureBreaks = [];
        if (this.swingPoints.length < 4) return;

        const recentSwings = this.swingPoints.slice(-20);
        const currentPrice = candles[candles.length - 1].close;

        // Find last significant swing high and low
        const swingHighs = recentSwings.filter(s => s.type === 'HIGH');
        const swingLows = recentSwings.filter(s => s.type === 'LOW');

        if (swingHighs.length < 2 || swingLows.length < 2) return;

        const lastSwingHigh = swingHighs[swingHighs.length - 1];
        const prevSwingHigh = swingHighs[swingHighs.length - 2];
        const lastSwingLow = swingLows[swingLows.length - 1];
        const prevSwingLow = swingLows[swingLows.length - 2];

        // Determine current trend
        if (lastSwingHigh.price > prevSwingHigh.price && lastSwingLow.price > prevSwingLow.price) {
            this.currentTrend = 'BULLISH';
        } else if (lastSwingHigh.price < prevSwingHigh.price && lastSwingLow.price < prevSwingLow.price) {
            this.currentTrend = 'BEARISH';
        }

        // Check for current break
        for (let i = candles.length - 5; i < candles.length; i++) {
            const candle = candles[i];

            // Bullish BOS: Close above last swing high in uptrend
            if (this.currentTrend === 'BULLISH' && candle.close > lastSwingHigh.price) {
                this.structureBreaks.push({
                    type: 'BOS',
                    direction: 'BULLISH',
                    price: lastSwingHigh.price,
                    timestamp: candle.openTime,
                    confirmed: candle.isClosed
                });
            }

            // Bearish BOS: Close below last swing low in downtrend
            if (this.currentTrend === 'BEARISH' && candle.close < lastSwingLow.price) {
                this.structureBreaks.push({
                    type: 'BOS',
                    direction: 'BEARISH',
                    price: lastSwingLow.price,
                    timestamp: candle.openTime,
                    confirmed: candle.isClosed
                });
            }

            // Bullish CHoCH: In downtrend, close above last swing high
            if (this.currentTrend === 'BEARISH' && candle.close > lastSwingHigh.price) {
                this.structureBreaks.push({
                    type: 'CHOCH',
                    direction: 'BULLISH',
                    price: lastSwingHigh.price,
                    timestamp: candle.openTime,
                    confirmed: candle.isClosed
                });
            }

            // Bearish CHoCH: In uptrend, close below last swing low
            if (this.currentTrend === 'BULLISH' && candle.close < lastSwingLow.price) {
                this.structureBreaks.push({
                    type: 'CHOCH',
                    direction: 'BEARISH',
                    price: lastSwingLow.price,
                    timestamp: candle.openTime,
                    confirmed: candle.isClosed
                });
            }
        }
    }

    /**
     * Detect Fair Value Gaps (imbalances)
     */
    private detectFairValueGaps(candles: Candle[]): void {
        // Keep only unfilled FVGs
        this.fairValueGaps = this.fairValueGaps.filter(fvg => !fvg.filled);

        for (let i = 2; i < candles.length; i++) {
            const candle1 = candles[i - 2];
            const candle2 = candles[i - 1];
            const candle3 = candles[i];

            // Bullish FVG: Gap between candle 1 high and candle 3 low
            if (candle3.low > candle1.high) {
                const existing = this.fairValueGaps.find(
                    fvg => fvg.timestamp === candle2.openTime && fvg.type === 'BULLISH'
                );
                if (!existing) {
                    this.fairValueGaps.push({
                        type: 'BULLISH',
                        low: candle1.high,
                        high: candle3.low,
                        midpoint: (candle1.high + candle3.low) / 2,
                        timestamp: candle2.openTime,
                        filled: false
                    });
                }
            }

            // Bearish FVG: Gap between candle 3 high and candle 1 low
            if (candle3.high < candle1.low) {
                const existing = this.fairValueGaps.find(
                    fvg => fvg.timestamp === candle2.openTime && fvg.type === 'BEARISH'
                );
                if (!existing) {
                    this.fairValueGaps.push({
                        type: 'BEARISH',
                        high: candle1.low,
                        low: candle3.high,
                        midpoint: (candle1.low + candle3.high) / 2,
                        timestamp: candle2.openTime,
                        filled: false
                    });
                }
            }
        }
    }

    /**
     * Detect Order Blocks
     */
    private detectOrderBlocks(candles: Candle[]): void {
        // Keep only valid order blocks
        this.orderBlocks = this.orderBlocks.filter(ob => !ob.invalidated);

        for (const sb of this.structureBreaks) {
            if (!sb.confirmed) continue;

            const breakIndex = candles.findIndex(c => c.openTime === sb.timestamp);
            if (breakIndex < 1) continue;

            // Bullish OB: Last bearish candle before bullish BOS
            if (sb.direction === 'BULLISH') {
                for (let i = breakIndex - 1; i >= Math.max(0, breakIndex - 5); i--) {
                    if (candles[i].close < candles[i].open) {  // Bearish candle
                        const existing = this.orderBlocks.find(
                            ob => ob.timestamp === candles[i].openTime && ob.type === 'BULLISH'
                        );
                        if (!existing) {
                            this.orderBlocks.push({
                                type: 'BULLISH',
                                high: candles[i].high,
                                low: candles[i].low,
                                timestamp: candles[i].openTime,
                                tested: false,
                                invalidated: false
                            });
                        }
                        break;
                    }
                }
            }

            // Bearish OB: Last bullish candle before bearish BOS
            if (sb.direction === 'BEARISH') {
                for (let i = breakIndex - 1; i >= Math.max(0, breakIndex - 5); i--) {
                    if (candles[i].close > candles[i].open) {  // Bullish candle
                        const existing = this.orderBlocks.find(
                            ob => ob.timestamp === candles[i].openTime && ob.type === 'BEARISH'
                        );
                        if (!existing) {
                            this.orderBlocks.push({
                                type: 'BEARISH',
                                high: candles[i].high,
                                low: candles[i].low,
                                timestamp: candles[i].openTime,
                                tested: false,
                                invalidated: false
                            });
                        }
                        break;
                    }
                }
            }
        }
    }

    /**
     * Update FVG fill status
     */
    private updateFVGStatus(candles: Candle[]): void {
        const currentPrice = candles[candles.length - 1].close;

        for (const fvg of this.fairValueGaps) {
            if (fvg.filled) continue;

            // Check if FVG has been filled (price passed through entirely)
            if (fvg.type === 'BULLISH') {
                if (currentPrice <= fvg.low) {
                    fvg.filled = true;
                }
            } else {
                if (currentPrice >= fvg.high) {
                    fvg.filled = true;
                }
            }
        }
    }

    /**
     * Update Order Block status
     */
    private updateOrderBlockStatus(candles: Candle[]): void {
        const currentPrice = candles[candles.length - 1].close;

        for (const ob of this.orderBlocks) {
            if (ob.invalidated) continue;

            // Check if OB has been tested
            if (ob.type === 'BULLISH') {
                if (currentPrice <= ob.high && currentPrice >= ob.low) {
                    ob.tested = true;
                }
                // Invalidate if price closes below OB
                if (currentPrice < ob.low) {
                    ob.invalidated = true;
                }
            } else {
                if (currentPrice >= ob.low && currentPrice <= ob.high) {
                    ob.tested = true;
                }
                // Invalidate if price closes above OB
                if (currentPrice > ob.high) {
                    ob.invalidated = true;
                }
            }
        }
    }

    // Getters
    getCurrentTrend(): 'BULLISH' | 'BEARISH' | 'NEUTRAL' { return this.currentTrend; }
    getSwingPoints(): SwingPoint[] { return this.swingPoints; }
    getStructureBreaks(): StructureBreak[] { return this.structureBreaks; }
    getFairValueGaps(): FairValueGap[] { return this.fairValueGaps.filter(fvg => !fvg.filled); }
    getOrderBlocks(): OrderBlock[] { return this.orderBlocks.filter(ob => !ob.invalidated); }
    getRecentBOS(): StructureBreak | null {
        return this.structureBreaks.filter(sb => sb.type === 'BOS').pop() || null;
    }
    getRecentCHOCH(): StructureBreak | null {
        return this.structureBreaks.filter(sb => sb.type === 'CHOCH').pop() || null;
    }
}
