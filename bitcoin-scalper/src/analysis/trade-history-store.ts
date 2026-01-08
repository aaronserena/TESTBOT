/**
 * Trade History Storage - Persistent Trade Records
 * Production-grade Bitcoin Scalping Bot
 * 
 * Stores and queries historical trades for analysis.
 */

import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import type { TradeHistoryEntry } from '../types/logging.js';

@injectable()
export class TradeHistoryStore {
    private trades: TradeHistoryEntry[] = [];
    private maxTrades: number = 100000;

    constructor() {
        console.log('[TradeHistoryStore] Initialized');
    }

    /**
     * Record a completed trade
     */
    recordTrade(trade: Omit<TradeHistoryEntry, 'id'>): string {
        const id = uuidv4();
        const entry: TradeHistoryEntry = { id, ...trade };

        this.trades.push(entry);

        // Trim old trades
        if (this.trades.length > this.maxTrades) {
            this.trades = this.trades.slice(-this.maxTrades);
        }

        return id;
    }

    /**
     * Get all trades
     */
    getAllTrades(): TradeHistoryEntry[] {
        return [...this.trades];
    }

    /**
     * Get trades in date range
     */
    getTradesInRange(startTime: number, endTime: number): TradeHistoryEntry[] {
        return this.trades.filter(t =>
            t.openTime >= startTime && t.openTime <= endTime
        );
    }

    /**
     * Get trades by session
     */
    getTradesBySession(sessionId: string): TradeHistoryEntry[] {
        return this.trades.filter(t => t.sessionId === sessionId);
    }

    /**
     * Get trade by ID
     */
    getTrade(id: string): TradeHistoryEntry | undefined {
        return this.trades.find(t => t.id === id);
    }

    /**
     * Get recent trades
     */
    getRecentTrades(count: number = 100): TradeHistoryEntry[] {
        return this.trades.slice(-count);
    }

    /**
     * Get winning trades
     */
    getWinningTrades(): TradeHistoryEntry[] {
        return this.trades.filter(t => t.pnl !== undefined && t.pnl > 0);
    }

    /**
     * Get losing trades
     */
    getLosingTrades(): TradeHistoryEntry[] {
        return this.trades.filter(t => t.pnl !== undefined && t.pnl < 0);
    }

    /**
     * Get trades by regime
     */
    getTradesByRegime(regime: string): TradeHistoryEntry[] {
        return this.trades.filter(t => t.regime === regime);
    }

    /**
     * Get trades by blunder label
     */
    getTradesByBlunderLabel(label: string): TradeHistoryEntry[] {
        return this.trades.filter(t => t.blunderLabel === label);
    }

    /**
     * Calculate aggregate statistics
     */
    getStatistics(trades?: TradeHistoryEntry[]): {
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        totalPnl: number;
        avgPnl: number;
        avgWin: number;
        avgLoss: number;
        profitFactor: number;
        expectancy: number;
        maxConsecutiveWins: number;
        maxConsecutiveLosses: number;
    } {
        const data = trades || this.trades;

        if (data.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnl: 0,
                avgPnl: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                expectancy: 0,
                maxConsecutiveWins: 0,
                maxConsecutiveLosses: 0
            };
        }

        const winners = data.filter(t => t.pnl !== undefined && t.pnl > 0);
        const losers = data.filter(t => t.pnl !== undefined && t.pnl < 0);

        const grossProfit = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));
        const totalPnl = grossProfit - grossLoss;

        // Calculate consecutive win/loss streaks
        let maxWinStreak = 0, maxLossStreak = 0;
        let currentWinStreak = 0, currentLossStreak = 0;

        for (const trade of data) {
            if (trade.pnl !== undefined && trade.pnl > 0) {
                currentWinStreak++;
                currentLossStreak = 0;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
            } else if (trade.pnl !== undefined && trade.pnl < 0) {
                currentLossStreak++;
                currentWinStreak = 0;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            }
        }

        return {
            totalTrades: data.length,
            winningTrades: winners.length,
            losingTrades: losers.length,
            winRate: data.length > 0 ? winners.length / data.length : 0,
            totalPnl,
            avgPnl: data.length > 0 ? totalPnl / data.length : 0,
            avgWin: winners.length > 0 ? grossProfit / winners.length : 0,
            avgLoss: losers.length > 0 ? grossLoss / losers.length : 0,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
            expectancy: data.length > 0
                ? (winners.length / data.length) * (grossProfit / Math.max(1, winners.length)) -
                (losers.length / data.length) * (grossLoss / Math.max(1, losers.length))
                : 0,
            maxConsecutiveWins: maxWinStreak,
            maxConsecutiveLosses: maxLossStreak
        };
    }

    /**
     * Export trades as JSON
     */
    exportJSON(): string {
        return JSON.stringify(this.trades, null, 2);
    }

    /**
     * Import trades from JSON
     */
    importJSON(json: string): void {
        try {
            const imported = JSON.parse(json);
            if (Array.isArray(imported)) {
                this.trades = [...this.trades, ...imported];
            }
        } catch (error) {
            console.error('[TradeHistoryStore] Import failed:', error);
        }
    }

    /**
     * Clear all trades
     */
    clear(): void {
        this.trades = [];
    }
}
