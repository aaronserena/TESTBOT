/**
 * Walk-Forward Tester - Out-of-Sample Validation
 * Production-grade Bitcoin Scalping Bot
 * 
 * Implements walk-forward testing to validate parameter changes
 * before deployment.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ParameterSet } from './parameter-manager.js';
import { TYPES } from '../di/types.js';

export interface WalkForwardWindow {
    startTime: number;
    endTime: number;
    type: 'TRAINING' | 'VALIDATION';
}

export interface WalkForwardResult {
    id: string;
    parameterSetId: string;
    startedAt: number;
    completedAt?: number;
    windows: WalkForwardWindow[];
    trainingMetrics: {
        trades: number;
        winRate: number;
        sharpeRatio: number;
        maxDrawdown: number;
        pnl: number;
    };
    validationMetrics: {
        trades: number;
        winRate: number;
        sharpeRatio: number;
        maxDrawdown: number;
        pnl: number;
    };
    degradationPercent: number;
    passed: boolean;
    passThreshold: number;
}

export interface WalkForwardConfig {
    trainingWindowDays: number;
    validationWindowDays: number;
    minTrades: number;
    maxDegradationPercent: number;
    minValidationSharpe: number;
    minValidationWinRate: number;
}

const DEFAULT_CONFIG: WalkForwardConfig = {
    trainingWindowDays: 30,
    validationWindowDays: 7,
    minTrades: 50,
    maxDegradationPercent: 30,
    minValidationSharpe: 0.5,
    minValidationWinRate: 0.45
};

@injectable()
export class WalkForwardTester extends EventEmitter {
    private config: WalkForwardConfig;
    private results: WalkForwardResult[] = [];
    private isRunning: boolean = false;

    constructor() {
        super();
        this.config = { ...DEFAULT_CONFIG };
        console.log('[WalkForwardTester] Initialized');
    }

    /**
     * Configure walk-forward settings
     */
    configure(config: Partial<WalkForwardConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Run walk-forward test for a parameter set
     */
    async runTest(
        parameterSet: ParameterSet,
        historicalTrades: Array<{
            timestamp: number;
            pnl: number;
            parameters: Record<string, number>;
        }>
    ): Promise<WalkForwardResult> {
        const testId = uuidv4();
        const startedAt = Date.now();

        this.isRunning = true;
        this.emit('testStarted', { testId, parameterSetId: parameterSet.id });

        console.log(`[WalkForwardTester] Starting test ${testId.slice(0, 8)} for parameter set v${parameterSet.version}`);

        // Define windows
        const now = Date.now();
        const trainingEnd = now - (this.config.validationWindowDays * 86400000);
        const trainingStart = trainingEnd - (this.config.trainingWindowDays * 86400000);
        const validationEnd = now;
        const validationStart = trainingEnd;

        const windows: WalkForwardWindow[] = [
            { startTime: trainingStart, endTime: trainingEnd, type: 'TRAINING' },
            { startTime: validationStart, endTime: validationEnd, type: 'VALIDATION' }
        ];

        // Split trades by window
        const trainingTrades = historicalTrades.filter(
            t => t.timestamp >= trainingStart && t.timestamp < trainingEnd
        );
        const validationTrades = historicalTrades.filter(
            t => t.timestamp >= validationStart && t.timestamp <= validationEnd
        );

        // Calculate metrics
        const trainingMetrics = this.calculateMetrics(trainingTrades);
        const validationMetrics = this.calculateMetrics(validationTrades);

        // Calculate degradation
        const degradationPercent = trainingMetrics.sharpeRatio > 0
            ? ((trainingMetrics.sharpeRatio - validationMetrics.sharpeRatio) / trainingMetrics.sharpeRatio) * 100
            : 0;

        // Determine pass/fail
        const passed =
            validationTrades.length >= this.config.minTrades &&
            degradationPercent <= this.config.maxDegradationPercent &&
            validationMetrics.sharpeRatio >= this.config.minValidationSharpe &&
            validationMetrics.winRate >= this.config.minValidationWinRate;

        const result: WalkForwardResult = {
            id: testId,
            parameterSetId: parameterSet.id,
            startedAt,
            completedAt: Date.now(),
            windows,
            trainingMetrics,
            validationMetrics,
            degradationPercent,
            passed,
            passThreshold: this.config.maxDegradationPercent
        };

        this.results.push(result);
        this.isRunning = false;

        const status = passed ? '✓ PASSED' : '✗ FAILED';
        console.log(`[WalkForwardTester] ${status} - Degradation: ${degradationPercent.toFixed(1)}%, Validation Sharpe: ${validationMetrics.sharpeRatio.toFixed(2)}`);

        this.emit('testCompleted', result);

        return result;
    }

    /**
     * Calculate performance metrics from trades
     */
    private calculateMetrics(trades: Array<{ pnl: number }>): {
        trades: number;
        winRate: number;
        sharpeRatio: number;
        maxDrawdown: number;
        pnl: number;
    } {
        if (trades.length === 0) {
            return { trades: 0, winRate: 0, sharpeRatio: 0, maxDrawdown: 0, pnl: 0 };
        }

        const wins = trades.filter(t => t.pnl > 0).length;
        const winRate = wins / trades.length;
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

        // Calculate Sharpe ratio
        const returns = trades.map(t => t.pnl);
        const avgReturn = totalPnl / trades.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / trades.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

        // Calculate max drawdown
        let peak = 0;
        let maxDrawdown = 0;
        let cumulative = 0;
        for (const trade of trades) {
            cumulative += trade.pnl;
            if (cumulative > peak) peak = cumulative;
            const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        return {
            trades: trades.length,
            winRate,
            sharpeRatio,
            maxDrawdown: maxDrawdown * 100,
            pnl: totalPnl
        };
    }

    /**
     * Get all test results
     */
    getResults(): WalkForwardResult[] {
        return [...this.results];
    }

    /**
     * Get latest result for a parameter set
     */
    getLatestResult(parameterSetId: string): WalkForwardResult | undefined {
        return this.results
            .filter(r => r.parameterSetId === parameterSetId)
            .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
    }

    /**
     * Check if test is running
     */
    isTestRunning(): boolean {
        return this.isRunning;
    }
}
