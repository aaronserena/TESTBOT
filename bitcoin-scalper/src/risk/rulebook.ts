/**
 * Rulebook Engine - Immutable Risk Rules
 * Production-grade Bitcoin Scalping Bot
 * 
 * CRITICAL: This module defines hard limits that CANNOT be modified at runtime.
 * All trades must pass through these checks before execution.
 */

import { injectable } from 'inversify';
import {
    RulebookConfig,
    DEFAULT_RULEBOOK,
    RiskCheckResult,
    RulebookConfigSchema
} from '../types/risk.js';
import type { Order, Position } from '../types/core.js';
import type { AIDecisionResponse } from '../types/decision.js';

@injectable()
export class RulebookEngine {
    private readonly rulebook: Readonly<RulebookConfig>;

    constructor(customRulebook?: Partial<RulebookConfig>) {
        // Merge custom config with defaults, then freeze
        const mergedConfig = { ...DEFAULT_RULEBOOK, ...customRulebook };

        // Validate the configuration
        const validated = RulebookConfigSchema.parse(mergedConfig);

        // Freeze to prevent runtime modification
        this.rulebook = Object.freeze(validated);

        console.log('[RulebookEngine] Initialized with immutable rulebook');
    }

    /**
     * Get a copy of the rulebook (read-only)
     */
    getRulebook(): Readonly<RulebookConfig> {
        return this.rulebook;
    }

    /**
     * Check if position size is within limits
     */
    checkPositionSize(sizeBTC: number): RiskCheckResult {
        const passed = sizeBTC <= this.rulebook.maxPositionSizeBTC;
        return {
            passed,
            checkName: 'POSITION_SIZE',
            reason: passed ? undefined : `Position size ${sizeBTC} exceeds max ${this.rulebook.maxPositionSizeBTC}`,
            value: sizeBTC,
            limit: this.rulebook.maxPositionSizeBTC,
            timestamp: Date.now()
        };
    }

    /**
     * Check if exposure is within limits
     */
    checkExposure(exposurePercent: number): RiskCheckResult {
        const passed = exposurePercent <= this.rulebook.maxExposurePercent;
        return {
            passed,
            checkName: 'EXPOSURE',
            reason: passed ? undefined : `Exposure ${exposurePercent}% exceeds max ${this.rulebook.maxExposurePercent}%`,
            value: exposurePercent,
            limit: this.rulebook.maxExposurePercent,
            timestamp: Date.now()
        };
    }

    /**
     * Check if daily loss is within limits
     */
    checkDailyLoss(dailyLossPercent: number): RiskCheckResult {
        const passed = dailyLossPercent <= this.rulebook.maxDailyLossPercent;
        return {
            passed,
            checkName: 'DAILY_LOSS',
            reason: passed ? undefined : `Daily loss ${dailyLossPercent}% exceeds max ${this.rulebook.maxDailyLossPercent}%`,
            value: dailyLossPercent,
            limit: this.rulebook.maxDailyLossPercent,
            timestamp: Date.now()
        };
    }

    /**
     * Check if drawdown is within limits
     */
    checkDrawdown(drawdownPercent: number): RiskCheckResult {
        const passed = drawdownPercent <= this.rulebook.maxDrawdownPercent;
        return {
            passed,
            checkName: 'DRAWDOWN',
            reason: passed ? undefined : `Drawdown ${drawdownPercent}% exceeds max ${this.rulebook.maxDrawdownPercent}%`,
            value: drawdownPercent,
            limit: this.rulebook.maxDrawdownPercent,
            timestamp: Date.now()
        };
    }

    /**
     * Check if spread is acceptable
     */
    checkSpread(spreadBps: number): RiskCheckResult {
        const passed = spreadBps <= this.rulebook.maxSpreadBps;
        return {
            passed,
            checkName: 'SPREAD',
            reason: passed ? undefined : `Spread ${spreadBps}bps exceeds max ${this.rulebook.maxSpreadBps}bps`,
            value: spreadBps,
            limit: this.rulebook.maxSpreadBps,
            timestamp: Date.now()
        };
    }

    /**
     * Check if expected slippage is acceptable
     */
    checkSlippage(expectedSlippageBps: number): RiskCheckResult {
        const passed = expectedSlippageBps <= this.rulebook.maxSlippageBps;
        return {
            passed,
            checkName: 'SLIPPAGE',
            reason: passed ? undefined : `Expected slippage ${expectedSlippageBps}bps exceeds max ${this.rulebook.maxSlippageBps}bps`,
            value: expectedSlippageBps,
            limit: this.rulebook.maxSlippageBps,
            timestamp: Date.now()
        };
    }

    /**
     * Check if liquidity meets minimum
     */
    checkLiquidity(liquidityBTC: number): RiskCheckResult {
        const passed = liquidityBTC >= this.rulebook.minLiquidityBTC;
        return {
            passed,
            checkName: 'LIQUIDITY',
            reason: passed ? undefined : `Liquidity ${liquidityBTC} BTC below minimum ${this.rulebook.minLiquidityBTC} BTC`,
            value: liquidityBTC,
            limit: this.rulebook.minLiquidityBTC,
            timestamp: Date.now()
        };
    }

    /**
     * Check if hold time is within bounds
     */
    checkHoldTime(holdTimeMs: number): RiskCheckResult {
        const withinMin = holdTimeMs >= this.rulebook.minHoldTimeMs;
        const withinMax = holdTimeMs <= this.rulebook.maxHoldTimeMs;
        const passed = withinMin && withinMax;

        let reason: string | undefined;
        if (!withinMin) {
            reason = `Hold time ${holdTimeMs}ms below minimum ${this.rulebook.minHoldTimeMs}ms`;
        } else if (!withinMax) {
            reason = `Hold time ${holdTimeMs}ms exceeds maximum ${this.rulebook.maxHoldTimeMs}ms`;
        }

        return {
            passed,
            checkName: 'HOLD_TIME',
            reason,
            value: holdTimeMs,
            limit: this.rulebook.maxHoldTimeMs,
            timestamp: Date.now()
        };
    }

    /**
     * Check if order rate is within limits
     */
    checkOrderRate(ordersLastMinute: number, ordersLastHour: number): RiskCheckResult {
        const withinMinute = ordersLastMinute < this.rulebook.maxOrdersPerMinute;
        const withinHour = ordersLastHour < this.rulebook.maxOrdersPerHour;
        const passed = withinMinute && withinHour;

        let reason: string | undefined;
        if (!withinMinute) {
            reason = `Orders last minute (${ordersLastMinute}) at limit ${this.rulebook.maxOrdersPerMinute}`;
        } else if (!withinHour) {
            reason = `Orders last hour (${ordersLastHour}) at limit ${this.rulebook.maxOrdersPerHour}`;
        }

        return {
            passed,
            checkName: 'ORDER_RATE',
            reason,
            value: ordersLastMinute,
            limit: this.rulebook.maxOrdersPerMinute,
            timestamp: Date.now()
        };
    }

    /**
     * Check if consecutive losses are within limits
     */
    checkConsecutiveLosses(consecutiveLosses: number): RiskCheckResult {
        const passed = consecutiveLosses < this.rulebook.maxConsecutiveLosses;
        return {
            passed,
            checkName: 'CONSECUTIVE_LOSSES',
            reason: passed ? undefined : `Consecutive losses (${consecutiveLosses}) at limit ${this.rulebook.maxConsecutiveLosses}`,
            value: consecutiveLosses,
            limit: this.rulebook.maxConsecutiveLosses,
            timestamp: Date.now()
        };
    }

    /**
     * Check if leverage is within limits
     */
    checkLeverage(leverage: number): RiskCheckResult {
        const passed = leverage <= this.rulebook.maxLeverage;
        return {
            passed,
            checkName: 'LEVERAGE',
            reason: passed ? undefined : `Leverage ${leverage}x exceeds max ${this.rulebook.maxLeverage}x`,
            value: leverage,
            limit: this.rulebook.maxLeverage,
            timestamp: Date.now()
        };
    }

    /**
     * Check if kill switch is active
     */
    checkKillSwitch(): RiskCheckResult {
        const passed = !this.rulebook.killSwitchEnabled;
        return {
            passed,
            checkName: 'KILL_SWITCH',
            reason: passed ? undefined : 'Kill switch is active - all trading halted',
            timestamp: Date.now()
        };
    }

    /**
     * Bound a hold time to within limits
     */
    boundHoldTime(holdTimeMs: number): number {
        return Math.max(
            this.rulebook.minHoldTimeMs,
            Math.min(this.rulebook.maxHoldTimeMs, holdTimeMs)
        );
    }

    /**
     * Bound a position size to within limits
     */
    boundPositionSize(sizeBTC: number): number {
        return Math.min(this.rulebook.maxPositionSizeBTC, Math.max(0, sizeBTC));
    }

    /**
     * Validate an AI decision against all relevant rules
     */
    validateDecision(
        decision: AIDecisionResponse,
        context: {
            currentExposurePercent: number;
            dailyLossPercent: number;
            drawdownPercent: number;
            spreadBps: number;
            expectedSlippageBps: number;
            liquidityBTC: number;
            ordersLastMinute: number;
            ordersLastHour: number;
            consecutiveLosses: number;
            currentLeverage: number;
        }
    ): RiskCheckResult[] {
        const checks: RiskCheckResult[] = [];

        // Position size check
        checks.push(this.checkPositionSize(decision.size));

        // Exposure check (current + new position)
        checks.push(this.checkExposure(context.currentExposurePercent));

        // Loss limits
        checks.push(this.checkDailyLoss(context.dailyLossPercent));
        checks.push(this.checkDrawdown(context.drawdownPercent));

        // Market conditions
        checks.push(this.checkSpread(context.spreadBps));
        checks.push(this.checkSlippage(context.expectedSlippageBps));
        checks.push(this.checkLiquidity(context.liquidityBTC));

        // Hold time
        checks.push(this.checkHoldTime(decision.holdTimeMs));

        // Rate limiting
        checks.push(this.checkOrderRate(context.ordersLastMinute, context.ordersLastHour));

        // Streak check
        checks.push(this.checkConsecutiveLosses(context.consecutiveLosses));

        // Leverage
        checks.push(this.checkLeverage(context.currentLeverage));

        // Kill switch
        checks.push(this.checkKillSwitch());

        return checks;
    }
}
