/**
 * AI Decision Types - Decision API Interface
 * Production-grade Bitcoin Scalping Bot
 * 
 * All AI inputs/outputs are schema-validated with Zod.
 * The AI operates within bounded constraints defined by the Risk module.
 */

import { z } from 'zod';
import { OrderSideSchema, OrderTypeSchema } from './core.js';

// ============================================================================
// Feature Vector (AI Input)
// ============================================================================

export const MicrostructureFeaturesSchema = z.object({
    spread: z.number().nonnegative(),
    spreadBps: z.number().nonnegative(),
    spreadZScore: z.number(),
    bookImbalance: z.number().min(-1).max(1),
    queuePressure: z.number(),
    bidDepth: z.number().nonnegative(),
    askDepth: z.number().nonnegative(),
    tradeVelocity: z.number().nonnegative(),
    volumeImbalance: z.number().min(-1).max(1),
    timestamp: z.number()
});

export type MicrostructureFeatures = z.infer<typeof MicrostructureFeaturesSchema>;

export const MomentumFeaturesSchema = z.object({
    return5Bar: z.number(),
    return10Bar: z.number(),
    return20Bar: z.number(),
    rsi14: z.number().min(0).max(100),
    rsi5: z.number().min(0).max(100),
    macdLine: z.number(),
    macdSignal: z.number(),
    macdHistogram: z.number(),
    ema20: z.number().positive(),
    ema50: z.number().positive(),
    ema200: z.number().positive(),
    priceVsEma20: z.number(),
    priceVsEma50: z.number(),
    timestamp: z.number()
});

export type MomentumFeatures = z.infer<typeof MomentumFeaturesSchema>;

export const MeanReversionFeaturesSchema = z.object({
    bbUpper: z.number().positive(),
    bbMiddle: z.number().positive(),
    bbLower: z.number().positive(),
    bbWidth: z.number().positive(),
    bbPosition: z.number().min(-1).max(2),
    vwap: z.number().positive(),
    priceVsVwap: z.number(),
    orderFlowImbalance: z.number(),
    timestamp: z.number()
});

export type MeanReversionFeatures = z.infer<typeof MeanReversionFeaturesSchema>;

export const VolatilityFeaturesSchema = z.object({
    atr14: z.number().positive(),
    atrPercent: z.number().positive(),
    realizedVol1h: z.number().nonnegative(),
    realizedVol24h: z.number().nonnegative(),
    volRegime: z.enum(['LOW', 'NORMAL', 'HIGH', 'EXTREME']),
    timestamp: z.number()
});

export type VolatilityFeatures = z.infer<typeof VolatilityFeaturesSchema>;

export const FeatureVectorSchema = z.object({
    microstructure: MicrostructureFeaturesSchema,
    momentum: MomentumFeaturesSchema,
    meanReversion: MeanReversionFeaturesSchema,
    volatility: VolatilityFeaturesSchema,
    timestamp: z.number()
});

export type FeatureVector = z.infer<typeof FeatureVectorSchema>;

// ============================================================================
// Market Snapshot (Context for AI)
// ============================================================================

export const MarketSnapshotSchema = z.object({
    symbol: z.literal('BTCUSDT'),
    price: z.number().positive(),
    bid: z.number().positive(),
    ask: z.number().positive(),
    volume24h: z.number().nonnegative(),
    high24h: z.number().positive(),
    low24h: z.number().positive(),
    fundingRate: z.number().optional(),
    openInterest: z.number().nonnegative().optional(),
    timestamp: z.number()
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

// ============================================================================
// AI Decision Request
// ============================================================================

export const AIDecisionRequestSchema = z.object({
    requestId: z.string().uuid(),
    timestamp: z.number(),

    // Market state
    features: FeatureVectorSchema,
    marketSnapshot: MarketSnapshotSchema,

    // Current position
    hasPosition: z.boolean(),
    positionSide: z.enum(['LONG', 'SHORT', 'FLAT']).optional(),
    positionSize: z.number().nonnegative().optional(),
    positionEntryPrice: z.number().positive().optional(),
    positionUnrealizedPnl: z.number().optional(),
    positionHoldTimeMs: z.number().nonnegative().optional(),

    // Recent context
    recentTradesCount: z.number().int().nonnegative(),
    recentWinRate: z.number().min(0).max(1).optional(),

    // News context
    pendingNewsEvents: z.number().int().nonnegative(),
    highImpactNewsInWindow: z.boolean(),

    // Risk context
    dailyPnlPercent: z.number(),
    currentDrawdownPercent: z.number().nonnegative(),
    consecutiveLosses: z.number().int().nonnegative()
});

export type AIDecisionRequest = z.infer<typeof AIDecisionRequestSchema>;

// ============================================================================
// AI Decision Response
// ============================================================================

export const AIActionSchema = z.enum(['BUY', 'SELL', 'HOLD', 'EXIT', 'CLOSE_LONG', 'CLOSE_SHORT']);
export type AIAction = z.infer<typeof AIActionSchema>;

export const AIDecisionResponseSchema = z.object({
    requestId: z.string().uuid(),

    // Core decision
    action: AIActionSchema,

    // Sizing (bounded by risk)
    size: z.number().nonnegative().max(10),
    sizePercent: z.number().min(0).max(100).optional(),

    // Order type
    orderType: OrderTypeSchema,
    limitPrice: z.number().positive().optional(),

    // Adaptive hold time (bounded)
    holdTimeMs: z.number().int().min(5000).max(300000),

    // Take profit / Stop loss suggestions
    suggestedTpPrice: z.number().positive().optional(),
    suggestedSlPrice: z.number().positive().optional(),
    suggestedTpPercent: z.number().positive().optional(),
    suggestedSlPercent: z.number().positive().optional(),

    // Confidence and reasoning
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(500),

    // Signals that contributed
    signals: z.array(z.string()).optional(),

    // Regime assessment
    detectedRegime: z.enum(['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'UNKNOWN']).optional(),

    // Timestamp
    timestamp: z.number()
});

export type AIDecisionResponse = z.infer<typeof AIDecisionResponseSchema>;

// ============================================================================
// Parameter Update Proposal
// ============================================================================

export const ParameterUpdateProposalSchema = z.object({
    proposalId: z.string().uuid(),
    timestamp: z.number(),

    // What to update
    parameterName: z.string(),
    currentValue: z.number(),
    proposedValue: z.number(),
    changePercent: z.number(),

    // Justification
    rationale: z.string(),
    confidence: z.number().min(0).max(1),

    // Validation results
    backtestPnl: z.number().optional(),
    backtestSharpe: z.number().optional(),
    walkForwardPassed: z.boolean().optional(),

    // Status
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'APPLIED']),
    reviewedBy: z.string().optional(),
    reviewedAt: z.number().optional()
});

export type ParameterUpdateProposal = z.infer<typeof ParameterUpdateProposalSchema>;

// ============================================================================
// Regime Detection
// ============================================================================

export const MarketRegimeSchema = z.enum([
    'TRENDING_UP',
    'TRENDING_DOWN',
    'RANGING',
    'VOLATILE',
    'QUIET',
    'UNKNOWN'
]);

export type MarketRegime = z.infer<typeof MarketRegimeSchema>;

export const RegimeDetectionResultSchema = z.object({
    currentRegime: MarketRegimeSchema,
    confidence: z.number().min(0).max(1),
    regimeStartedAt: z.number(),
    regimeDurationMs: z.number().nonnegative(),
    previousRegime: MarketRegimeSchema.optional(),
    features: z.record(z.string(), z.number()),
    timestamp: z.number()
});

export type RegimeDetectionResult = z.infer<typeof RegimeDetectionResultSchema>;
