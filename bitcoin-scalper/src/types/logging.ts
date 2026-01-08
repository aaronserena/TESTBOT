/**
 * Logging Types - Decision & Trade Logging
 * Production-grade Bitcoin Scalping Bot
 * 
 * Full audit trail for every decision with inputs, features, rationale,
 * chosen hold time, and parameters.
 */

import { z } from 'zod';
import { AIDecisionRequestSchema, AIDecisionResponseSchema, MarketRegimeSchema } from './decision.js';
import { RiskVetoSchema } from './risk.js';

// ============================================================================
// Decision Log Entry
// ============================================================================

export const DecisionLogEntrySchema = z.object({
    // Identifiers
    id: z.string().uuid(),
    requestId: z.string().uuid(),
    sessionId: z.string().uuid(),

    // Timestamps
    requestedAt: z.number(),
    respondedAt: z.number(),
    latencyMs: z.number().nonnegative(),

    // Full request context
    request: AIDecisionRequestSchema,

    // AI response
    response: AIDecisionResponseSchema,

    // Risk check
    riskVeto: RiskVetoSchema,

    // Final outcome
    actionTaken: z.boolean(),
    orderId: z.string().uuid().optional(),

    // Execution details (filled post-trade)
    fillPrice: z.number().positive().optional(),
    fillTime: z.number().optional(),
    slippage: z.number().optional(),

    // Trade outcome (filled when closed)
    tradePnl: z.number().optional(),
    tradePnlPercent: z.number().optional(),
    actualHoldTimeMs: z.number().nonnegative().optional(),
    exitReason: z.string().optional(),

    // Analysis
    blunderLabel: z.enum(['NOT_A_MISTAKE', 'INACCURACY', 'MISTAKE', 'BLUNDER']).optional(),
    blunderReason: z.string().optional()
});

export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

// ============================================================================
// Trade History Entry
// ============================================================================

export const TradeHistoryEntrySchema = z.object({
    // Identifiers
    id: z.string().uuid(),
    decisionId: z.string().uuid(),
    sessionId: z.string().uuid(),

    // Trade details
    entryOrderId: z.string().uuid(),
    exitOrderId: z.string().uuid().optional(),

    // Execution
    side: z.enum(['LONG', 'SHORT']),
    entryPrice: z.number().positive(),
    exitPrice: z.number().positive().optional(),
    size: z.number().positive(),

    // Timing
    entryTime: z.number(),
    exitTime: z.number().optional(),
    holdTimeMs: z.number().nonnegative().optional(),
    plannedHoldTimeMs: z.number().nonnegative(),

    // P&L
    pnl: z.number().optional(),
    pnlPercent: z.number().optional(),
    fees: z.number().nonnegative(),
    netPnl: z.number().optional(),

    // Context
    regime: MarketRegimeSchema.optional(),
    session: z.enum(['ASIA', 'EUROPE', 'US', 'OVERLAP']).optional(),

    // Exit reason
    exitReason: z.enum([
        'TAKE_PROFIT',
        'STOP_LOSS',
        'TIME_EXIT',
        'AI_DECISION',
        'EMERGENCY',
        'MANUAL',
        'KILL_SWITCH'
    ]).optional(),

    // Analysis
    blunderLabel: z.enum(['NOT_A_MISTAKE', 'INACCURACY', 'MISTAKE', 'BLUNDER']).optional(),
    blunderDetails: z.string().optional()
});

export type TradeHistoryEntry = z.infer<typeof TradeHistoryEntrySchema>;

// ============================================================================
// Performance Metrics
// ============================================================================

export const PerformanceMetricsSchema = z.object({
    // Time range
    startTime: z.number(),
    endTime: z.number(),

    // Trade counts
    totalTrades: z.number().int().nonnegative(),
    winningTrades: z.number().int().nonnegative(),
    losingTrades: z.number().int().nonnegative(),
    breakEvenTrades: z.number().int().nonnegative(),

    // Win rate
    winRate: z.number().min(0).max(1),

    // P&L
    grossPnl: z.number(),
    totalFees: z.number().nonnegative(),
    netPnl: z.number(),
    netPnlPercent: z.number(),

    // Averages
    avgWin: z.number().optional(),
    avgLoss: z.number().optional(),
    avgTradeSize: z.number().positive().optional(),
    avgHoldTimeMs: z.number().positive().optional(),

    // Risk metrics
    maxDrawdown: z.number().nonnegative(),
    maxDrawdownPercent: z.number().nonnegative(),
    sharpeRatio: z.number().optional(),
    sortinoRatio: z.number().optional(),
    profitFactor: z.number().optional(),
    expectancy: z.number(),

    // Streaks
    maxConsecutiveWins: z.number().int().nonnegative(),
    maxConsecutiveLosses: z.number().int().nonnegative(),

    // Blunder analysis
    notAMistakeCount: z.number().int().nonnegative(),
    inaccuracyCount: z.number().int().nonnegative(),
    mistakeCount: z.number().int().nonnegative(),
    blunderCount: z.number().int().nonnegative()
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// ============================================================================
// Session Summary
// ============================================================================

export const SessionSummarySchema = z.object({
    sessionId: z.string().uuid(),
    mode: z.enum(['PAPER', 'LIVE']),

    // Timing
    startedAt: z.number(),
    endedAt: z.number().optional(),
    durationMs: z.number().nonnegative(),

    // Activity
    totalDecisions: z.number().int().nonnegative(),
    tradedDecisions: z.number().int().nonnegative(),
    vetoedDecisions: z.number().int().nonnegative(),

    // Performance
    metrics: PerformanceMetricsSchema,

    // State
    endingBalance: z.number().positive().optional(),
    endingPositionValue: z.number().optional()
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// ============================================================================
// System Events
// ============================================================================

export const SystemEventSchema = z.object({
    id: z.string().uuid(),
    timestamp: z.number(),
    type: z.enum([
        'SESSION_START',
        'SESSION_END',
        'KILL_SWITCH_ACTIVATED',
        'KILL_SWITCH_DEACTIVATED',
        'CONNECTION_LOST',
        'CONNECTION_RESTORED',
        'ERROR',
        'WARNING',
        'PARAMETER_UPDATED',
        'REGIME_CHANGE'
    ]),
    severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional()
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;
