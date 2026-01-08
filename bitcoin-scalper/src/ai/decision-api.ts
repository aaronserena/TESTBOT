/**
 * AI Decision API - Schema-Validated AI Interface
 * Production-grade Bitcoin Scalping Bot
 * 
 * Communicates with the AI model using strictly validated JSON schemas.
 * All inputs and outputs are validated with Zod.
 */

import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import type {
    AIDecisionRequest,
    AIDecisionResponse,
    FeatureVector,
    MarketSnapshot
} from '../types/decision.js';
import {
    AIDecisionRequestSchema,
    AIDecisionResponseSchema
} from '../types/decision.js';
import type { Position } from '../types/core.js';
import type { RiskMetrics } from '../types/risk.js';
import { RulebookEngine } from '../risk/rulebook.js';
import { TYPES } from '../di/types.js';

export interface AIDecisionAPIConfig {
    endpoint: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
}

const DEFAULT_CONFIG: AIDecisionAPIConfig = {
    endpoint: process.env.AI_API_ENDPOINT || 'http://localhost:8080/v1/chat/completions',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-oss-120b',
    timeoutMs: 5000,
    maxRetries: 2
};

@injectable()
export class DecisionAPI {
    private config: AIDecisionAPIConfig;
    private lastDecision: AIDecisionResponse | null = null;
    private decisionCount: number = 0;
    private avgLatencyMs: number = 0;

    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine,
        config?: Partial<AIDecisionAPIConfig>
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[DecisionAPI] Initialized with model:', this.config.model);
    }

    /**
     * Request a trading decision from the AI
     */
    async requestDecision(
        features: FeatureVector,
        marketSnapshot: MarketSnapshot,
        position: Position | null,
        riskMetrics: RiskMetrics,
        newsContext: { pending: number; highImpact: boolean }
    ): Promise<AIDecisionResponse> {
        const requestId = uuidv4();
        const startTime = Date.now();

        // Build request
        const request: AIDecisionRequest = {
            requestId,
            timestamp: startTime,
            features,
            marketSnapshot,
            hasPosition: position !== null && position.side !== 'FLAT',
            positionSide: position?.side,
            positionSize: position?.quantity,
            positionEntryPrice: position?.entryPrice,
            positionUnrealizedPnl: position?.unrealizedPnl,
            positionHoldTimeMs: position?.openedAt ? startTime - position.openedAt : undefined,
            recentTradesCount: riskMetrics.dailyTrades,
            recentWinRate: riskMetrics.dailyTrades > 0
                ? riskMetrics.dailyWins / riskMetrics.dailyTrades
                : undefined,
            pendingNewsEvents: newsContext.pending,
            highImpactNewsInWindow: newsContext.highImpact,
            dailyPnlPercent: riskMetrics.dailyPnlPercent,
            currentDrawdownPercent: riskMetrics.currentDrawdown,
            consecutiveLosses: riskMetrics.consecutiveLosses
        };

        // Validate request
        AIDecisionRequestSchema.parse(request);

        try {
            const response = await this.callAI(request);

            // Bound hold time to rulebook limits
            const rules = this.rulebook.getRulebook();
            response.holdTimeMs = Math.max(
                rules.minHoldTimeMs,
                Math.min(rules.maxHoldTimeMs, response.holdTimeMs)
            );

            // Bound size to rulebook limits
            response.size = Math.min(rules.maxPositionSizeBTC, response.size);

            // Update metrics
            const latency = Date.now() - startTime;
            this.decisionCount++;
            this.avgLatencyMs = (this.avgLatencyMs * (this.decisionCount - 1) + latency) / this.decisionCount;
            this.lastDecision = response;

            console.log(`[DecisionAPI] Decision: ${response.action} | Size: ${response.size} | Confidence: ${response.confidence.toFixed(2)} | Latency: ${latency}ms`);

            return response;
        } catch (error) {
            console.error('[DecisionAPI] Error:', error);
            // Return safe HOLD decision on error
            return this.createSafeHoldDecision(requestId);
        }
    }

    /**
     * Call the AI API
     */
    private async callAI(request: AIDecisionRequest): Promise<AIDecisionResponse> {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(request);

        const payload = {
            model: this.config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: 'json_object' }
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await axios.post(this.config.endpoint, payload, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.config.timeoutMs
                });

                const content = response.data.choices[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty response from AI');
                }

                const parsed = JSON.parse(content);
                const validated = AIDecisionResponseSchema.parse({
                    requestId: request.requestId,
                    ...parsed,
                    timestamp: Date.now()
                });

                return validated;
            } catch (error) {
                lastError = error as Error;
                console.warn(`[DecisionAPI] Attempt ${attempt + 1} failed:`, lastError.message);
                if (attempt < this.config.maxRetries) {
                    await this.sleep(100 * Math.pow(2, attempt));
                }
            }
        }

        throw lastError || new Error('All retries failed');
    }

    /**
     * Build system prompt for the AI
     */
    private buildSystemPrompt(): string {
        const rules = this.rulebook.getRulebook();

        return `You are the Chief Trader AI for a Bitcoin scalping bot. Your role is to make trading decisions within strict risk constraints.

ROLE:
- Analyze market microstructure, momentum, and mean-reversion signals
- Decide whether to BUY, SELL, HOLD, or EXIT positions
- Set adaptive hold times based on market conditions
- Provide clear rationale for every decision

HARD CONSTRAINTS (NON-NEGOTIABLE):
- Max position size: ${rules.maxPositionSizeBTC} BTC
- Hold time must be between ${rules.minHoldTimeMs}ms and ${rules.maxHoldTimeMs}ms
- Never trade when spread > ${rules.maxSpreadBps} bps
- Stop after ${rules.maxConsecutiveLosses} consecutive losses

RESPONSE FORMAT (JSON):
{
  "action": "BUY" | "SELL" | "HOLD" | "EXIT",
  "size": number (0 to ${rules.maxPositionSizeBTC}),
  "orderType": "LIMIT" | "MARKET" | "POST_ONLY",
  "limitPrice": number (optional),
  "holdTimeMs": number (${rules.minHoldTimeMs} to ${rules.maxHoldTimeMs}),
  "suggestedTpPercent": number (optional),
  "suggestedSlPercent": number (optional),
  "confidence": number (0 to 1),
  "rationale": string (max 200 chars),
  "detectedRegime": "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "VOLATILE" | "UNKNOWN"
}

Be conservative. When in doubt, HOLD. Capital preservation is the priority.`;
    }

    /**
     * Build user prompt with current market state
     */
    private buildUserPrompt(request: AIDecisionRequest): string {
        const f = request.features;
        const m = request.marketSnapshot;

        return `MARKET STATE at ${new Date(request.timestamp).toISOString()}:

PRICE: ${m.price.toFixed(2)} | Bid: ${m.bid.toFixed(2)} | Ask: ${m.ask.toFixed(2)}

MICROSTRUCTURE:
- Spread: ${f.microstructure.spreadBps.toFixed(1)} bps (z-score: ${f.microstructure.spreadZScore.toFixed(2)})
- Book Imbalance: ${(f.microstructure.bookImbalance * 100).toFixed(1)}%
- Trade Velocity: ${f.microstructure.tradeVelocity.toFixed(2)}/s
- Volume Imbalance: ${(f.microstructure.volumeImbalance * 100).toFixed(1)}%

MOMENTUM:
- RSI(14): ${f.momentum.rsi14.toFixed(1)} | RSI(5): ${f.momentum.rsi5.toFixed(1)}
- MACD Histogram: ${f.momentum.macdHistogram.toFixed(4)}
- Price vs EMA20: ${f.momentum.priceVsEma20.toFixed(2)}%
- Returns: 5-bar=${f.momentum.return5Bar.toFixed(2)}%, 10-bar=${f.momentum.return10Bar.toFixed(2)}%

MEAN REVERSION:
- BB Position: ${(f.meanReversion.bbPosition * 100).toFixed(1)}%
- Price vs VWAP: ${f.meanReversion.priceVsVwap.toFixed(2)}%
- Order Flow Imbalance: ${(f.meanReversion.orderFlowImbalance * 100).toFixed(1)}%

VOLATILITY:
- ATR: ${f.volatility.atrPercent.toFixed(3)}%
- Realized Vol (1h): ${f.volatility.realizedVol1h.toFixed(2)}%
- Regime: ${f.volatility.volRegime}

POSITION:
${request.hasPosition
                ? `- Side: ${request.positionSide} | Size: ${request.positionSize} BTC | Entry: ${request.positionEntryPrice}
- Unrealized P&L: ${request.positionUnrealizedPnl?.toFixed(2)} | Hold Time: ${request.positionHoldTimeMs}ms`
                : '- No current position'}

RISK STATE:
- Daily P&L: ${request.dailyPnlPercent.toFixed(2)}%
- Drawdown: ${request.currentDrawdownPercent.toFixed(2)}%
- Consecutive Losses: ${request.consecutiveLosses}
- High Impact News: ${request.highImpactNewsInWindow ? 'YES' : 'NO'}

What is your trading decision?`;
    }

    /**
     * Create safe HOLD decision for error cases
     */
    private createSafeHoldDecision(requestId: string): AIDecisionResponse {
        const rules = this.rulebook.getRulebook();
        return {
            requestId,
            action: 'HOLD',
            size: 0,
            orderType: 'LIMIT',
            holdTimeMs: rules.minHoldTimeMs,
            confidence: 0,
            rationale: 'Error occurred - defaulting to safe HOLD',
            timestamp: Date.now()
        };
    }

    /**
     * Get decision statistics
     */
    getStats(): { count: number; avgLatencyMs: number } {
        return {
            count: this.decisionCount,
            avgLatencyMs: Math.round(this.avgLatencyMs)
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
