/**
 * Risk Types - Risk Management & Rulebook
 * Production-grade Bitcoin Scalping Bot
 * 
 * CRITICAL: These types define the hard limits that CANNOT be bypassed.
 * The Risk module has absolute veto power over all AI decisions.
 */

import { z } from 'zod';

// ============================================================================
// Rulebook Configuration (IMMUTABLE AT RUNTIME)
// ============================================================================

export const RulebookConfigSchema = z.object({
    // Position Limits
    maxPositionSizeBTC: z.number().positive().max(10),
    maxExposurePercent: z.number().positive().max(100),

    // Loss Limits
    maxDailyLossPercent: z.number().positive().max(100),
    maxDrawdownPercent: z.number().positive().max(100),
    maxConsecutiveLosses: z.number().int().positive(),

    // Trade Constraints
    maxSpreadBps: z.number().positive(),
    maxSlippageBps: z.number().positive(),
    minLiquidityBTC: z.number().positive(),

    // Time Constraints
    minHoldTimeMs: z.number().int().positive(),
    maxHoldTimeMs: z.number().int().positive(),

    // Order Limits
    maxOrdersPerMinute: z.number().int().positive(),
    maxOrdersPerHour: z.number().int().positive(),

    // Emergency Controls
    killSwitchEnabled: z.boolean(),

    // Leverage
    maxLeverage: z.number().positive().max(10)
}).strict();

export type RulebookConfig = z.infer<typeof RulebookConfigSchema>;

// Default hard-coded limits - CANNOT be modified at runtime
export const DEFAULT_RULEBOOK: RulebookConfig = Object.freeze({
    // Position Limits
    maxPositionSizeBTC: 0.5,
    maxExposurePercent: 5,

    // Loss Limits  
    maxDailyLossPercent: 2,
    maxDrawdownPercent: 5,
    maxConsecutiveLosses: 5,

    // Trade Constraints
    maxSpreadBps: 10,
    maxSlippageBps: 5,
    minLiquidityBTC: 10,

    // Time Constraints
    minHoldTimeMs: 5000,      // 5 seconds minimum
    maxHoldTimeMs: 300000,    // 5 minutes maximum

    // Order Limits
    maxOrdersPerMinute: 10,
    maxOrdersPerHour: 100,

    // Emergency Controls
    killSwitchEnabled: false,

    // Leverage
    maxLeverage: 3
});

// ============================================================================
// Risk Check Results
// ============================================================================

export const RiskCheckResultSchema = z.object({
    passed: z.boolean(),
    checkName: z.string(),
    reason: z.string().optional(),
    value: z.number().optional(),
    limit: z.number().optional(),
    timestamp: z.number()
});

export type RiskCheckResult = z.infer<typeof RiskCheckResultSchema>;

export const RiskVetoSchema = z.object({
    vetoed: z.boolean(),
    decisionId: z.string().uuid(),
    checks: z.array(RiskCheckResultSchema),
    failedChecks: z.array(z.string()),
    timestamp: z.number()
});

export type RiskVeto = z.infer<typeof RiskVetoSchema>;

// ============================================================================
// Risk Metrics
// ============================================================================

export const RiskMetricsSchema = z.object({
    // Daily metrics
    dailyPnl: z.number(),
    dailyPnlPercent: z.number(),
    dailyTrades: z.number().int().nonnegative(),
    dailyWins: z.number().int().nonnegative(),
    dailyLosses: z.number().int().nonnegative(),

    // Drawdown
    currentDrawdown: z.number().nonnegative(),
    maxDrawdown: z.number().nonnegative(),
    drawdownStartedAt: z.number().optional(),

    // Streak tracking
    consecutiveLosses: z.number().int().nonnegative(),
    consecutiveWins: z.number().int().nonnegative(),

    // Rate limiting
    ordersLastMinute: z.number().int().nonnegative(),
    ordersLastHour: z.number().int().nonnegative(),

    // Current state
    currentExposurePercent: z.number().nonnegative(),

    // Timestamps
    lastTradeAt: z.number().optional(),
    updatedAt: z.number()
});

export type RiskMetrics = z.infer<typeof RiskMetricsSchema>;

// ============================================================================
// Kill Switch
// ============================================================================

export const KillSwitchStateSchema = z.object({
    active: z.boolean(),
    activatedAt: z.number().optional(),
    activatedBy: z.enum(['MANUAL', 'AUTO_DRAWDOWN', 'AUTO_LOSS', 'AUTO_ERROR', 'SYSTEM']).optional(),
    reason: z.string().optional(),
    canReactivateAt: z.number().optional()
});

export type KillSwitchState = z.infer<typeof KillSwitchStateSchema>;

// ============================================================================
// Forbidden Conditions
// ============================================================================

export const ForbiddenConditionSchema = z.object({
    name: z.string(),
    active: z.boolean(),
    reason: z.string(),
    detectedAt: z.number(),
    clearsAt: z.number().optional()
});

export type ForbiddenCondition = z.infer<typeof ForbiddenConditionSchema>;

export const ForbiddenConditionsCheckSchema = z.object({
    canTrade: z.boolean(),
    conditions: z.array(ForbiddenConditionSchema),
    activeConditions: z.array(z.string()),
    timestamp: z.number()
});

export type ForbiddenConditionsCheck = z.infer<typeof ForbiddenConditionsCheckSchema>;

// ============================================================================
// Factory Functions
// ============================================================================

export function createInitialRiskMetrics(): RiskMetrics {
    return {
        dailyPnl: 0,
        dailyPnlPercent: 0,
        dailyTrades: 0,
        dailyWins: 0,
        dailyLosses: 0,
        currentDrawdown: 0,
        maxDrawdown: 0,
        consecutiveLosses: 0,
        consecutiveWins: 0,
        ordersLastMinute: 0,
        ordersLastHour: 0,
        currentExposurePercent: 0,
        updatedAt: Date.now()
    };
}

export function createKillSwitchState(): KillSwitchState {
    return {
        active: false
    };
}
