/**
 * Momentum Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Calculates momentum indicators: RSI, MACD, EMA, and short-horizon returns.
 */

import { injectable, inject } from 'inversify';
import type { MomentumFeatures } from '../types/decision.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { TYPES } from '../di/types.js';

@injectable()
export class MomentumCalculator {
    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        console.log('[MomentumCalculator] Initialized');
    }

    /**
     * Calculate all momentum features
     */
    calculate(): MomentumFeatures {
        const timestamp = Date.now();
        const closes = this.candles.getOHLCArrays('5m', 200);
        const currentPrice = this.tradeTape.getLastPrice();

        // Short-horizon returns
        const return5Bar = this.calculateReturn(closes.close, 5);
        const return10Bar = this.calculateReturn(closes.close, 10);
        const return20Bar = this.calculateReturn(closes.close, 20);

        // RSI calculations
        const rsi14 = this.calculateRSI(closes.close, 14);
        const rsi5 = this.calculateRSI(closes.close, 5);

        // MACD
        const { macdLine, macdSignal, macdHistogram } = this.calculateMACD(closes.close);

        // EMAs
        const ema20 = this.calculateEMA(closes.close, 20);
        const ema50 = this.calculateEMA(closes.close, 50);
        const ema200 = this.calculateEMA(closes.close, 200);

        // Price relative to EMAs
        const priceVsEma20 = ema20 > 0 ? ((currentPrice - ema20) / ema20) * 100 : 0;
        const priceVsEma50 = ema50 > 0 ? ((currentPrice - ema50) / ema50) * 100 : 0;

        return {
            return5Bar,
            return10Bar,
            return20Bar,
            rsi14,
            rsi5,
            macdLine,
            macdSignal,
            macdHistogram,
            ema20: ema20 || currentPrice,
            ema50: ema50 || currentPrice,
            ema200: ema200 || currentPrice,
            priceVsEma20,
            priceVsEma50,
            timestamp
        };
    }

    /**
     * Calculate return over N periods
     */
    private calculateReturn(closes: number[], periods: number): number {
        if (closes.length < periods + 1) return 0;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - 1 - periods];
        if (past === 0) return 0;
        return ((current - past) / past) * 100;
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    calculateRSI(closes: number[], period: number = 14): number {
        if (closes.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        // Calculate average gain and loss
        for (let i = closes.length - period; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate MACD (12, 26, 9)
     */
    private calculateMACD(closes: number[]): {
        macdLine: number;
        macdSignal: number;
        macdHistogram: number;
    } {
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);

        if (ema12 === null || ema26 === null) {
            return { macdLine: 0, macdSignal: 0, macdHistogram: 0 };
        }

        const macdLine = ema12 - ema26;

        // Calculate MACD line history for signal line
        const macdHistory: number[] = [];
        for (let i = 26; i <= closes.length; i++) {
            const slice = closes.slice(0, i);
            const e12 = this.calculateEMA(slice, 12);
            const e26 = this.calculateEMA(slice, 26);
            if (e12 !== null && e26 !== null) {
                macdHistory.push(e12 - e26);
            }
        }

        const macdSignal = this.calculateEMA(macdHistory, 9) || 0;
        const macdHistogram = macdLine - macdSignal;

        return { macdLine, macdSignal, macdHistogram };
    }

    /**
     * Calculate EMA (Exponential Moving Average)
     */
    calculateEMA(data: number[], period: number): number | null {
        if (data.length < period) return null;

        const multiplier = 2 / (period + 1);
        let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    /**
     * Check for RSI divergence (bullish or bearish)
     */
    checkRSIDivergence(closes: number[], period: number = 14): 'BULLISH' | 'BEARISH' | 'NONE' {
        if (closes.length < period * 2) return 'NONE';

        // Get RSI values for last 20 periods
        const rsiValues: number[] = [];
        for (let i = period; i < Math.min(closes.length, period + 20); i++) {
            const slice = closes.slice(0, i + 1);
            rsiValues.push(this.calculateRSI(slice, period));
        }

        if (rsiValues.length < 10) return 'NONE';

        // Check for bullish divergence: price lower low, RSI higher low
        const priceRecent = closes.slice(-10);
        const rsiRecent = rsiValues.slice(-10);

        const priceMin1 = Math.min(...priceRecent.slice(0, 5));
        const priceMin2 = Math.min(...priceRecent.slice(5));
        const rsiMin1 = Math.min(...rsiRecent.slice(0, 5));
        const rsiMin2 = Math.min(...rsiRecent.slice(5));

        if (priceMin2 < priceMin1 && rsiMin2 > rsiMin1) {
            return 'BULLISH';
        }

        // Check for bearish divergence: price higher high, RSI lower high
        const priceMax1 = Math.max(...priceRecent.slice(0, 5));
        const priceMax2 = Math.max(...priceRecent.slice(5));
        const rsiMax1 = Math.max(...rsiRecent.slice(0, 5));
        const rsiMax2 = Math.max(...rsiRecent.slice(5));

        if (priceMax2 > priceMax1 && rsiMax2 < rsiMax1) {
            return 'BEARISH';
        }

        return 'NONE';
    }
}
