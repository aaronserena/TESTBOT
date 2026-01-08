/**
 * Base Strategy - Deterministic Trading Logic
 * Production-grade Bitcoin Scalping Bot
 * 
 * Core strategy with explicit entry/exit logic, emergency exits,
 * stop-loss and take-profit logic.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type {
    AIDecisionResponse,
    FeatureVector,
    MarketSnapshot
} from '../types/decision.js';
import type { Position, Order } from '../types/core.js';
import { FeatureEngine } from '../features/feature-engine.js';
import { OrderBookManager } from '../data/orderbook.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { RulebookEngine } from '../risk/rulebook.js';
import { TYPES } from '../di/types.js';

export interface TradeSignal {
    type: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT' | 'HOLD';
    strength: number;  // 0 to 1
    reason: string;
    timestamp: number;
}

export interface StopLossTakeProfit {
    stopLossPrice: number;
    takeProfitPrice: number;
    trailingStopDistance?: number;
}

@injectable()
export class BaseStrategy extends EventEmitter {
    private lastSignal: TradeSignal | null = null;

    constructor(
        @inject(TYPES.FeatureEngine) private features: FeatureEngine,
        @inject(TYPES.OrderBookManager) private orderBook: OrderBookManager,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor,
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine
    ) {
        super();
        console.log('[BaseStrategy] Initialized');
    }

    /**
     * Generate entry/exit signal based on features
     */
    generateSignal(position: Position | null): TradeSignal {
        const f = this.features.calculate();
        const hasPosition = position !== null && position.side !== 'FLAT';

        // Check for exit conditions first (if we have a position)
        if (hasPosition && position) {
            const exitSignal = this.checkExitConditions(f, position);
            if (exitSignal) {
                this.lastSignal = exitSignal;
                return exitSignal;
            }
        }

        // Check for entry conditions (if no position)
        if (!hasPosition) {
            const entrySignal = this.checkEntryConditions(f);
            if (entrySignal) {
                this.lastSignal = entrySignal;
                return entrySignal;
            }
        }

        // Default to HOLD
        const holdSignal: TradeSignal = {
            type: 'HOLD',
            strength: 0,
            reason: 'No clear signal',
            timestamp: Date.now()
        };

        this.lastSignal = holdSignal;
        return holdSignal;
    }

    /**
     * Check entry conditions
     */
    private checkEntryConditions(f: FeatureVector): TradeSignal | null {
        const micro = f.microstructure;
        const momentum = f.momentum;
        const meanRev = f.meanReversion;
        const vol = f.volatility;
        const rules = this.rulebook.getRulebook();

        // FORBIDDEN: Don't enter if spread is too wide
        if (micro.spreadBps > rules.maxSpreadBps) {
            return null;
        }

        // FORBIDDEN: Don't enter in extreme volatility
        if (vol.volRegime === 'EXTREME') {
            return null;
        }

        // Entry Score System
        let longScore = 0;
        let shortScore = 0;
        const reasons: string[] = [];

        // RSI conditions
        if (momentum.rsi14 < 30) {
            longScore += 0.3;
            reasons.push('RSI oversold');
        } else if (momentum.rsi14 > 70) {
            shortScore += 0.3;
            reasons.push('RSI overbought');
        }

        // Book imbalance
        if (micro.bookImbalance > 0.3) {
            longScore += 0.2;
            reasons.push('Strong bid pressure');
        } else if (micro.bookImbalance < -0.3) {
            shortScore += 0.2;
            reasons.push('Strong ask pressure');
        }

        // Volume imbalance
        if (micro.volumeImbalance > 0.3) {
            longScore += 0.15;
            reasons.push('Buy volume dominant');
        } else if (micro.volumeImbalance < -0.3) {
            shortScore += 0.15;
            reasons.push('Sell volume dominant');
        }

        // Mean reversion (Bollinger Bands)
        if (meanRev.bbPosition < 0.1) {
            longScore += 0.25;
            reasons.push('At lower BB');
        } else if (meanRev.bbPosition > 0.9) {
            shortScore += 0.25;
            reasons.push('At upper BB');
        }

        // MACD momentum
        if (momentum.macdHistogram > 0 && momentum.macdLine > momentum.macdSignal) {
            longScore += 0.1;
            reasons.push('MACD bullish');
        } else if (momentum.macdHistogram < 0 && momentum.macdLine < momentum.macdSignal) {
            shortScore += 0.1;
            reasons.push('MACD bearish');
        }

        // Price vs EMAs
        if (momentum.priceVsEma20 < -0.5) {
            longScore += 0.1;
            reasons.push('Below EMA20');
        } else if (momentum.priceVsEma20 > 0.5) {
            shortScore += 0.1;
            reasons.push('Above EMA20');
        }

        // Determine if we have a valid signal
        const minSignalStrength = 0.5;

        if (longScore >= minSignalStrength && longScore > shortScore) {
            return {
                type: 'ENTRY_LONG',
                strength: Math.min(1, longScore),
                reason: reasons.join(', '),
                timestamp: Date.now()
            };
        }

        if (shortScore >= minSignalStrength && shortScore > longScore) {
            return {
                type: 'ENTRY_SHORT',
                strength: Math.min(1, shortScore),
                reason: reasons.join(', '),
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Check exit conditions
     */
    private checkExitConditions(f: FeatureVector, position: Position): TradeSignal | null {
        const currentPrice = this.tradeTape.getLastPrice();
        const isLong = position.side === 'LONG';
        const reasons: string[] = [];
        let exitStrength = 0;

        // Emergency exit conditions
        const rules = this.rulebook.getRulebook();

        // Check spread (emergency if spread too wide)
        if (f.microstructure.spreadBps > rules.maxSpreadBps * 2) {
            return {
                type: 'EXIT',
                strength: 1,
                reason: 'EMERGENCY: Spread too wide',
                timestamp: Date.now()
            };
        }

        // Check volatility (emergency if extreme)
        if (f.volatility.volRegime === 'EXTREME') {
            return {
                type: 'EXIT',
                strength: 1,
                reason: 'EMERGENCY: Extreme volatility',
                timestamp: Date.now()
            };
        }

        // Momentum reversal
        if (isLong) {
            if (f.momentum.rsi14 > 70) {
                exitStrength += 0.3;
                reasons.push('RSI overbought');
            }
            if (f.microstructure.bookImbalance < -0.4) {
                exitStrength += 0.2;
                reasons.push('Book turning bearish');
            }
            if (f.meanReversion.bbPosition > 0.95) {
                exitStrength += 0.3;
                reasons.push('At upper BB extreme');
            }
        } else {  // Short position
            if (f.momentum.rsi14 < 30) {
                exitStrength += 0.3;
                reasons.push('RSI oversold');
            }
            if (f.microstructure.bookImbalance > 0.4) {
                exitStrength += 0.2;
                reasons.push('Book turning bullish');
            }
            if (f.meanReversion.bbPosition < 0.05) {
                exitStrength += 0.3;
                reasons.push('At lower BB extreme');
            }
        }

        // P&L based exit
        if (position.unrealizedPnl > 0) {
            // Protect profits
            if (position.unrealizedPnl > 100 && f.momentum.macdHistogram * (isLong ? 1 : -1) < 0) {
                exitStrength += 0.4;
                reasons.push('Protect profits, momentum fading');
            }
        }

        if (exitStrength >= 0.6) {
            return {
                type: 'EXIT',
                strength: exitStrength,
                reason: reasons.join(', '),
                timestamp: Date.now()
            };
        }

        return null;
    }

    /**
     * Calculate stop-loss and take-profit levels
     */
    calculateSLTP(
        entryPrice: number,
        side: 'LONG' | 'SHORT',
        atr: number
    ): StopLossTakeProfit {
        const atrMultiplierSL = 1.5;
        const atrMultiplierTP = 2.5;

        let stopLossPrice: number;
        let takeProfitPrice: number;

        if (side === 'LONG') {
            stopLossPrice = entryPrice - (atr * atrMultiplierSL);
            takeProfitPrice = entryPrice + (atr * atrMultiplierTP);
        } else {
            stopLossPrice = entryPrice + (atr * atrMultiplierSL);
            takeProfitPrice = entryPrice - (atr * atrMultiplierTP);
        }

        return {
            stopLossPrice,
            takeProfitPrice,
            trailingStopDistance: atr * 1.0
        };
    }

    /**
     * Check if stop-loss or take-profit hit
     */
    checkSLTPHit(
        position: Position,
        sltp: StopLossTakeProfit,
        currentPrice: number
    ): 'STOP_LOSS' | 'TAKE_PROFIT' | null {
        if (position.side === 'LONG') {
            if (currentPrice <= sltp.stopLossPrice) return 'STOP_LOSS';
            if (currentPrice >= sltp.takeProfitPrice) return 'TAKE_PROFIT';
        } else if (position.side === 'SHORT') {
            if (currentPrice >= sltp.stopLossPrice) return 'STOP_LOSS';
            if (currentPrice <= sltp.takeProfitPrice) return 'TAKE_PROFIT';
        }
        return null;
    }

    /**
     * Get last generated signal
     */
    getLastSignal(): TradeSignal | null {
        return this.lastSignal;
    }
}
