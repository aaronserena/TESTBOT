/**
 * Order Book Manager - L2 Order Book Maintenance
 * Production-grade Bitcoin Scalping Bot
 * 
 * Maintains a local L2 order book with real-time updates.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { OrderBook, OrderBookLevel } from '../types/core.js';
import { OrderBookSchema } from '../types/core.js';
import { WebSocketClient } from './websocket-client.js';
import { TYPES } from '../di/types.js';

@injectable()
export class OrderBookManager extends EventEmitter {
    private orderBook: OrderBook;
    private lastUpdateId: number = 0;
    private isInitialized: boolean = false;
    private updateCount: number = 0;

    constructor(
        @inject(TYPES.WebSocketClient) private wsClient: WebSocketClient
    ) {
        super();
        this.orderBook = this.createEmptyOrderBook();
        this.setupListeners();
        console.log('[OrderBookManager] Initialized');
    }

    /**
     * Get current order book (read-only copy)
     */
    getOrderBook(): Readonly<OrderBook> {
        return { ...this.orderBook };
    }

    /**
     * Get best bid price
     */
    getBestBid(): number {
        return this.orderBook.bids[0]?.price ?? 0;
    }

    /**
     * Get best ask price
     */
    getBestAsk(): number {
        return this.orderBook.asks[0]?.price ?? 0;
    }

    /**
     * Get mid price
     */
    getMidPrice(): number {
        const bid = this.getBestBid();
        const ask = this.getBestAsk();
        if (bid === 0 || ask === 0) return 0;
        return (bid + ask) / 2;
    }

    /**
     * Get spread in basis points
     */
    getSpreadBps(): number {
        const mid = this.getMidPrice();
        if (mid === 0) return Infinity;
        const spread = this.getBestAsk() - this.getBestBid();
        return (spread / mid) * 10000;
    }

    /**
     * Get total bid liquidity within depth levels
     */
    getBidLiquidity(levels: number = 10): number {
        return this.orderBook.bids
            .slice(0, levels)
            .reduce((sum, l) => sum + l.quantity, 0);
    }

    /**
     * Get total ask liquidity within depth levels
     */
    getAskLiquidity(levels: number = 10): number {
        return this.orderBook.asks
            .slice(0, levels)
            .reduce((sum, l) => sum + l.quantity, 0);
    }

    /**
     * Calculate order book imbalance (-1 to 1)
     */
    getImbalance(levels: number = 5): number {
        const bidVol = this.getBidLiquidity(levels);
        const askVol = this.getAskLiquidity(levels);
        const total = bidVol + askVol;
        if (total === 0) return 0;
        return (bidVol - askVol) / total;
    }

    /**
     * Estimate fill price for a given size
     */
    estimateFillPrice(sizeBTC: number, side: 'BUY' | 'SELL'): number {
        const levels = side === 'BUY' ? this.orderBook.asks : this.orderBook.bids;
        let remaining = sizeBTC;
        let totalCost = 0;

        for (const level of levels) {
            const fillQty = Math.min(remaining, level.quantity);
            totalCost += fillQty * level.price;
            remaining -= fillQty;
            if (remaining <= 0) break;
        }

        if (remaining > 0) {
            // Not enough liquidity
            return side === 'BUY' ? Infinity : 0;
        }

        return totalCost / sizeBTC;
    }

    /**
     * Check if order book is stale
     */
    isStale(maxAgeMs: number = 5000): boolean {
        return Date.now() - this.orderBook.timestamp > maxAgeMs;
    }

    /**
     * Check if order book is initialized
     */
    isReady(): boolean {
        return this.isInitialized && !this.isStale();
    }

    /**
     * Set up WebSocket listeners
     */
    private setupListeners(): void {
        this.wsClient.on('message', (msg: any) => {
            if (msg.type === 'depth') {
                this.handleDepthUpdate(msg.data);
            } else if (msg.type === 'bookTicker') {
                this.handleBookTicker(msg.data);
            }
        });
    }

    /**
     * Handle depth update from WebSocket
     */
    private handleDepthUpdate(data: any): void {
        // Binance depth update format
        const { U, u, b, a, E } = data;

        // Skip if update is older than our current state
        if (u <= this.lastUpdateId) {
            return;
        }

        // Update bids
        if (Array.isArray(b)) {
            for (const [price, qty] of b) {
                this.updateLevel('bids', parseFloat(price), parseFloat(qty));
            }
        }

        // Update asks
        if (Array.isArray(a)) {
            for (const [price, qty] of a) {
                this.updateLevel('asks', parseFloat(price), parseFloat(qty));
            }
        }

        this.lastUpdateId = u;
        this.orderBook.lastUpdateId = u;
        this.orderBook.timestamp = E || Date.now();
        this.updateCount++;

        if (!this.isInitialized && this.orderBook.bids.length > 0 && this.orderBook.asks.length > 0) {
            this.isInitialized = true;
            console.log('[OrderBookManager] Order book initialized');
        }

        // Emit update event
        this.emit('update', {
            midPrice: this.getMidPrice(),
            spreadBps: this.getSpreadBps(),
            imbalance: this.getImbalance(),
            timestamp: this.orderBook.timestamp
        });
    }

    /**
     * Handle best bid/ask update
     */
    private handleBookTicker(data: any): void {
        const { b, B, a, A, E } = data;

        // Update top of book
        if (b && B) {
            this.updateLevel('bids', parseFloat(b), parseFloat(B));
        }
        if (a && A) {
            this.updateLevel('asks', parseFloat(a), parseFloat(A));
        }

        this.orderBook.timestamp = E || Date.now();
    }

    /**
     * Update a single price level
     */
    private updateLevel(side: 'bids' | 'asks', price: number, quantity: number): void {
        const levels = this.orderBook[side];
        const isDescending = side === 'bids';

        // Remove level if quantity is 0
        if (quantity === 0) {
            const idx = levels.findIndex(l => l.price === price);
            if (idx !== -1) {
                levels.splice(idx, 1);
            }
            return;
        }

        // Find position for update/insert
        let insertIdx = levels.findIndex(l =>
            isDescending ? l.price <= price : l.price >= price
        );

        if (insertIdx === -1) {
            insertIdx = levels.length;
        }

        // Check if updating existing level
        if (levels[insertIdx]?.price === price) {
            levels[insertIdx].quantity = quantity;
        } else {
            // Insert new level
            levels.splice(insertIdx, 0, { price, quantity });
        }

        // Keep only top 20 levels
        if (levels.length > 20) {
            levels.length = 20;
        }
    }

    /**
     * Create empty order book
     */
    private createEmptyOrderBook(): OrderBook {
        return {
            symbol: 'BTCUSDT',
            timestamp: Date.now(),
            bids: [],
            asks: [],
            lastUpdateId: 0
        };
    }
}
