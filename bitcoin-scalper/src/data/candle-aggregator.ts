/**
 * Candle Aggregator - Multi-timeframe OHLCV
 * Production-grade Bitcoin Scalping Bot
 * 
 * Aggregates and maintains candles for multiple timeframes.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { Candle } from '../types/core.js';
import { WebSocketClient } from './websocket-client.js';
import { TradeTapeProcessor } from './trade-tape.js';
import { TYPES } from '../di/types.js';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface CandleStore {
    candles: Candle[];
    maxCandles: number;
}

@injectable()
export class CandleAggregator extends EventEmitter {
    private stores: Map<Timeframe, CandleStore> = new Map();
    private currentCandles: Map<Timeframe, Candle> = new Map();

    private static readonly TIMEFRAME_MS: Record<Timeframe, number> = {
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '1h': 3600000,
        '4h': 14400000,
        '1d': 86400000
    };

    constructor(
        @inject(TYPES.WebSocketClient) private wsClient: WebSocketClient,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        super();
        this.initializeStores();
        this.setupListeners();
        console.log('[CandleAggregator] Initialized');
    }

    /**
     * Get candles for a timeframe
     */
    getCandles(timeframe: Timeframe, count: number = 100): Candle[] {
        const store = this.stores.get(timeframe);
        if (!store) return [];
        return store.candles.slice(-count);
    }

    /**
     * Get current (incomplete) candle
     */
    getCurrentCandle(timeframe: Timeframe): Candle | null {
        return this.currentCandles.get(timeframe) || null;
    }

    /**
     * Get latest closed candle
     */
    getLatestCandle(timeframe: Timeframe): Candle | null {
        const store = this.stores.get(timeframe);
        if (!store || store.candles.length === 0) return null;
        return store.candles[store.candles.length - 1];
    }

    /**
     * Get OHLC values for technical analysis
     */
    getOHLCArrays(timeframe: Timeframe, count: number = 100): {
        open: number[];
        high: number[];
        low: number[];
        close: number[];
        volume: number[];
        timestamps: number[];
    } {
        const candles = this.getCandles(timeframe, count);
        return {
            open: candles.map(c => c.open),
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            volume: candles.map(c => c.volume),
            timestamps: candles.map(c => c.openTime)
        };
    }

    /**
     * Calculate SMA
     */
    calculateSMA(timeframe: Timeframe, period: number): number | null {
        const candles = this.getCandles(timeframe, period);
        if (candles.length < period) return null;
        const sum = candles.slice(-period).reduce((s, c) => s + c.close, 0);
        return sum / period;
    }

    /**
     * Calculate EMA
     */
    calculateEMA(timeframe: Timeframe, period: number): number | null {
        const candles = this.getCandles(timeframe, period + 1);
        if (candles.length < period) return null;

        const multiplier = 2 / (period + 1);
        let ema = candles[0].close;

        for (let i = 1; i < candles.length; i++) {
            ema = (candles[i].close - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Initialize candle stores for all timeframes
     */
    private initializeStores(): void {
        const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
        const maxCandles: Record<Timeframe, number> = {
            '1m': 1440,   // 24 hours
            '5m': 576,    // 48 hours
            '15m': 384,   // 4 days
            '1h': 168,    // 7 days
            '4h': 180,    // 30 days
            '1d': 365     // 1 year
        };

        for (const tf of timeframes) {
            this.stores.set(tf, {
                candles: [],
                maxCandles: maxCandles[tf]
            });
        }
    }

    /**
     * Set up WebSocket listeners
     */
    private setupListeners(): void {
        this.wsClient.on('message', (msg: any) => {
            if (msg.type === 'kline') {
                this.handleKlineUpdate(msg.data);
            }
        });

        // Also update from trade tape for real-time current candle
        this.tradeTape.on('trade', (trade: any) => {
            this.updateCurrentCandles(trade.price, trade.quantity, trade.timestamp);
        });
    }

    /**
     * Handle kline update from WebSocket
     */
    private handleKlineUpdate(data: any): void {
        const k = data.k;
        if (!k) return;

        const timeframe = k.i as Timeframe;
        const store = this.stores.get(timeframe);
        if (!store) return;

        const candle: Candle = {
            symbol: 'BTCUSDT',
            interval: timeframe,
            openTime: k.t,
            closeTime: k.T,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            quoteVolume: parseFloat(k.q),
            trades: k.n,
            isClosed: k.x
        };

        if (k.x) {
            // Candle is closed - add to store
            this.addCandle(timeframe, candle);
            this.emit('candleClosed', { timeframe, candle });
        } else {
            // Update current candle
            this.currentCandles.set(timeframe, candle);
            this.emit('candleUpdate', { timeframe, candle });
        }
    }

    /**
     * Update current candles from trade data
     */
    private updateCurrentCandles(price: number, quantity: number, timestamp: number): void {
        for (const [timeframe, intervalMs] of Object.entries(CandleAggregator.TIMEFRAME_MS)) {
            const tf = timeframe as Timeframe;
            const openTime = Math.floor(timestamp / intervalMs) * intervalMs;
            const closeTime = openTime + intervalMs - 1;

            let current = this.currentCandles.get(tf);

            if (!current || current.openTime !== openTime) {
                // New candle
                if (current && current.openTime < openTime) {
                    // Previous candle closed
                    current.isClosed = true;
                    this.addCandle(tf, current);
                }

                current = {
                    symbol: 'BTCUSDT',
                    interval: tf,
                    openTime,
                    closeTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: quantity,
                    quoteVolume: price * quantity,
                    trades: 1,
                    isClosed: false
                };
                this.currentCandles.set(tf, current);
            } else {
                // Update existing
                current.high = Math.max(current.high, price);
                current.low = Math.min(current.low, price);
                current.close = price;
                current.volume += quantity;
                current.quoteVolume += price * quantity;
                current.trades++;
            }
        }
    }

    /**
     * Add a closed candle to the store
     */
    private addCandle(timeframe: Timeframe, candle: Candle): void {
        const store = this.stores.get(timeframe);
        if (!store) return;

        // Avoid duplicates
        const lastCandle = store.candles[store.candles.length - 1];
        if (lastCandle && lastCandle.openTime >= candle.openTime) {
            return;
        }

        store.candles.push(candle);

        // Trim to max size
        if (store.candles.length > store.maxCandles) {
            store.candles.shift();
        }
    }
}
