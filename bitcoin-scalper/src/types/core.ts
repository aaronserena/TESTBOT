/**
 * Core Types - Order Management
 * Production-grade Bitcoin Scalping Bot
 */

import { z } from 'zod';

// ============================================================================
// Order Types
// ============================================================================

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['LIMIT', 'MARKET', 'POST_ONLY']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const OrderStatusSchema = z.enum([
    'PENDING',
    'SUBMITTED',
    'PARTIAL',
    'FILLED',
    'CANCELLED',
    'REJECTED',
    'EXPIRED'
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const TimeInForceSchema = z.enum(['GTC', 'IOC', 'FOK', 'POST_ONLY']);
export type TimeInForce = z.infer<typeof TimeInForceSchema>;

export const OrderSchema = z.object({
    id: z.string().uuid(),
    clientOrderId: z.string(),
    exchangeOrderId: z.string().optional(),
    symbol: z.literal('BTCUSDT'),
    side: OrderSideSchema,
    type: OrderTypeSchema,
    status: OrderStatusSchema,
    timeInForce: TimeInForceSchema,

    // Quantities
    quantity: z.number().positive(),
    filledQuantity: z.number().nonnegative().default(0),
    remainingQuantity: z.number().nonnegative(),

    // Prices
    price: z.number().positive().optional(),
    avgFillPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),

    // Fees
    feePaid: z.number().nonnegative().default(0),
    feeAsset: z.string().default('USDT'),

    // Timestamps
    createdAt: z.number(),
    submittedAt: z.number().optional(),
    filledAt: z.number().optional(),
    cancelledAt: z.number().optional(),
    updatedAt: z.number(),

    // Metadata
    decisionId: z.string().uuid().optional(),
    retryCount: z.number().nonnegative().default(0),
    errorMessage: z.string().optional()
});

export type Order = z.infer<typeof OrderSchema>;

// ============================================================================
// Trade Types
// ============================================================================

export const TradeSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    exchangeTradeId: z.string(),
    symbol: z.literal('BTCUSDT'),
    side: OrderSideSchema,

    // Execution details
    price: z.number().positive(),
    quantity: z.number().positive(),
    quoteQuantity: z.number().positive(),

    // Fees
    fee: z.number().nonnegative(),
    feeAsset: z.string(),

    // Timestamps
    executedAt: z.number(),

    // Classification
    isMaker: z.boolean(),

    // Metadata
    decisionId: z.string().uuid().optional()
});

export type Trade = z.infer<typeof TradeSchema>;

// ============================================================================
// Position Types
// ============================================================================

export const PositionSideSchema = z.enum(['LONG', 'SHORT', 'FLAT']);
export type PositionSide = z.infer<typeof PositionSideSchema>;

export const PositionSchema = z.object({
    symbol: z.literal('BTCUSDT'),
    side: PositionSideSchema,

    // Size
    quantity: z.number().nonnegative(),
    entryPrice: z.number().positive().optional(),

    // P&L
    unrealizedPnl: z.number(),
    realizedPnl: z.number(),

    // Risk metrics
    liquidationPrice: z.number().positive().optional(),
    marginUsed: z.number().nonnegative(),
    leverage: z.number().positive().default(1),

    // Timestamps
    openedAt: z.number().optional(),
    updatedAt: z.number()
});

export type Position = z.infer<typeof PositionSchema>;

// ============================================================================
// Market Data Types
// ============================================================================

export const OrderBookLevelSchema = z.object({
    price: z.number().positive(),
    quantity: z.number().nonnegative()
});

export type OrderBookLevel = z.infer<typeof OrderBookLevelSchema>;

export const OrderBookSchema = z.object({
    symbol: z.literal('BTCUSDT'),
    timestamp: z.number(),
    bids: z.array(OrderBookLevelSchema),
    asks: z.array(OrderBookLevelSchema),
    lastUpdateId: z.number()
});

export type OrderBook = z.infer<typeof OrderBookSchema>;

export const TickerSchema = z.object({
    symbol: z.literal('BTCUSDT'),
    timestamp: z.number(),
    bid: z.number().positive(),
    bidQty: z.number().nonnegative(),
    ask: z.number().positive(),
    askQty: z.number().nonnegative(),
    last: z.number().positive(),
    volume24h: z.number().nonnegative(),
    high24h: z.number().positive(),
    low24h: z.number().positive()
});

export type Ticker = z.infer<typeof TickerSchema>;

export const CandleSchema = z.object({
    symbol: z.literal('BTCUSDT'),
    interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
    openTime: z.number(),
    closeTime: z.number(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative(),
    quoteVolume: z.number().nonnegative(),
    trades: z.number().nonnegative(),
    isClosed: z.boolean()
});

export type Candle = z.infer<typeof CandleSchema>;

export const MarketTradeSchema = z.object({
    id: z.string(),
    symbol: z.literal('BTCUSDT'),
    price: z.number().positive(),
    quantity: z.number().positive(),
    timestamp: z.number(),
    isBuyerMaker: z.boolean()
});

export type MarketTrade = z.infer<typeof MarketTradeSchema>;

// ============================================================================
// Factory Functions
// ============================================================================

export function createEmptyPosition(): Position {
    return {
        symbol: 'BTCUSDT',
        side: 'FLAT',
        quantity: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        marginUsed: 0,
        leverage: 1,
        updatedAt: Date.now()
    };
}
