/**
 * Trade Tape Processor - Real-time Trade Stream
 * Production-grade Bitcoin Scalping Bot
 * 
 * Processes individual trades and aggregates metrics.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { MarketTrade } from '../types/core.js';
import { WebSocketClient } from './websocket-client.js';
import { TYPES } from '../di/types.js';

interface TradeAggregation {
    timestamp: number;
    buyVolume: number;
    sellVolume: number;
    buyCount: number;
    sellCount: number;
    vwapBuy: number;
    vwapSell: number;
    highPrice: number;
    lowPrice: number;
    lastPrice: number;
}

@injectable()
export class TradeTapeProcessor extends EventEmitter {
    private recentTrades: MarketTrade[] = [];
    private maxTrades: number = 1000;
    private aggregations: Map<number, TradeAggregation> = new Map();
    private windowMs: number = 1000; // 1 second windows
    private lastPrice: number = 0;

    constructor(
        @inject(TYPES.WebSocketClient) private wsClient: WebSocketClient
    ) {
        super();
        this.setupListeners();
        console.log('[TradeTapeProcessor] Initialized');
    }

    /**
     * Get recent trades
     */
    getRecentTrades(count: number = 100): MarketTrade[] {
        return this.recentTrades.slice(-count);
    }

    /**
     * Get last price
     */
    getLastPrice(): number {
        return this.lastPrice;
    }

    /**
     * Get trade velocity (trades per second)
     */
    getTradeVelocity(windowMs: number = 5000): number {
        const cutoff = Date.now() - windowMs;
        const tradesInWindow = this.recentTrades.filter(t => t.timestamp > cutoff);
        return (tradesInWindow.length / windowMs) * 1000;
    }

    /**
     * Get volume in time window
     */
    getVolume(windowMs: number = 60000): { buy: number; sell: number; total: number } {
        const cutoff = Date.now() - windowMs;
        let buyVol = 0;
        let sellVol = 0;

        for (const trade of this.recentTrades) {
            if (trade.timestamp < cutoff) continue;
            if (trade.isBuyerMaker) {
                sellVol += trade.quantity;
            } else {
                buyVol += trade.quantity;
            }
        }

        return { buy: buyVol, sell: sellVol, total: buyVol + sellVol };
    }

    /**
     * Get volume imbalance (-1 to 1)
     */
    getVolumeImbalance(windowMs: number = 30000): number {
        const vol = this.getVolume(windowMs);
        if (vol.total === 0) return 0;
        return (vol.buy - vol.sell) / vol.total;
    }

    /**
     * Get VWAP (volume-weighted average price)
     */
    getVWAP(windowMs: number = 60000): number {
        const cutoff = Date.now() - windowMs;
        let totalValue = 0;
        let totalVolume = 0;

        for (const trade of this.recentTrades) {
            if (trade.timestamp < cutoff) continue;
            totalValue += trade.price * trade.quantity;
            totalVolume += trade.quantity;
        }

        return totalVolume > 0 ? totalValue / totalVolume : this.lastPrice;
    }

    /**
     * Get large trades (whale activity)
     */
    getLargeTrades(minSizeBTC: number = 1, windowMs: number = 300000): MarketTrade[] {
        const cutoff = Date.now() - windowMs;
        return this.recentTrades.filter(t =>
            t.timestamp > cutoff && t.quantity >= minSizeBTC
        );
    }

    /**
     * Get aggregated stats for a time window
     */
    getAggregatedStats(windowMs: number = 60000): TradeAggregation | null {
        const cutoff = Date.now() - windowMs;
        let buyVolume = 0;
        let sellVolume = 0;
        let buyCount = 0;
        let sellCount = 0;
        let buyValue = 0;
        let sellValue = 0;
        let highPrice = 0;
        let lowPrice = Infinity;
        let lastPrice = 0;

        for (const trade of this.recentTrades) {
            if (trade.timestamp < cutoff) continue;

            if (trade.isBuyerMaker) {
                sellVolume += trade.quantity;
                sellCount++;
                sellValue += trade.price * trade.quantity;
            } else {
                buyVolume += trade.quantity;
                buyCount++;
                buyValue += trade.price * trade.quantity;
            }

            if (trade.price > highPrice) highPrice = trade.price;
            if (trade.price < lowPrice) lowPrice = trade.price;
            lastPrice = trade.price;
        }

        if (buyCount === 0 && sellCount === 0) return null;

        return {
            timestamp: Date.now(),
            buyVolume,
            sellVolume,
            buyCount,
            sellCount,
            vwapBuy: buyVolume > 0 ? buyValue / buyVolume : 0,
            vwapSell: sellVolume > 0 ? sellValue / sellVolume : 0,
            highPrice: highPrice === 0 ? lastPrice : highPrice,
            lowPrice: lowPrice === Infinity ? lastPrice : lowPrice,
            lastPrice
        };
    }

    /**
     * Set up WebSocket listeners
     */
    private setupListeners(): void {
        this.wsClient.on('message', (msg: any) => {
            if (msg.type === 'aggTrade' || msg.type === 'trade') {
                this.handleTrade(msg.data);
            }
        });
    }

    /**
     * Handle incoming trade
     */
    private handleTrade(data: any): void {
        const trade: MarketTrade = {
            id: String(data.a || data.t),
            symbol: 'BTCUSDT',
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            timestamp: data.T || data.E,
            isBuyerMaker: data.m
        };

        // Add to recent trades
        this.recentTrades.push(trade);
        this.lastPrice = trade.price;

        // Trim old trades
        if (this.recentTrades.length > this.maxTrades) {
            this.recentTrades = this.recentTrades.slice(-this.maxTrades);
        }

        // Emit trade event
        this.emit('trade', trade);

        // Emit aggregated update every second
        const windowKey = Math.floor(trade.timestamp / this.windowMs);
        if (!this.aggregations.has(windowKey)) {
            this.aggregations.set(windowKey, this.createEmptyAggregation(windowKey * this.windowMs));
            this.emit('aggregation', this.getAggregatedStats(5000));

            // Clean old aggregations
            this.cleanOldAggregations();
        }

        // Update current window
        const agg = this.aggregations.get(windowKey)!;
        if (trade.isBuyerMaker) {
            agg.sellVolume += trade.quantity;
            agg.sellCount++;
        } else {
            agg.buyVolume += trade.quantity;
            agg.buyCount++;
        }
        if (trade.price > agg.highPrice) agg.highPrice = trade.price;
        if (trade.price < agg.lowPrice) agg.lowPrice = trade.price;
        agg.lastPrice = trade.price;
    }

    /**
     * Create empty aggregation bucket
     */
    private createEmptyAggregation(timestamp: number): TradeAggregation {
        return {
            timestamp,
            buyVolume: 0,
            sellVolume: 0,
            buyCount: 0,
            sellCount: 0,
            vwapBuy: 0,
            vwapSell: 0,
            highPrice: 0,
            lowPrice: Infinity,
            lastPrice: 0
        };
    }

    /**
     * Clean old aggregation buckets
     */
    private cleanOldAggregations(): void {
        const cutoff = Date.now() - 300000; // Keep 5 minutes
        for (const [key, agg] of this.aggregations) {
            if (agg.timestamp < cutoff) {
                this.aggregations.delete(key);
            }
        }
    }
}
