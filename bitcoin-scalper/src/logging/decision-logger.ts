/**
 * Decision Logger - Full Audit Trail
 * Production-grade Bitcoin Scalping Bot
 * 
 * Logs every decision with inputs, features, rationale, hold time, and parameters.
 */

import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import type { DecisionLogEntry } from '../types/logging.js';
import type { AIDecisionRequest, AIDecisionResponse } from '../types/decision.js';
import type { RiskVeto } from '../types/risk.js';

@injectable()
export class DecisionLogger {
    private logs: DecisionLogEntry[] = [];
    private maxLogs: number = 10000;
    private sessionId: string;

    constructor() {
        this.sessionId = uuidv4();
        console.log('[DecisionLogger] Initialized with session:', this.sessionId);
    }

    /**
     * Log a decision
     */
    log(
        request: AIDecisionRequest,
        response: AIDecisionResponse,
        riskVeto: RiskVeto,
        actionTaken: boolean,
        orderId?: string
    ): string {
        const logId = uuidv4();
        const now = Date.now();

        const entry: DecisionLogEntry = {
            id: logId,
            requestId: request.requestId,
            sessionId: this.sessionId,
            requestedAt: request.timestamp,
            respondedAt: response.timestamp,
            latencyMs: response.timestamp - request.timestamp,
            request,
            response,
            riskVeto,
            actionTaken,
            orderId
        };

        this.logs.push(entry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        console.log(`[DecisionLogger] Logged decision ${logId.slice(0, 8)} | Action: ${response.action} | Vetoed: ${riskVeto.vetoed}`);

        return logId;
    }

    /**
     * Update log with execution details
     */
    updateExecution(logId: string, fillPrice: number, fillTime: number, slippage: number): void {
        const entry = this.logs.find(l => l.id === logId);
        if (entry) {
            entry.fillPrice = fillPrice;
            entry.fillTime = fillTime;
            entry.slippage = slippage;
        }
    }

    /**
     * Update log with trade outcome
     */
    updateOutcome(
        logId: string,
        pnl: number,
        pnlPercent: number,
        actualHoldTimeMs: number,
        exitReason: string
    ): void {
        const entry = this.logs.find(l => l.id === logId);
        if (entry) {
            entry.tradePnl = pnl;
            entry.tradePnlPercent = pnlPercent;
            entry.actualHoldTimeMs = actualHoldTimeMs;
            entry.exitReason = exitReason;
        }
    }

    /**
     * Update log with blunder analysis
     */
    updateBlunderLabel(logId: string, label: 'NOT_A_MISTAKE' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER', reason: string): void {
        const entry = this.logs.find(l => l.id === logId);
        if (entry) {
            entry.blunderLabel = label;
            entry.blunderReason = reason;
        }
    }

    /**
     * Get all logs
     */
    getLogs(): DecisionLogEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs for a time range
     */
    getLogsInRange(startTime: number, endTime: number): DecisionLogEntry[] {
        return this.logs.filter(l => l.requestedAt >= startTime && l.requestedAt <= endTime);
    }

    /**
     * Get log by ID
     */
    getLog(logId: string): DecisionLogEntry | undefined {
        return this.logs.find(l => l.id === logId);
    }

    /**
     * Get recent logs
     */
    getRecentLogs(count: number = 100): DecisionLogEntry[] {
        return this.logs.slice(-count);
    }

    /**
     * Get session summary
     */
    getSessionSummary(): {
        sessionId: string;
        totalDecisions: number;
        tradedCount: number;
        vetoedCount: number;
        avgLatencyMs: number;
    } {
        const traded = this.logs.filter(l => l.actionTaken).length;
        const vetoed = this.logs.filter(l => l.riskVeto.vetoed).length;
        const avgLatency = this.logs.length > 0
            ? this.logs.reduce((sum, l) => sum + l.latencyMs, 0) / this.logs.length
            : 0;

        return {
            sessionId: this.sessionId,
            totalDecisions: this.logs.length,
            tradedCount: traded,
            vetoedCount: vetoed,
            avgLatencyMs: Math.round(avgLatency)
        };
    }

    /**
     * Export logs as JSON
     */
    exportJSON(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Get current session ID
     */
    getSessionId(): string {
        return this.sessionId;
    }
}
