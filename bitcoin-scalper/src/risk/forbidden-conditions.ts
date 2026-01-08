/**
 * Forbidden Conditions Checker
 * Production-grade Bitcoin Scalping Bot
 * 
 * Checks for conditions that should prevent trading entirely.
 */

import { injectable, inject } from 'inversify';
import type {
    ForbiddenConditionsCheck,
    ForbiddenCondition
} from '../types/risk.js';
import type { OrderBook } from '../types/core.js';
import { RulebookEngine } from './rulebook.js';
import { TYPES } from '../di/types.js';

@injectable()
export class ForbiddenConditionsChecker {
    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine
    ) {
        console.log('[ForbiddenConditionsChecker] Initialized');
    }

    /**
     * Check all forbidden conditions
     */
    check(orderBook: OrderBook, currentPrice: number): ForbiddenConditionsCheck {
        const conditions: ForbiddenCondition[] = [];
        const now = Date.now();
        const rules = this.rulebook.getRulebook();

        // 1. Check spread
        const spreadCondition = this.checkSpread(orderBook, rules.maxSpreadBps);
        if (spreadCondition) conditions.push(spreadCondition);

        // 2. Check liquidity
        const liquidityCondition = this.checkLiquidity(orderBook, rules.minLiquidityBTC);
        if (liquidityCondition) conditions.push(liquidityCondition);

        // 3. Check for stale quotes
        const staleCondition = this.checkStaleQuotes(orderBook);
        if (staleCondition) conditions.push(staleCondition);

        // 4. Check for extreme price deviation
        const priceCondition = this.checkPriceDeviation(orderBook, currentPrice);
        if (priceCondition) conditions.push(priceCondition);

        // 5. Check for empty order book
        const emptyCondition = this.checkEmptyOrderBook(orderBook);
        if (emptyCondition) conditions.push(emptyCondition);

        const activeConditions = conditions
            .filter(c => c.active)
            .map(c => c.name);

        return {
            canTrade: activeConditions.length === 0,
            conditions,
            activeConditions,
            timestamp: now
        };
    }

    /**
     * Check if spread is too wide
     */
    private checkSpread(orderBook: OrderBook, maxSpreadBps: number): ForbiddenCondition | null {
        const bestBid = orderBook.bids[0]?.price;
        const bestAsk = orderBook.asks[0]?.price;

        if (!bestBid || !bestAsk) {
            return {
                name: 'MISSING_SPREAD',
                active: true,
                reason: 'Cannot calculate spread - missing bid or ask',
                detectedAt: Date.now()
            };
        }

        const midPrice = (bestBid + bestAsk) / 2;
        const spreadBps = ((bestAsk - bestBid) / midPrice) * 10000;

        if (spreadBps > maxSpreadBps) {
            return {
                name: 'SPREAD_TOO_WIDE',
                active: true,
                reason: `Spread ${spreadBps.toFixed(1)}bps exceeds max ${maxSpreadBps}bps`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Check if liquidity is too low
     */
    private checkLiquidity(orderBook: OrderBook, minLiquidityBTC: number): ForbiddenCondition | null {
        // Sum top 5 levels on each side
        const bidLiquidity = orderBook.bids.slice(0, 5).reduce((sum, l) => sum + l.quantity, 0);
        const askLiquidity = orderBook.asks.slice(0, 5).reduce((sum, l) => sum + l.quantity, 0);
        const minLiquidity = Math.min(bidLiquidity, askLiquidity);

        if (minLiquidity < minLiquidityBTC) {
            return {
                name: 'LIQUIDITY_TOO_LOW',
                active: true,
                reason: `Liquidity ${minLiquidity.toFixed(2)} BTC below minimum ${minLiquidityBTC} BTC`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Check for stale quotes (order book not updated recently)
     */
    private checkStaleQuotes(orderBook: OrderBook): ForbiddenCondition | null {
        const maxAge = 5000; // 5 seconds
        const age = Date.now() - orderBook.timestamp;

        if (age > maxAge) {
            return {
                name: 'STALE_QUOTES',
                active: true,
                reason: `Order book is ${(age / 1000).toFixed(1)}s old (max ${maxAge / 1000}s)`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Check for extreme price deviation between bid/ask
     */
    private checkPriceDeviation(orderBook: OrderBook, currentPrice: number): ForbiddenCondition | null {
        const bestBid = orderBook.bids[0]?.price;
        const bestAsk = orderBook.asks[0]?.price;

        if (!bestBid || !bestAsk) return null;

        const midPrice = (bestBid + bestAsk) / 2;
        const deviation = Math.abs(midPrice - currentPrice) / currentPrice;

        // If mid price deviates more than 0.5% from last known price, flag it
        if (deviation > 0.005) {
            return {
                name: 'PRICE_DEVIATION',
                active: true,
                reason: `Order book mid ${midPrice.toFixed(2)} deviates ${(deviation * 100).toFixed(2)}% from reference ${currentPrice.toFixed(2)}`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Check for empty or nearly empty order book
     */
    private checkEmptyOrderBook(orderBook: OrderBook): ForbiddenCondition | null {
        if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
            return {
                name: 'EMPTY_ORDER_BOOK',
                active: true,
                reason: 'Order book has no bids or asks',
                detectedAt: Date.now()
            };
        }

        if (orderBook.bids.length < 3 || orderBook.asks.length < 3) {
            return {
                name: 'THIN_ORDER_BOOK',
                active: true,
                reason: `Order book has only ${orderBook.bids.length} bids and ${orderBook.asks.length} asks`,
                detectedAt: Date.now()
            };
        }

        return null;
    }
}
