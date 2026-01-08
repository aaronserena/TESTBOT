/**
 * Mean Reversion Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Calculates mean reversion signals: Bollinger Bands, VWAP, order flow.
 */

import { injectable, inject } from 'inversify';
import type { MeanReversionFeatures } from '../types/decision.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { OrderBookManager } from '../data/orderbook.js';
import { TYPES } from '../di/types.js';

@injectable()
export class MeanReversionCalculator {
    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor,
        @inject(TYPES.OrderBookManager) private orderBook: OrderBookManager
    ) {
        console.log('[MeanReversionCalculator] Initialized');
    }

    /**
     * Calculate all mean reversion features
     */
    calculate(): MeanReversionFeatures {
        const timestamp = Date.now();
        const closes = this.candles.getOHLCArrays('5m', 50);
        const currentPrice = this.tradeTape.getLastPrice();

        // Bollinger Bands (20-period, 2 std dev)
        const bb = this.calculateBollingerBands(closes.close, 20, 2);

        // VWAP
        const vwap = this.tradeTape.getVWAP(3600000); // 1 hour VWAP

        // Price vs VWAP
        const priceVsVwap = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;

        // Position within Bollinger Bands (-1 = at lower, 0 = at middle, 1 = at upper)
        let bbPosition = 0;
        if (bb.upper > bb.lower) {
            bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
            // Extend range beyond bands
            if (currentPrice < bb.lower) {
                bbPosition = (currentPrice - bb.middle) / (bb.middle - bb.lower);
            } else if (currentPrice > bb.upper) {
                bbPosition = 1 + (currentPrice - bb.upper) / (bb.upper - bb.middle);
            }
        }

        // Order flow imbalance (for mean reversion signals)
        const orderFlowImbalance = this.calculateOrderFlowImbalance();

        return {
            bbUpper: bb.upper || currentPrice * 1.01,
            bbMiddle: bb.middle || currentPrice,
            bbLower: bb.lower || currentPrice * 0.99,
            bbWidth: bb.width,
            bbPosition,
            vwap: vwap || currentPrice,
            priceVsVwap,
            orderFlowImbalance,
            timestamp
        };
    }

    /**
     * Calculate Bollinger Bands
     */
    private calculateBollingerBands(
        closes: number[],
        period: number = 20,
        stdDevMultiplier: number = 2
    ): { upper: number; middle: number; lower: number; width: number } {
        if (closes.length < period) {
            return { upper: 0, middle: 0, lower: 0, width: 0 };
        }

        // Get last N closes
        const recentCloses = closes.slice(-period);

        // Calculate SMA (middle band)
        const sma = recentCloses.reduce((a, b) => a + b, 0) / period;

        // Calculate standard deviation
        const squaredDiffs = recentCloses.map(x => Math.pow(x - sma, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(variance);

        const upper = sma + (stdDev * stdDevMultiplier);
        const lower = sma - (stdDev * stdDevMultiplier);
        const width = sma > 0 ? ((upper - lower) / sma) * 100 : 0;

        return { upper, middle: sma, lower, width };
    }

    /**
     * Calculate order flow imbalance for mean reversion
     * Uses combination of trade flow and order book
     */
    private calculateOrderFlowImbalance(): number {
        // Trade-based imbalance
        const tradeImbalance = this.tradeTape.getVolumeImbalance(60000);

        // Order book imbalance
        const bookImbalance = this.orderBook.getImbalance(5);

        // Combined weighted imbalance
        // Trade flow is more important for mean reversion
        return (tradeImbalance * 0.6) + (bookImbalance * 0.4);
    }

    /**
     * Check if price is at extreme levels (potential mean reversion)
     */
    isAtExtreme(threshold: number = 0.95): {
        atExtreme: boolean;
        direction: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
        strength: number;
    } {
        const features = this.calculate();

        if (features.bbPosition > threshold) {
            return {
                atExtreme: true,
                direction: 'OVERBOUGHT',
                strength: features.bbPosition
            };
        }

        if (features.bbPosition < (1 - threshold)) {
            return {
                atExtreme: true,
                direction: 'OVERSOLD',
                strength: 1 - features.bbPosition
            };
        }

        return {
            atExtreme: false,
            direction: 'NEUTRAL',
            strength: 0.5 - Math.abs(0.5 - features.bbPosition)
        };
    }
}
