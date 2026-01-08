/**
 * News Types - Sandboxed News Aggregator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Internet/news awareness through a sandboxed aggregator that ingests
 * whitelisted high-impact Bitcoin-related sources only.
 */

import { z } from 'zod';

// ============================================================================
// News Source Configuration
// ============================================================================

export const NewsSourceSchema = z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url(),
    type: z.enum(['RSS', 'API', 'WEBSOCKET']),
    priority: z.number().int().min(1).max(10),
    enabled: z.boolean(),
    rateLimitPerHour: z.number().int().positive()
});

export type NewsSource = z.infer<typeof NewsSourceSchema>;

// Whitelisted sources (Bitcoin-only, high-quality)
export const WHITELISTED_NEWS_SOURCES: NewsSource[] = Object.freeze([
    {
        id: 'coindesk',
        name: 'CoinDesk',
        url: 'https://www.coindesk.com',
        type: 'RSS',
        priority: 1,
        enabled: true,
        rateLimitPerHour: 60
    },
    {
        id: 'theblock',
        name: 'The Block',
        url: 'https://www.theblock.co',
        type: 'RSS',
        priority: 1,
        enabled: true,
        rateLimitPerHour: 60
    },
    {
        id: 'cointelegraph',
        name: 'CoinTelegraph',
        url: 'https://cointelegraph.com',
        type: 'RSS',
        priority: 2,
        enabled: true,
        rateLimitPerHour: 60
    },
    {
        id: 'bitcoinmagazine',
        name: 'Bitcoin Magazine',
        url: 'https://bitcoinmagazine.com',
        type: 'RSS',
        priority: 2,
        enabled: true,
        rateLimitPerHour: 30
    }
]) as NewsSource[];

// ============================================================================
// News Event
// ============================================================================

export const SentimentSchema = z.enum(['VERY_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'VERY_BEARISH']);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const ImpactLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

export const NewsCategorySchema = z.enum([
    'REGULATORY',
    'ETF',
    'INSTITUTIONAL',
    'EXCHANGE',
    'TECHNOLOGY',
    'MACRO',
    'MINING',
    'ADOPTION',
    'SECURITY',
    'OTHER'
]);
export type NewsCategory = z.infer<typeof NewsCategorySchema>;

export const NewsEventSchema = z.object({
    id: z.string().uuid(),

    // Source
    sourceId: z.string(),
    sourceName: z.string(),
    sourceUrl: z.string().url(),

    // Content
    title: z.string(),
    summary: z.string().max(500).optional(),
    fullText: z.string().optional(),
    url: z.string().url(),

    // Classification
    category: NewsCategorySchema,
    sentiment: SentimentSchema,
    impactLevel: ImpactLevelSchema,

    // Relevance
    bitcoinRelevanceScore: z.number().min(0).max(1),
    keywords: z.array(z.string()),

    // Timing
    publishedAt: z.number(),
    ingestedAt: z.number(),
    expiresAt: z.number(),

    // Processing
    processed: z.boolean(),
    sentimentConfidence: z.number().min(0).max(1),
    impactConfidence: z.number().min(0).max(1)
});

export type NewsEvent = z.infer<typeof NewsEventSchema>;

// ============================================================================
// News Feed State
// ============================================================================

export const NewsFeedStateSchema = z.object({
    isConnected: z.boolean(),
    lastUpdateAt: z.number().optional(),
    pendingEvents: z.number().int().nonnegative(),
    highImpactEvents24h: z.number().int().nonnegative(),
    lastError: z.string().optional()
});

export type NewsFeedState = z.infer<typeof NewsFeedStateSchema>;

// ============================================================================
// Economic Calendar Event (Scheduled)
// ============================================================================

export const ScheduledEventSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),

    // Timing
    scheduledAt: z.number(),
    durationMinutes: z.number().int().positive().optional(),

    // Impact
    expectedImpact: ImpactLevelSchema,

    // Trading restriction
    noTradeWindowMinutesBefore: z.number().int().nonnegative(),
    noTradeWindowMinutesAfter: z.number().int().nonnegative(),

    // Status
    occurred: z.boolean(),
    actualOutcome: z.string().optional()
});

export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;

// ============================================================================
// News Impact Assessment
// ============================================================================

export const NewsImpactAssessmentSchema = z.object({
    timestamp: z.number(),

    // Current state
    hasHighImpactNews: z.boolean(),
    hasPendingScheduledEvent: z.boolean(),

    // Trading recommendation
    shouldReduceSize: z.boolean(),
    sizeMultiplier: z.number().min(0).max(1),
    shouldAvoidTrading: z.boolean(),

    // Context
    relevantEvents: z.array(z.string().uuid()),
    nextScheduledEvent: z.number().optional(),

    // Reasoning
    reason: z.string()
});

export type NewsImpactAssessment = z.infer<typeof NewsImpactAssessmentSchema>;
