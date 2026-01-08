/**
 * Veto Gate - Final Authority Before Execution
 * Production-grade Bitcoin Scalping Bot
 * 
 * CRITICAL: This module has ABSOLUTE VETO POWER over all AI decisions.
 * No trade can execute without passing through this gate.
 */

import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { RulebookEngine } from './rulebook.js';
import { KillSwitch } from './kill-switch.js';
import { ForbiddenConditionsChecker } from './forbidden-conditions.js';
import { RiskMetricsTracker } from './metrics-tracker.js';
import type { RiskVeto, RiskCheckResult } from '../types/risk.js';
import type { AIDecisionResponse } from '../types/decision.js';
import type { OrderBook } from '../types/core.js';
import { TYPES } from '../di/types.js';

export interface VetoContext {
    decision: AIDecisionResponse;
    orderBook: OrderBook;
    currentPrice: number;
}

@injectable()
export class VetoGate {
    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine,
        @inject(TYPES.KillSwitch) private killSwitch: KillSwitch,
        @inject(TYPES.ForbiddenConditionsChecker) private forbiddenChecker: ForbiddenConditionsChecker,
        @inject(TYPES.RiskMetricsTracker) private metricsTracker: RiskMetricsTracker
    ) {
        console.log('[VetoGate] Initialized - All decisions must pass through this gate');
    }

    /**
     * Evaluate whether a decision should be allowed to execute
     * Returns a veto result with all check details
     */
    async evaluate(context: VetoContext): Promise<RiskVeto> {
        const { decision, orderBook, currentPrice } = context;
        const allChecks: RiskCheckResult[] = [];
        const failedChecks: string[] = [];

        // 1. Check kill switch first (highest priority)
        const killSwitchActive = this.killSwitch.isActive();
        if (killSwitchActive) {
            const killSwitchCheck: RiskCheckResult = {
                passed: false,
                checkName: 'KILL_SWITCH',
                reason: 'Kill switch is active - all trading halted',
                timestamp: Date.now()
            };
            allChecks.push(killSwitchCheck);
            failedChecks.push('KILL_SWITCH');
        }

        // 2. Check forbidden conditions
        const forbiddenCheck = this.forbiddenChecker.check(orderBook, currentPrice);
        if (!forbiddenCheck.canTrade) {
            const forbiddenResult: RiskCheckResult = {
                passed: false,
                checkName: 'FORBIDDEN_CONDITIONS',
                reason: `Forbidden conditions active: ${forbiddenCheck.activeConditions.join(', ')}`,
                timestamp: Date.now()
            };
            allChecks.push(forbiddenResult);
            failedChecks.push('FORBIDDEN_CONDITIONS');
        }

        // 3. Get current risk metrics
        const metrics = this.metricsTracker.getMetrics();

        // 4. Calculate spread in basis points
        const bestBid = orderBook.bids[0]?.price ?? 0;
        const bestAsk = orderBook.asks[0]?.price ?? 0;
        const midPrice = (bestBid + bestAsk) / 2;
        const spreadBps = midPrice > 0 ? ((bestAsk - bestBid) / midPrice) * 10000 : Infinity;

        // 5. Calculate available liquidity at top levels
        const bidLiquidity = orderBook.bids.slice(0, 5).reduce((sum, l) => sum + l.quantity, 0);
        const askLiquidity = orderBook.asks.slice(0, 5).reduce((sum, l) => sum + l.quantity, 0);
        const liquidityBTC = Math.min(bidLiquidity, askLiquidity);

        // 6. Estimate slippage based on order size and liquidity
        const estimatedSlippageBps = this.estimateSlippage(decision.size, orderBook, decision.action);

        // 7. Run all rulebook checks
        const rulebookChecks = this.rulebook.validateDecision(decision, {
            currentExposurePercent: metrics.currentExposurePercent,
            dailyLossPercent: Math.abs(metrics.dailyPnlPercent),
            drawdownPercent: metrics.currentDrawdown,
            spreadBps,
            expectedSlippageBps: estimatedSlippageBps,
            liquidityBTC,
            ordersLastMinute: metrics.ordersLastMinute,
            ordersLastHour: metrics.ordersLastHour,
            consecutiveLosses: metrics.consecutiveLosses,
            currentLeverage: 1 // TODO: Get from position manager
        });

        allChecks.push(...rulebookChecks);

        // Collect all failed checks
        for (const check of rulebookChecks) {
            if (!check.passed) {
                failedChecks.push(check.checkName);
            }
        }

        // 8. Additional sanity checks
        const sanityChecks = this.runSanityChecks(decision, currentPrice);
        allChecks.push(...sanityChecks);
        for (const check of sanityChecks) {
            if (!check.passed) {
                failedChecks.push(check.checkName);
            }
        }

        const vetoed = failedChecks.length > 0;

        const result: RiskVeto = {
            vetoed,
            decisionId: decision.requestId,
            checks: allChecks,
            failedChecks,
            timestamp: Date.now()
        };

        // Log the veto decision
        if (vetoed) {
            console.warn(`[VetoGate] VETOED decision ${decision.requestId}: ${failedChecks.join(', ')}`);
        } else {
            console.log(`[VetoGate] APPROVED decision ${decision.requestId}`);
        }

        return result;
    }

    /**
     * Estimate slippage based on order size and order book
     */
    private estimateSlippage(
        sizeBTC: number,
        orderBook: OrderBook,
        action: string
    ): number {
        if (sizeBTC <= 0) return 0;

        const levels = action === 'BUY' || action === 'CLOSE_SHORT'
            ? orderBook.asks
            : orderBook.bids;

        if (levels.length === 0) return Infinity;

        let remainingSize = sizeBTC;
        let totalCost = 0;
        const bestPrice = levels[0].price;

        for (const level of levels) {
            const fillQty = Math.min(remainingSize, level.quantity);
            totalCost += fillQty * level.price;
            remainingSize -= fillQty;
            if (remainingSize <= 0) break;
        }

        if (remainingSize > 0) {
            // Not enough liquidity - extreme slippage
            return 1000; // 10% in bps
        }

        const avgFillPrice = totalCost / sizeBTC;
        const slippageBps = Math.abs((avgFillPrice - bestPrice) / bestPrice) * 10000;

        return slippageBps;
    }

    /**
     * Run additional sanity checks on the decision
     */
    private runSanityChecks(
        decision: AIDecisionResponse,
        currentPrice: number
    ): RiskCheckResult[] {
        const checks: RiskCheckResult[] = [];

        // Check that limit price is reasonable (within 1% of current price)
        if (decision.orderType === 'LIMIT' && decision.limitPrice) {
            const deviation = Math.abs(decision.limitPrice - currentPrice) / currentPrice;
            const passed = deviation <= 0.01; // 1% max deviation
            checks.push({
                passed,
                checkName: 'LIMIT_PRICE_SANITY',
                reason: passed ? undefined : `Limit price ${decision.limitPrice} deviates ${(deviation * 100).toFixed(2)}% from current price ${currentPrice}`,
                value: decision.limitPrice,
                limit: currentPrice * 1.01,
                timestamp: Date.now()
            });
        }

        // Check that size is positive for entry actions
        if (['BUY', 'SELL'].includes(decision.action)) {
            const passed = decision.size > 0;
            checks.push({
                passed,
                checkName: 'SIZE_POSITIVE',
                reason: passed ? undefined : 'Entry action requires positive size',
                value: decision.size,
                timestamp: Date.now()
            });
        }

        // Check confidence is reasonable
        const confidenceOk = decision.confidence >= 0.3;
        checks.push({
            passed: confidenceOk,
            checkName: 'CONFIDENCE_THRESHOLD',
            reason: confidenceOk ? undefined : `AI confidence ${decision.confidence} below minimum 0.3`,
            value: decision.confidence,
            limit: 0.3,
            timestamp: Date.now()
        });

        return checks;
    }

    /**
     * Force approve a decision (for paper trading / testing only)
     */
    forceApprove(decisionId: string): RiskVeto {
        console.warn(`[VetoGate] FORCE APPROVED decision ${decisionId} (testing only)`);
        return {
            vetoed: false,
            decisionId,
            checks: [],
            failedChecks: [],
            timestamp: Date.now()
        };
    }
}
