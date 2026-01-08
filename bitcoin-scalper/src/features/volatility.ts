/**
 * Volatility Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Calculates volatility metrics: ATR, realized volatility, regime detection.
 */

import { injectable, inject } from 'inversify';
import type { VolatilityFeatures } from '../types/decision.js';
import type { MarketRegime } from '../types/decision.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { TYPES } from '../di/types.js';

@injectable()
export class VolatilityCalculator {
    private atrHistory: number[] = [];

    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        console.log('[VolatilityCalculator] Initialized');
    }

    /**
     * Calculate all volatility features
     */
    calculate(): VolatilityFeatures {
        const timestamp = Date.now();
        const ohlc = this.candles.getOHLCArrays('5m', 50);
        const currentPrice = this.tradeTape.getLastPrice();

        // ATR (14-period on 5m candles)
        const atr14 = this.calculateATR(ohlc.high, ohlc.low, ohlc.close, 14);
        const atrPercent = currentPrice > 0 ? (atr14 / currentPrice) * 100 : 0;

        // Update ATR history for regime detection
        this.atrHistory.push(atrPercent);
        if (this.atrHistory.length > 100) {
            this.atrHistory.shift();
        }

        // Realized volatility
        const realizedVol1h = this.calculateRealizedVolatility(ohlc.close, 12); // 12 x 5m = 1h
        const realizedVol24h = this.calculateRealizedVolatility(ohlc.close, 48); // Limited by candle history

        // Volatility regime classification
        const volRegime = this.classifyVolatilityRegime(atrPercent);

        return {
            atr14,
            atrPercent,
            realizedVol1h,
            realizedVol24h,
            volRegime,
            timestamp
        };
    }

    /**
     * Calculate ATR (Average True Range)
     */
    calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
        if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
            return 0;
        }

        const trueRanges: number[] = [];

        for (let i = 1; i < highs.length; i++) {
            const high = highs[i];
            const low = lows[i];
            const prevClose = closes[i - 1];

            // True Range = max of (H-L, |H-PC|, |L-PC|)
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }

        // Calculate ATR as EMA of True Range
        if (trueRanges.length < period) return 0;

        const multiplier = 2 / (period + 1);
        let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < trueRanges.length; i++) {
            atr = (trueRanges[i] - atr) * multiplier + atr;
        }

        return atr;
    }

    /**
     * Calculate realized volatility (annualized standard deviation of returns)
     */
    private calculateRealizedVolatility(closes: number[], periods: number): number {
        if (closes.length < periods + 1) return 0;

        // Calculate log returns
        const recentCloses = closes.slice(-periods - 1);
        const logReturns: number[] = [];

        for (let i = 1; i < recentCloses.length; i++) {
            if (recentCloses[i - 1] > 0) {
                logReturns.push(Math.log(recentCloses[i] / recentCloses[i - 1]));
            }
        }

        if (logReturns.length === 0) return 0;

        // Calculate standard deviation
        const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
        const squaredDiffs = logReturns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / logReturns.length;
        const stdDev = Math.sqrt(variance);

        // Annualize (assuming 5-minute candles)
        // 288 five-minute periods per day, 365 days per year
        const annualizationFactor = Math.sqrt(288 * 365);
        return stdDev * annualizationFactor * 100;
    }

    /**
     * Classify volatility regime based on current ATR
     */
    private classifyVolatilityRegime(currentAtrPercent: number): 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' {
        if (this.atrHistory.length < 20) {
            // Not enough history, use absolute thresholds
            if (currentAtrPercent < 0.1) return 'LOW';
            if (currentAtrPercent < 0.3) return 'NORMAL';
            if (currentAtrPercent < 0.5) return 'HIGH';
            return 'EXTREME';
        }

        // Calculate percentile of current ATR in history
        const sortedHistory = [...this.atrHistory].sort((a, b) => a - b);
        const index = sortedHistory.findIndex(v => v >= currentAtrPercent);
        const percentile = index === -1 ? 1 : index / sortedHistory.length;

        if (percentile < 0.25) return 'LOW';
        if (percentile < 0.75) return 'NORMAL';
        if (percentile < 0.95) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Get ATR-based stop loss distance
     */
    getATRStopDistance(multiplier: number = 1.5): number {
        const ohlc = this.candles.getOHLCArrays('5m', 20);
        const atr = this.calculateATR(ohlc.high, ohlc.low, ohlc.close, 14);
        return atr * multiplier;
    }

    /**
     * Check if volatility is suitable for trading
     */
    isVolatilitySuitable(): { suitable: boolean; reason: string } {
        const features = this.calculate();

        if (features.volRegime === 'EXTREME') {
            return {
                suitable: false,
                reason: 'Extreme volatility - ATR at ' + features.atrPercent.toFixed(2) + '%'
            };
        }

        if (features.volRegime === 'LOW') {
            return {
                suitable: false,
                reason: 'Very low volatility - insufficient movement'
            };
        }

        return { suitable: true, reason: 'Volatility within acceptable range' };
    }
}
