/**
 * Feature Engine - Central Feature Vector Generator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Aggregates all features into a single feature vector for AI decisions.
 */

import { injectable, inject } from 'inversify';
import type { FeatureVector } from '../types/decision.js';
import { MicrostructureCalculator } from './microstructure.js';
import { MomentumCalculator } from './momentum.js';
import { MeanReversionCalculator } from './mean-reversion.js';
import { VolatilityCalculator } from './volatility.js';
import { TYPES } from '../di/types.js';

@injectable()
export class FeatureEngine {
    private lastFeatures: FeatureVector | null = null;
    private lastCalculatedAt: number = 0;
    private minRecalcIntervalMs: number = 100; // Rate limit calculations

    constructor(
        @inject(TYPES.MicrostructureCalculator) private microstructure: MicrostructureCalculator,
        @inject(TYPES.MomentumCalculator) private momentum: MomentumCalculator,
        @inject(TYPES.MeanReversionCalculator) private meanReversion: MeanReversionCalculator,
        @inject(TYPES.VolatilityCalculator) private volatility: VolatilityCalculator
    ) {
        console.log('[FeatureEngine] Initialized');
    }

    /**
     * Calculate complete feature vector
     */
    calculate(forceRecalc: boolean = false): FeatureVector {
        const now = Date.now();

        // Rate limit calculations
        if (!forceRecalc && this.lastFeatures &&
            (now - this.lastCalculatedAt) < this.minRecalcIntervalMs) {
            return this.lastFeatures;
        }

        const microstructureFeatures = this.microstructure.calculate();
        const momentumFeatures = this.momentum.calculate();
        const meanReversionFeatures = this.meanReversion.calculate();
        const volatilityFeatures = this.volatility.calculate();

        const features: FeatureVector = {
            microstructure: microstructureFeatures,
            momentum: momentumFeatures,
            meanReversion: meanReversionFeatures,
            volatility: volatilityFeatures,
            timestamp: now
        };

        this.lastFeatures = features;
        this.lastCalculatedAt = now;

        return features;
    }

    /**
     * Get last calculated features (without recalculating)
     */
    getLastFeatures(): FeatureVector | null {
        return this.lastFeatures;
    }

    /**
     * Check if features are fresh enough
     */
    areFeaturesStale(maxAgeMs: number = 1000): boolean {
        if (!this.lastFeatures) return true;
        return (Date.now() - this.lastCalculatedAt) > maxAgeMs;
    }

    /**
     * Get feature summary for logging
     */
    getFeatureSummary(): string {
        if (!this.lastFeatures) return 'No features calculated';

        const f = this.lastFeatures;
        return [
            `Spread: ${f.microstructure.spreadBps.toFixed(1)}bps`,
            `BookImb: ${(f.microstructure.bookImbalance * 100).toFixed(1)}%`,
            `RSI: ${f.momentum.rsi14.toFixed(1)}`,
            `MACD: ${f.momentum.macdHistogram.toFixed(2)}`,
            `BBPos: ${(f.meanReversion.bbPosition * 100).toFixed(1)}%`,
            `ATR: ${f.volatility.atrPercent.toFixed(2)}%`,
            `VolRegime: ${f.volatility.volRegime}`
        ].join(' | ');
    }

    /**
     * Check if market conditions are suitable for trading
     */
    areConditionsSuitable(): { suitable: boolean; reasons: string[] } {
        const features = this.calculate();
        const reasons: string[] = [];

        // Check spread
        if (features.microstructure.spreadBps > 10) {
            reasons.push(`Spread too wide: ${features.microstructure.spreadBps.toFixed(1)}bps`);
        }

        // Check volatility
        if (features.volatility.volRegime === 'EXTREME') {
            reasons.push('Extreme volatility regime');
        }

        // Check liquidity (via trade velocity as proxy)
        if (features.microstructure.tradeVelocity < 0.5) {
            reasons.push(`Low trade velocity: ${features.microstructure.tradeVelocity.toFixed(2)}/s`);
        }

        return {
            suitable: reasons.length === 0,
            reasons
        };
    }
}
