/**
 * Analysis Types - Blunder Analysis System
 * Production-grade Bitcoin Scalping Bot
 * 
 * Chess-style blunder analysis that labels trades as:
 * - NOT_A_MISTAKE: Optimal decision given information
 * - INACCURACY: Minor suboptimal choice
 * - MISTAKE: Significant error that cost meaningful P&L
 * - BLUNDER: Critical failure, rule violation, or catastrophic error
 */

import { z } from 'zod';
import { MarketRegimeSchema, AIDecisionResponseSchema } from './decision.js';

// ============================================================================
// Blunder Classification
// ============================================================================

export const BlunderLabelSchema = z.enum([
    'NOT_A_MISTAKE',
    'INACCURACY',
    'MISTAKE',
    'BLUNDER'
]);

export type BlunderLabel = z.infer<typeof BlunderLabelSchema>;

export const BlunderCategorySchema = z.enum([
    // Rule violations
    'RULE_VIOLATION_SPREAD',
    'RULE_VIOLATION_SIZE',
    'RULE_VIOLATION_EXPOSURE',
    'RULE_VIOLATION_TIMING',

    // Trading errors
    'TRADED_DURING_FORBIDDEN',
    'IGNORED_NEWS_RISK',
    'OVERSIZED_POSITION',
    'SUBOPTIMAL_ENTRY',
    'SUBOPTIMAL_EXIT',
    'PREMATURE_EXIT',
    'LATE_EXIT',

    // Decision errors
    'WRONG_DIRECTION',
    'MISSED_OPPORTUNITY',
    'IGNORED_SIGNALS',

    // Execution errors
    'SLIPPAGE_EXCESSIVE',
    'ORDER_TYPE_SUBOPTIMAL',

    // None
    'NONE'
]);

export type BlunderCategory = z.infer<typeof BlunderCategorySchema>;

// ============================================================================
// Blunder Analysis Result
// ============================================================================

export const BlunderAnalysisResultSchema = z.object({
    // Trade reference
    tradeId: z.string().uuid(),
    decisionId: z.string().uuid(),

    // Classification
    label: BlunderLabelSchema,
    category: BlunderCategorySchema,
    severity: z.number().int().min(0).max(100),

    // Cost analysis
    estimatedCost: z.number(),
    costPercent: z.number(),

    // Comparison to optimal
    optimalAction: AIDecisionResponseSchema.optional(),
    optimalPnl: z.number().optional(),
    actualPnl: z.number(),
    pnlDifference: z.number().optional(),

    // Context at decision time
    marketState: z.object({
        regime: MarketRegimeSchema,
        spread: z.number(),
        volatility: z.number(),
        hasNews: z.boolean()
    }),

    // Explanation
    reason: z.string(),
    details: z.string().optional(),

    // Recommendations
    recommendations: z.array(z.string()),

    // Timestamps
    analyzedAt: z.number()
});

export type BlunderAnalysisResult = z.infer<typeof BlunderAnalysisResultSchema>;

// ============================================================================
// Blunder Statistics
// ============================================================================

export const BlunderStatisticsSchema = z.object({
    // Time range
    startTime: z.number(),
    endTime: z.number(),
    totalTrades: z.number().int().nonnegative(),

    // Distribution
    notAMistakeCount: z.number().int().nonnegative(),
    inaccuracyCount: z.number().int().nonnegative(),
    mistakeCount: z.number().int().nonnegative(),
    blunderCount: z.number().int().nonnegative(),

    // Percentages
    notAMistakePercent: z.number().min(0).max(100),
    inaccuracyPercent: z.number().min(0).max(100),
    mistakePercent: z.number().min(0).max(100),
    blunderPercent: z.number().min(0).max(100),

    // Cost analysis
    totalBlunderCost: z.number(),
    avgBlunderCost: z.number().optional(),

    // Category breakdown
    categoryBreakdown: z.record(BlunderCategorySchema, z.number().int().nonnegative()),

    // Improvement tracking
    blunderRateTrend: z.enum(['IMPROVING', 'STABLE', 'WORSENING', 'UNKNOWN'])
});

export type BlunderStatistics = z.infer<typeof BlunderStatisticsSchema>;

// ============================================================================
// Optimal Decision Comparison
// ============================================================================

export const OptimalDecisionComparisonSchema = z.object({
    timestamp: z.number(),

    // What was done
    actualAction: z.enum(['BUY', 'SELL', 'HOLD', 'EXIT']),
    actualSize: z.number().nonnegative(),
    actualPrice: z.number().positive(),
    actualPnl: z.number(),

    // What should have been done
    optimalAction: z.enum(['BUY', 'SELL', 'HOLD', 'EXIT']),
    optimalSize: z.number().nonnegative(),
    optimalPrice: z.number().positive().optional(),
    optimalPnl: z.number(),

    // Difference
    actionMatch: z.boolean(),
    sizeDeviation: z.number(),
    pnlDifference: z.number(),

    // Reasoning
    whyOptimalBetter: z.string().optional()
});

export type OptimalDecisionComparison = z.infer<typeof OptimalDecisionComparisonSchema>;

// ============================================================================
// Blunder Thresholds Configuration
// ============================================================================

export const BlunderThresholdsSchema = z.object({
    // Cost thresholds (as % of trade size)
    inaccuracyMinCostPercent: z.number().positive(),
    mistakeMinCostPercent: z.number().positive(),
    blunderMinCostPercent: z.number().positive(),

    // Absolute cost thresholds (in USD)
    inaccuracyMinCostUsd: z.number().positive(),
    mistakeMinCostUsd: z.number().positive(),
    blunderMinCostUsd: z.number().positive(),

    // Rule violations always blunder
    ruleViolationIsBlunder: z.boolean()
});

export type BlunderThresholds = z.infer<typeof BlunderThresholdsSchema>;

export const DEFAULT_BLUNDER_THRESHOLDS: BlunderThresholds = Object.freeze({
    inaccuracyминCostPercent: 0.1,
    mistakeMinCostPercent: 0.5,
    blunderMinCostPercent: 1.0,

    inaccuracyMinCostUsd: 10,
    mistakeMinCostUsd: 50,
    blunderMinCostUsd: 100,

    ruleViolationIsBlunder: true
});
