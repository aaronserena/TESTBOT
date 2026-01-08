/**
 * Microstructure Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Calculates microstructure features: spread, order book imbalance,
 * queue pressure, and trade velocity.
 */

import { injectable, inject } from 'inversify';
import type { MicrostructureFeatures } from '../types/decision.js';
import { OrderBookManager } from '../data/orderbook.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { TYPES } from '../di/types.js';

@injectable()
export class MicrostructureCalculator {
    private spreadHistory: number[] = [];
    private maxHistory: number = 1000;

    constructor(
        @inject(TYPES.OrderBookManager) private orderBook: OrderBookManager,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        console.log('[MicrostructureCalculator] Initialized');
    }

    /**
     * Calculate all microstructure features
     */
    calculate(): MicrostructureFeatures {
        const timestamp = Date.now();
        const book = this.orderBook.getOrderBook();

        // Calculate spread
        const spread = this.orderBook.getBestAsk() - this.orderBook.getBestBid();
        const midPrice = this.orderBook.getMidPrice();
        const spreadBps = midPrice > 0 ? (spread / midPrice) * 10000 : 0;

        // Track spread history for z-score
        this.spreadHistory.push(spreadBps);
        if (this.spreadHistory.length > this.maxHistory) {
            this.spreadHistory.shift();
        }

        const spreadZScore = this.calculateZScore(spreadBps, this.spreadHistory);

        // Calculate book imbalance
        const bookImbalance = this.orderBook.getImbalance(5);

        // Calculate queue pressure (weighted by price distance)
        const queuePressure = this.calculateQueuePressure(book.bids, book.asks, midPrice);

        // Get depths
        const bidDepth = this.orderBook.getBidLiquidity(10);
        const askDepth = this.orderBook.getAskLiquidity(10);

        // Trade velocity (trades per second)
        const tradeVelocity = this.tradeTape.getTradeVelocity(5000);

        // Volume imbalance from trades
        const volumeImbalance = this.tradeTape.getVolumeImbalance(30000);

        return {
            spread,
            spreadBps,
            spreadZScore,
            bookImbalance,
            queuePressure,
            bidDepth,
            askDepth,
            tradeVelocity,
            volumeImbalance,
            timestamp
        };
    }

    /**
     * Calculate queue pressure metric
     * Positive = more bid pressure (bullish), negative = more ask pressure (bearish)
     */
    private calculateQueuePressure(
        bids: { price: number; quantity: number }[],
        asks: { price: number; quantity: number }[],
        midPrice: number
    ): number {
        if (midPrice === 0 || bids.length === 0 || asks.length === 0) {
            return 0;
        }

        // Weight by inverse distance from mid price
        let bidPressure = 0;
        let askPressure = 0;

        for (const bid of bids.slice(0, 10)) {
            const distance = Math.abs(midPrice - bid.price) / midPrice;
            const weight = 1 / (1 + distance * 100); // Closer levels weighted more
            bidPressure += bid.quantity * weight;
        }

        for (const ask of asks.slice(0, 10)) {
            const distance = Math.abs(ask.price - midPrice) / midPrice;
            const weight = 1 / (1 + distance * 100);
            askPressure += ask.quantity * weight;
        }

        const total = bidPressure + askPressure;
        if (total === 0) return 0;

        return (bidPressure - askPressure) / total;
    }

    /**
     * Calculate z-score of a value relative to history
     */
    private calculateZScore(value: number, history: number[]): number {
        if (history.length < 2) return 0;

        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;
        return (value - mean) / stdDev;
    }
}
