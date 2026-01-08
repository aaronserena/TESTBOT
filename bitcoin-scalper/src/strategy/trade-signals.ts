/**
 * Trade Signals - Upcoming Trade Opportunities
 * Production-grade Bitcoin Scalping Bot
 * 
 * Tracks and broadcasts potential trade signals before execution.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { FeatureVector } from '../types/decision.js';
import { TYPES } from '../di/types.js';

export interface TradeSignal {
    id: string;
    timestamp: number;
    direction: 'LONG' | 'SHORT';
    signalStrength: number;  // 0-1
    confidence: number;      // 0-1
    entryPrice: number;
    suggestedSize: number;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    regime: string;
    triggers: string[];      // What triggered the signal
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
    expiresAt: number;
    features: {
        rsi: number;
        bookImbalance: number;
        spreadBps: number;
        volumeImbalance: number;
        atrPercent: number;
    };
}

@injectable()
export class TradeSignalManager extends EventEmitter {
    private signals: TradeSignal[] = [];
    private maxSignals: number = 100;
    private signalExpiryMs: number = 60000; // 1 minute

    constructor() {
        super();
        console.log('[TradeSignalManager] Initialized');
    }

    /**
     * Create a new trade signal
     */
    createSignal(params: {
        direction: 'LONG' | 'SHORT';
        signalStrength: number;
        confidence: number;
        entryPrice: number;
        suggestedSize: number;
        suggestedStopLoss: number;
        suggestedTakeProfit: number;
        regime: string;
        triggers: string[];
        features: TradeSignal['features'];
    }): TradeSignal {
        const signal: TradeSignal = {
            id: uuidv4(),
            timestamp: Date.now(),
            ...params,
            status: 'PENDING',
            expiresAt: Date.now() + this.signalExpiryMs
        };

        this.signals.push(signal);

        // Trim old signals
        if (this.signals.length > this.maxSignals) {
            this.signals = this.signals.slice(-this.maxSignals);
        }

        console.log(`[TradeSignalManager] New signal: ${signal.direction} ${signal.signalStrength.toFixed(2)} strength`);
        this.emit('newSignal', signal);

        return signal;
    }

    /**
     * Update signal status
     */
    updateStatus(signalId: string, status: TradeSignal['status']): void {
        const signal = this.signals.find(s => s.id === signalId);
        if (signal) {
            signal.status = status;
            this.emit('signalUpdated', signal);
        }
    }

    /**
     * Mark signal as executed
     */
    markExecuted(signalId: string): void {
        this.updateStatus(signalId, 'EXECUTED');
    }

    /**
     * Get pending signals
     */
    getPendingSignals(): TradeSignal[] {
        const now = Date.now();
        return this.signals
            .filter(s => s.status === 'PENDING' && s.expiresAt > now)
            .sort((a, b) => b.signalStrength - a.signalStrength);
    }

    /**
     * Get recent signals (all statuses)
     */
    getRecentSignals(count: number = 20): TradeSignal[] {
        return this.signals.slice(-count).reverse();
    }

    /**
     * Get signal by ID
     */
    getSignal(id: string): TradeSignal | undefined {
        return this.signals.find(s => s.id === id);
    }

    /**
     * Expire old signals
     */
    expireOldSignals(): void {
        const now = Date.now();
        for (const signal of this.signals) {
            if (signal.status === 'PENDING' && signal.expiresAt < now) {
                signal.status = 'EXPIRED';
                this.emit('signalExpired', signal);
            }
        }
    }

    /**
     * Clear all signals
     */
    clear(): void {
        this.signals = [];
    }
}
