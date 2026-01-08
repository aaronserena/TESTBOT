/**
 * Position Sizer - Risk-Adjusted Position Sizing
 * Production-grade Bitcoin Scalping Bot
 * 
 * Implements fixed-fractional and volatility-based position sizing.
 */

import { injectable, inject } from 'inversify';
import { RulebookEngine } from '../risk/rulebook.js';
import { VolatilityCalculator } from '../features/volatility.js';
import { TYPES } from '../di/types.js';

export interface SizingResult {
    sizeBTC: number;
    sizeUSD: number;
    riskAmount: number;
    stopDistance: number;
    method: 'FIXED_FRACTIONAL' | 'VOLATILITY_BASED';
}

@injectable()
export class PositionSizer {
    private accountEquity: number = 10000; // Default, should be updated
    private riskPerTrade: number = 0.01;   // 1% risk per trade

    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine,
        @inject(TYPES.VolatilityCalculator) private volatility: VolatilityCalculator
    ) {
        console.log('[PositionSizer] Initialized');
    }

    /**
     * Update account equity
     */
    setAccountEquity(equity: number): void {
        this.accountEquity = equity;
    }

    /**
     * Set risk per trade (as decimal, e.g., 0.01 = 1%)
     */
    setRiskPerTrade(risk: number): void {
        this.riskPerTrade = Math.min(0.02, Math.max(0.001, risk)); // 0.1% to 2%
    }

    /**
     * Calculate position size using fixed-fractional method
     * Risk 1% of equity on each trade
     */
    calculateFixedFractional(
        entryPrice: number,
        stopLossPrice: number
    ): SizingResult {
        const rules = this.rulebook.getRulebook();
        const riskAmount = this.accountEquity * this.riskPerTrade;
        const stopDistance = Math.abs(entryPrice - stopLossPrice);

        if (stopDistance === 0) {
            return {
                sizeBTC: 0,
                sizeUSD: 0,
                riskAmount: 0,
                stopDistance: 0,
                method: 'FIXED_FRACTIONAL'
            };
        }

        // Calculate size in BTC
        let sizeBTC = riskAmount / stopDistance;

        // Apply rulebook limits
        sizeBTC = Math.min(sizeBTC, rules.maxPositionSizeBTC);

        // Ensure minimum size (0.001 BTC)
        if (sizeBTC < 0.001) {
            sizeBTC = 0;
        }

        const sizeUSD = sizeBTC * entryPrice;

        return {
            sizeBTC,
            sizeUSD,
            riskAmount,
            stopDistance,
            method: 'FIXED_FRACTIONAL'
        };
    }

    /**
     * Calculate position size using ATR-based volatility method
     */
    calculateVolatilityBased(
        entryPrice: number,
        atrMultiplier: number = 1.5
    ): SizingResult {
        const rules = this.rulebook.getRulebook();
        const riskAmount = this.accountEquity * this.riskPerTrade;

        // Get ATR for stop distance
        const atr = this.volatility.getATRStopDistance(atrMultiplier);
        const stopDistance = atr;

        if (stopDistance === 0 || atr === 0) {
            return {
                sizeBTC: 0,
                sizeUSD: 0,
                riskAmount: 0,
                stopDistance: 0,
                method: 'VOLATILITY_BASED'
            };
        }

        // Calculate size in BTC
        let sizeBTC = riskAmount / stopDistance;

        // Apply rulebook limits
        sizeBTC = Math.min(sizeBTC, rules.maxPositionSizeBTC);

        // Ensure minimum size
        if (sizeBTC < 0.001) {
            sizeBTC = 0;
        }

        const sizeUSD = sizeBTC * entryPrice;

        return {
            sizeBTC,
            sizeUSD,
            riskAmount,
            stopDistance,
            method: 'VOLATILITY_BASED'
        };
    }

    /**
     * Calculate recommended position size (uses volatility method by default)
     */
    calculateRecommended(entryPrice: number): SizingResult {
        return this.calculateVolatilityBased(entryPrice);
    }

    /**
     * Scale position size by a factor (for partial entries/exits)
     */
    scaleSize(sizeBTC: number, scaleFactor: number): number {
        const rules = this.rulebook.getRulebook();
        const scaled = sizeBTC * scaleFactor;
        return Math.min(scaled, rules.maxPositionSizeBTC);
    }

    /**
     * Check if position size is valid
     */
    isValidSize(sizeBTC: number): { valid: boolean; reason?: string } {
        const rules = this.rulebook.getRulebook();

        if (sizeBTC <= 0) {
            return { valid: false, reason: 'Size must be positive' };
        }

        if (sizeBTC < 0.001) {
            return { valid: false, reason: 'Size below minimum (0.001 BTC)' };
        }

        if (sizeBTC > rules.maxPositionSizeBTC) {
            return { valid: false, reason: `Size exceeds max (${rules.maxPositionSizeBTC} BTC)` };
        }

        return { valid: true };
    }

    /**
     * Get maximum position size allowed
     */
    getMaxSize(): number {
        return this.rulebook.getRulebook().maxPositionSizeBTC;
    }

    /**
     * Get current equity
     */
    getEquity(): number {
        return this.accountEquity;
    }
}
