/**
 * Blunder Analyzer - Trade Quality Assessment
 * Production-grade Bitcoin Scalping Bot
 * 
 * Chess-style blunder analysis that labels trades as:
 * - NOT_A_MISTAKE: Optimal decision
 * - INACCURACY: Minor suboptimal
 * - MISTAKE: Significant error
 * - BLUNDER: Critical failure or rule violation
 */

import { injectable, inject } from 'inversify';
import type {
    BlunderAnalysisResult,
    BlunderLabel,
    BlunderCategory,
    BlunderStatistics
} from '../types/analysis.js';
import type { DecisionLogEntry, TradeHistoryEntry } from '../types/logging.js';
import { RulebookEngine } from '../risk/rulebook.js';
import { DecisionLogger } from '../logging/decision-logger.js';
import { TYPES } from '../di/types.js';

@injectable()
export class BlunderAnalyzer {
    private analysisResults: BlunderAnalysisResult[] = [];

    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine,
        @inject(TYPES.DecisionLogger) private decisionLogger: DecisionLogger
    ) {
        console.log('[BlunderAnalyzer] Initialized');
    }

    /**
     * Analyze a completed trade
     */
    analyze(trade: TradeHistoryEntry, decisionLog: DecisionLogEntry): BlunderAnalysisResult {
        const rules = this.rulebook.getRulebook();
        let label: BlunderLabel = 'NOT_A_MISTAKE';
        let category: BlunderCategory = 'NONE';
        let severity = 0;
        const recommendations: string[] = [];

        // Check for rule violations (always a BLUNDER)
        const ruleViolations = this.checkRuleViolations(decisionLog, rules);
        if (ruleViolations.length > 0) {
            label = 'BLUNDER';
            category = ruleViolations[0].category;
            severity = 100;
            recommendations.push(...ruleViolations.map(v => `Avoid: ${v.reason}`));
        }

        // Check for forbidden condition violations
        if (label !== 'BLUNDER' && decisionLog.riskVeto.failedChecks.includes('FORBIDDEN_CONDITIONS')) {
            if (decisionLog.actionTaken) {
                label = 'BLUNDER';
                category = 'TRADED_DURING_FORBIDDEN';
                severity = 90;
                recommendations.push('Do not trade when forbidden conditions are active');
            }
        }

        // Check for oversizing
        if (label !== 'BLUNDER' && decisionLog.response.size > rules.maxPositionSizeBTC * 0.8) {
            if (trade.pnl && trade.pnl < 0) {
                label = 'MISTAKE';
                category = 'OVERSIZED_POSITION';
                severity = 60;
                recommendations.push('Reduce position size to stay well under max limits');
            }
        }

        // Check hold time vs planned
        if (label === 'NOT_A_MISTAKE' && trade.holdTimeMs && trade.plannedHoldTimeMs) {
            const holdRatio = trade.holdTimeMs / trade.plannedHoldTimeMs;

            if (holdRatio < 0.3 && trade.pnl && trade.pnl < 0) {
                label = 'INACCURACY';
                category = 'PREMATURE_EXIT';
                severity = 30;
                recommendations.push('Consider letting trades run closer to planned hold time');
            } else if (holdRatio > 2 && trade.pnl && trade.pnl < 0) {
                label = 'MISTAKE';
                category = 'LATE_EXIT';
                severity = 50;
                recommendations.push('Exit trades more promptly when conditions deteriorate');
            }
        }

        // Check for directional errors
        if (label === 'NOT_A_MISTAKE' && trade.pnl) {
            const features = decisionLog.request.features;

            // Strong momentum against position
            if (trade.side === 'LONG' && features.momentum.return10Bar < -1 && trade.pnl < 0) {
                label = 'MISTAKE';
                category = 'WRONG_DIRECTION';
                severity = 55;
                recommendations.push('Avoid longs when short-term momentum is strongly negative');
            } else if (trade.side === 'SHORT' && features.momentum.return10Bar > 1 && trade.pnl < 0) {
                label = 'MISTAKE';
                category = 'WRONG_DIRECTION';
                severity = 55;
                recommendations.push('Avoid shorts when short-term momentum is strongly positive');
            }
        }

        // Estimate cost
        const estimatedCost = trade.pnl ? Math.abs(Math.min(0, trade.pnl)) : 0;
        const costPercent = trade.entryPrice > 0 && trade.size > 0
            ? (estimatedCost / (trade.entryPrice * trade.size)) * 100
            : 0;

        const result: BlunderAnalysisResult = {
            tradeId: trade.id,
            decisionId: trade.decisionId,
            label,
            category,
            severity,
            estimatedCost,
            costPercent,
            actualPnl: trade.pnl || 0,
            marketState: {
                regime: trade.regime || 'UNKNOWN',
                spread: decisionLog.request.features.microstructure.spreadBps,
                volatility: decisionLog.request.features.volatility.atrPercent,
                hasNews: decisionLog.request.highImpactNewsInWindow
            },
            reason: this.generateReason(label, category),
            recommendations,
            analyzedAt: Date.now()
        };

        this.analysisResults.push(result);

        // Update decision log with blunder label
        this.decisionLogger.updateBlunderLabel(decisionLog.id, label, result.reason);

        return result;
    }

    /**
     * Check for rule violations
     */
    private checkRuleViolations(
        log: DecisionLogEntry,
        rules: ReturnType<RulebookEngine['getRulebook']>
    ): { category: BlunderCategory; reason: string }[] {
        const violations: { category: BlunderCategory; reason: string }[] = [];

        // Check spread
        if (log.request.features.microstructure.spreadBps > rules.maxSpreadBps) {
            violations.push({
                category: 'RULE_VIOLATION_SPREAD',
                reason: `Traded with spread ${log.request.features.microstructure.spreadBps.toFixed(1)}bps > max ${rules.maxSpreadBps}bps`
            });
        }

        // Check position size
        if (log.response.size > rules.maxPositionSizeBTC) {
            violations.push({
                category: 'RULE_VIOLATION_SIZE',
                reason: `Position size ${log.response.size}BTC > max ${rules.maxPositionSizeBTC}BTC`
            });
        }

        // Check hold time
        if (log.response.holdTimeMs < rules.minHoldTimeMs || log.response.holdTimeMs > rules.maxHoldTimeMs) {
            violations.push({
                category: 'RULE_VIOLATION_TIMING',
                reason: `Hold time ${log.response.holdTimeMs}ms outside bounds [${rules.minHoldTimeMs}, ${rules.maxHoldTimeMs}]`
            });
        }

        return violations;
    }

    /**
     * Generate human-readable reason
     */
    private generateReason(label: BlunderLabel, category: BlunderCategory): string {
        switch (label) {
            case 'NOT_A_MISTAKE':
                return 'Trade execution was optimal given available information';
            case 'INACCURACY':
                return `Minor suboptimal decision: ${category.replace(/_/g, ' ').toLowerCase()}`;
            case 'MISTAKE':
                return `Significant error: ${category.replace(/_/g, ' ').toLowerCase()} - affected P&L`;
            case 'BLUNDER':
                return `Critical failure: ${category.replace(/_/g, ' ').toLowerCase()} - rule violation or major loss`;
            default:
                return 'Unknown classification';
        }
    }

    /**
     * Get statistics
     */
    getStatistics(startTime?: number, endTime?: number): BlunderStatistics {
        let results = this.analysisResults;

        if (startTime) {
            results = results.filter(r => r.analyzedAt >= startTime);
        }
        if (endTime) {
            results = results.filter(r => r.analyzedAt <= endTime);
        }

        const total = results.length;
        const notAMistake = results.filter(r => r.label === 'NOT_A_MISTAKE').length;
        const inaccuracy = results.filter(r => r.label === 'INACCURACY').length;
        const mistake = results.filter(r => r.label === 'MISTAKE').length;
        const blunder = results.filter(r => r.label === 'BLUNDER').length;

        const totalBlunderCost = results
            .filter(r => r.label === 'BLUNDER')
            .reduce((sum, r) => sum + r.estimatedCost, 0);

        const categoryBreakdown: Record<BlunderCategory, number> = {} as any;
        for (const result of results) {
            categoryBreakdown[result.category] = (categoryBreakdown[result.category] || 0) + 1;
        }

        return {
            startTime: startTime || 0,
            endTime: endTime || Date.now(),
            totalTrades: total,
            notAMistakeCount: notAMistake,
            inaccuracyCount: inaccuracy,
            mistakeCount: mistake,
            blunderCount: blunder,
            notAMistakePercent: total > 0 ? (notAMistake / total) * 100 : 0,
            inaccuracyPercent: total > 0 ? (inaccuracy / total) * 100 : 0,
            mistakePercent: total > 0 ? (mistake / total) * 100 : 0,
            blunderPercent: total > 0 ? (blunder / total) * 100 : 0,
            totalBlunderCost,
            avgBlunderCost: blunder > 0 ? totalBlunderCost / blunder : undefined,
            categoryBreakdown,
            blunderRateTrend: 'UNKNOWN'
        };
    }

    /**
     * Get all analysis results
     */
    getResults(): BlunderAnalysisResult[] {
        return [...this.analysisResults];
    }
}
