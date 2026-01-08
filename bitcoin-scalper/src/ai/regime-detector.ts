/**
 * Regime Detector - Market Regime Classification
 * Production-grade Bitcoin Scalping Bot
 * 
 * Classifies market regime for adaptive trading behavior.
 */

import { injectable, inject } from 'inversify';
import type { MarketRegime, RegimeDetectionResult } from '../types/decision.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { MomentumCalculator } from '../features/momentum.js';
import { VolatilityCalculator } from '../features/volatility.js';
import { TYPES } from '../di/types.js';

@injectable()
export class RegimeDetector {
    private currentRegime: MarketRegime = 'UNKNOWN';
    private regimeStartTime: number = Date.now();
    private regimeHistory: { regime: MarketRegime; timestamp: number }[] = [];

    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.MomentumCalculator) private momentum: MomentumCalculator,
        @inject(TYPES.VolatilityCalculator) private volatility: VolatilityCalculator
    ) {
        console.log('[RegimeDetector] Initialized');
    }

    /**
     * Detect current market regime
     */
    detect(): RegimeDetectionResult {
        const timestamp = Date.now();
        const ohlc = this.candles.getOHLCArrays('5m', 50);

        if (ohlc.close.length < 20) {
            return this.createResult('UNKNOWN', 0, {});
        }

        // Calculate regime indicators
        const trendStrength = this.calculateTrendStrength(ohlc.close);
        const volatilityLevel = this.volatility.calculate().atrPercent;
        const rangeScore = this.calculateRangeScore(ohlc.high, ohlc.low, ohlc.close);
        const momentumScore = this.calculateMomentumScore();

        const features = {
            trendStrength,
            volatilityLevel,
            rangeScore,
            momentumScore
        };

        // Classify regime
        let regime: MarketRegime;
        let confidence: number;

        if (volatilityLevel > 0.4) {
            regime = 'VOLATILE';
            confidence = Math.min(1, volatilityLevel / 0.6);
        } else if (Math.abs(trendStrength) > 0.6) {
            regime = trendStrength > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN';
            confidence = Math.abs(trendStrength);
        } else if (rangeScore > 0.7) {
            regime = 'RANGING';
            confidence = rangeScore;
        } else if (volatilityLevel < 0.1) {
            regime = 'QUIET';
            confidence = 1 - volatilityLevel * 10;
        } else {
            regime = 'UNKNOWN';
            confidence = 0.3;
        }

        // Track regime changes
        if (regime !== this.currentRegime) {
            this.regimeHistory.push({
                regime: this.currentRegime,
                timestamp: this.regimeStartTime
            });

            // Keep last 100 regime changes
            if (this.regimeHistory.length > 100) {
                this.regimeHistory.shift();
            }

            const previousRegime = this.currentRegime;
            this.currentRegime = regime;
            this.regimeStartTime = timestamp;

            console.log(`[RegimeDetector] Regime changed: ${previousRegime} -> ${regime} (confidence: ${confidence.toFixed(2)})`);
        }

        return this.createResult(regime, confidence, features);
    }

    /**
     * Get current regime (cached)
     */
    getCurrentRegime(): MarketRegime {
        return this.currentRegime;
    }

    /**
     * Get duration of current regime
     */
    getRegimeDuration(): number {
        return Date.now() - this.regimeStartTime;
    }

    /**
     * Calculate trend strength (-1 to 1)
     */
    private calculateTrendStrength(closes: number[]): number {
        if (closes.length < 20) return 0;

        // Use EMA crossovers
        const ema10 = this.momentum.calculateEMA(closes, 10);
        const ema20 = this.momentum.calculateEMA(closes, 20);

        if (ema10 === null || ema20 === null) return 0;

        // Calculate slope of recent closes
        const recentCloses = closes.slice(-10);
        const firstHalf = recentCloses.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const secondHalf = recentCloses.slice(5).reduce((a, b) => a + b, 0) / 5;
        const slope = (secondHalf - firstHalf) / firstHalf;

        // Combine EMA position and slope
        const emaDiff = (ema10 - ema20) / ema20;
        const trendStrength = (emaDiff * 10 + slope * 100) / 2;

        return Math.max(-1, Math.min(1, trendStrength));
    }

    /**
     * Calculate range score (0 to 1, higher = more ranging)
     */
    private calculateRangeScore(highs: number[], lows: number[], closes: number[]): number {
        if (highs.length < 20) return 0;

        const recentHighs = highs.slice(-20);
        const recentLows = lows.slice(-20);

        // Count how many times price touched upper/lower bounds
        const maxHigh = Math.max(...recentHighs);
        const minLow = Math.min(...recentLows);
        const range = maxHigh - minLow;

        if (range === 0) return 1;

        // Check for repeated tests of levels
        const upperBound = maxHigh - range * 0.1;
        const lowerBound = minLow + range * 0.1;

        let upperTests = 0;
        let lowerTests = 0;

        for (let i = 0; i < recentHighs.length; i++) {
            if (recentHighs[i] >= upperBound) upperTests++;
            if (recentLows[i] <= lowerBound) lowerTests++;
        }

        // High range score if multiple tests of both bounds
        const testScore = Math.min(upperTests, lowerTests) / 5;

        // Also check for mean reversion behavior
        const lastClose = closes[closes.length - 1];
        const midPoint = (maxHigh + minLow) / 2;
        const distFromMid = Math.abs(lastClose - midPoint) / range;

        return Math.min(1, testScore * (1 - distFromMid));
    }

    /**
     * Calculate momentum score
     */
    private calculateMomentumScore(): number {
        const ohlc = this.candles.getOHLCArrays('5m', 20);
        const rsi = this.momentum.calculateRSI(ohlc.close, 14);

        // Normalize RSI to -1 to 1 scale
        return (rsi - 50) / 50;
    }

    /**
     * Create regime detection result
     */
    private createResult(
        regime: MarketRegime,
        confidence: number,
        features: Record<string, number>
    ): RegimeDetectionResult {
        return {
            currentRegime: regime,
            confidence,
            regimeStartedAt: this.regimeStartTime,
            regimeDurationMs: Date.now() - this.regimeStartTime,
            previousRegime: this.regimeHistory.length > 0
                ? this.regimeHistory[this.regimeHistory.length - 1].regime
                : undefined,
            features,
            timestamp: Date.now()
        };
    }

    /**
     * Check if regime is favorable for trading
     */
    isFavorableForTrading(): { favorable: boolean; reason: string } {
        const regime = this.currentRegime;

        if (regime === 'VOLATILE') {
            return {
                favorable: false,
                reason: 'High volatility regime - reduce position sizes'
            };
        }

        if (regime === 'QUIET') {
            return {
                favorable: false,
                reason: 'Low volatility regime - insufficient movement'
            };
        }

        if (regime === 'UNKNOWN') {
            return {
                favorable: false,
                reason: 'Regime uncertain - wait for clarity'
            };
        }

        return { favorable: true, reason: `${regime} regime is suitable for trading` };
    }
}
