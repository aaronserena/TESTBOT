/**
 * Risk Metrics Tracker
 * Production-grade Bitcoin Scalping Bot
 * 
 * Tracks real-time risk metrics including P&L, drawdown, and streaks.
 */

import { injectable } from 'inversify';
import type { RiskMetrics } from '../types/risk.js';
import { createInitialRiskMetrics } from '../types/risk.js';

@injectable()
export class RiskMetricsTracker {
    private metrics: RiskMetrics;
    private peakEquity: number = 0;
    private startOfDayEquity: number = 0;
    private orderTimestamps: number[] = [];

    constructor() {
        this.metrics = createInitialRiskMetrics();
        console.log('[RiskMetricsTracker] Initialized');
    }

    /**
     * Get current metrics (read-only)
     */
    getMetrics(): Readonly<RiskMetrics> {
        // Update order rate metrics before returning
        this.updateOrderRates();
        return { ...this.metrics };
    }

    /**
     * Initialize with starting equity
     */
    initialize(startingEquity: number): void {
        this.peakEquity = startingEquity;
        this.startOfDayEquity = startingEquity;
        console.log(`[RiskMetricsTracker] Initialized with equity: $${startingEquity}`);
    }

    /**
     * Update metrics after a trade closes
     */
    recordTradeClose(pnl: number, currentEquity: number): void {
        const now = Date.now();

        // Update P&L metrics
        this.metrics.dailyPnl += pnl;
        this.metrics.dailyTrades++;

        if (this.startOfDayEquity > 0) {
            this.metrics.dailyPnlPercent = (this.metrics.dailyPnl / this.startOfDayEquity) * 100;
        }

        // Update win/loss counters and streaks
        if (pnl > 0) {
            this.metrics.dailyWins++;
            this.metrics.consecutiveWins++;
            this.metrics.consecutiveLosses = 0;
        } else if (pnl < 0) {
            this.metrics.dailyLosses++;
            this.metrics.consecutiveLosses++;
            this.metrics.consecutiveWins = 0;
        }

        // Update drawdown
        if (currentEquity > this.peakEquity) {
            this.peakEquity = currentEquity;
        }

        if (this.peakEquity > 0) {
            this.metrics.currentDrawdown = ((this.peakEquity - currentEquity) / this.peakEquity) * 100;
            if (this.metrics.currentDrawdown > this.metrics.maxDrawdown) {
                this.metrics.maxDrawdown = this.metrics.currentDrawdown;
                this.metrics.drawdownStartedAt = now;
            }
        }

        this.metrics.lastTradeAt = now;
        this.metrics.updatedAt = now;
    }

    /**
     * Record an order being placed (for rate limiting)
     */
    recordOrderPlaced(): void {
        this.orderTimestamps.push(Date.now());
        this.updateOrderRates();
    }

    /**
     * Update current exposure
     */
    updateExposure(exposurePercent: number): void {
        this.metrics.currentExposurePercent = exposurePercent;
        this.metrics.updatedAt = Date.now();
    }

    /**
     * Reset daily metrics (call at start of new trading day)
     */
    resetDailyMetrics(currentEquity: number): void {
        this.startOfDayEquity = currentEquity;
        this.metrics.dailyPnl = 0;
        this.metrics.dailyPnlPercent = 0;
        this.metrics.dailyTrades = 0;
        this.metrics.dailyWins = 0;
        this.metrics.dailyLosses = 0;
        this.metrics.updatedAt = Date.now();
        console.log('[RiskMetricsTracker] Daily metrics reset');
    }

    /**
     * Update order rate metrics
     */
    private updateOrderRates(): void {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;

        // Clean up old timestamps and count
        this.orderTimestamps = this.orderTimestamps.filter(t => t > oneHourAgo);

        this.metrics.ordersLastMinute = this.orderTimestamps.filter(t => t > oneMinuteAgo).length;
        this.metrics.ordersLastHour = this.orderTimestamps.length;
        this.metrics.updatedAt = now;
    }

    /**
     * Check if approaching daily loss limit
     */
    isApproachingDailyLimit(warningThresholdPercent: number = 80): boolean {
        const pctOfLimit = Math.abs(this.metrics.dailyPnlPercent) / 2 * 100; // Assuming 2% daily limit
        return pctOfLimit >= warningThresholdPercent;
    }

    /**
     * Check if in losing streak
     */
    isInLosingStreak(threshold: number = 3): boolean {
        return this.metrics.consecutiveLosses >= threshold;
    }
}
