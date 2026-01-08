/**
 * Trading Engine - Core Bot Orchestration
 * Production-grade Bitcoin Scalping Bot
 * 
 * Main engine that ties all components together.
 */

import { injectable, inject, Container } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Types
import type { Position } from './types/core.js';
import type { MarketSnapshot } from './types/decision.js';
import { createEmptyPosition } from './types/core.js';
import { TYPES } from './di/types.js';

// Components
import { WebSocketClient } from './data/websocket-client.js';
import { OrderBookManager } from './data/orderbook.js';
import { TradeTapeProcessor } from './data/trade-tape.js';
import { CandleAggregator } from './data/candle-aggregator.js';
import { FeatureEngine } from './features/feature-engine.js';
import { BaseStrategy } from './strategy/base-strategy.js';
import { SMCDetector } from './strategy/smc-detector.js';
import { DecisionAPI } from './ai/decision-api.js';
import { RegimeDetector } from './ai/regime-detector.js';
import { RulebookEngine } from './risk/rulebook.js';
import { VetoGate } from './risk/veto-gate.js';
import { KillSwitch } from './risk/kill-switch.js';
import { RiskMetricsTracker } from './risk/metrics-tracker.js';
import { BalanceManager } from './portfolio/balance-manager.js';
import { PositionSizer } from './portfolio/position-sizer.js';
import { FeeModel } from './portfolio/fee-model.js';
import { OrderManager } from './execution/order-manager.js';
import { EmergencyShutdown } from './execution/emergency-shutdown.js';
import { NewsAggregator } from './news/aggregator.js';
import { BlunderAnalyzer } from './analysis/blunder-analyzer.js';
import { DecisionLogger } from './logging/decision-logger.js';

export interface TradingEngineConfig {
    mode: 'PAPER' | 'LIVE';
    startingEquity: number;
    decisionIntervalMs: number;
}

const DEFAULT_CONFIG: TradingEngineConfig = {
    mode: 'PAPER',
    startingEquity: 10000,
    decisionIntervalMs: 1000
};

@injectable()
export class TradingEngine extends EventEmitter {
    private config: TradingEngineConfig;
    private isRunning: boolean = false;
    private decisionLoop: NodeJS.Timeout | null = null;
    private sessionId: string;
    private startedAt: number = 0;

    constructor(
        @inject(TYPES.WebSocketClient) private wsClient: WebSocketClient,
        @inject(TYPES.OrderBookManager) private orderBook: OrderBookManager,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor,
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.FeatureEngine) private features: FeatureEngine,
        @inject(TYPES.BaseStrategy) private strategy: BaseStrategy,
        @inject(TYPES.SMCDetector) private smcDetector: SMCDetector,
        @inject(TYPES.DecisionAPI) private decisionAPI: DecisionAPI,
        @inject(TYPES.RegimeDetector) private regimeDetector: RegimeDetector,
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine,
        @inject(TYPES.VetoGate) private vetoGate: VetoGate,
        @inject(TYPES.KillSwitch) private killSwitch: KillSwitch,
        @inject(TYPES.RiskMetricsTracker) private riskMetrics: RiskMetricsTracker,
        @inject(TYPES.BalanceManager) private balanceManager: BalanceManager,
        @inject(TYPES.PositionSizer) private positionSizer: PositionSizer,
        @inject(TYPES.FeeModel) private feeModel: FeeModel,
        @inject(TYPES.OrderManager) private orderManager: OrderManager,
        @inject(TYPES.EmergencyShutdown) private emergencyShutdown: EmergencyShutdown,
        @inject(TYPES.NewsAggregator) private newsAggregator: NewsAggregator,
        @inject(TYPES.BlunderAnalyzer) private blunderAnalyzer: BlunderAnalyzer,
        @inject(TYPES.DecisionLogger) private decisionLogger: DecisionLogger
    ) {
        super();
        this.config = DEFAULT_CONFIG;
        this.sessionId = uuidv4();
        console.log('[TradingEngine] Initialized');
    }

    /**
     * Configure the trading engine
     */
    configure(config: Partial<TradingEngineConfig>): void {
        this.config = { ...this.config, ...config };
        console.log('[TradingEngine] Configured:', this.config);
    }

    /**
     * Start the trading engine
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.warn('[TradingEngine] Already running');
            return;
        }

        console.log('━'.repeat(60));
        console.log('[TRADING ENGINE STARTING]');
        console.log(`Mode: ${this.config.mode}`);
        console.log(`Session: ${this.sessionId}`);
        console.log(`Starting Equity: $${this.config.startingEquity}`);
        console.log('━'.repeat(60));

        // Initialize components
        this.balanceManager.initialize(this.config.startingEquity);
        this.positionSizer.setAccountEquity(this.config.startingEquity);
        this.riskMetrics.initialize(this.config.startingEquity);
        this.orderManager.setMode(this.config.mode === 'PAPER');

        // Connect to market data
        console.log('[TradingEngine] Connecting to market data...');
        await this.wsClient.connectAll();

        // Wait for initial data
        console.log('[TradingEngine] Waiting for order book initialization...');
        await this.waitForOrderBook();

        // Start news aggregator
        this.newsAggregator.start();

        // Start decision loop
        this.isRunning = true;
        this.startedAt = Date.now();
        this.startDecisionLoop();

        this.emit('started', {
            sessionId: this.sessionId,
            mode: this.config.mode,
            timestamp: this.startedAt
        });

        console.log('[TradingEngine] Running');
    }

    /**
     * Stop the trading engine
     */
    async stop(): Promise<void> {
        if (!this.isRunning) return;

        console.log('[TradingEngine] Stopping...');

        // Stop decision loop
        if (this.decisionLoop) {
            clearInterval(this.decisionLoop);
            this.decisionLoop = null;
        }

        // Stop news aggregator
        this.newsAggregator.stop();

        // Close all positions and orders
        await this.orderManager.cancelAllOrders();

        // Disconnect from market data
        this.wsClient.disconnectAll();

        this.isRunning = false;

        const runtime = Date.now() - this.startedAt;
        const finalPnl = this.balanceManager.getTotalPnl();

        console.log('━'.repeat(60));
        console.log('[TRADING ENGINE STOPPED]');
        console.log(`Runtime: ${(runtime / 1000 / 60).toFixed(1)} minutes`);
        console.log(`Final P&L: $${finalPnl.toFixed(2)}`);
        console.log('━'.repeat(60));

        this.emit('stopped', {
            sessionId: this.sessionId,
            runtime,
            finalPnl,
            timestamp: Date.now()
        });
    }

    /**
     * Start the decision loop
     */
    private startDecisionLoop(): void {
        this.decisionLoop = setInterval(async () => {
            try {
                await this.runDecisionCycle();
            } catch (error) {
                console.error('[TradingEngine] Decision cycle error:', error);
                this.killSwitch.triggerOnError(error as Error);
            }
        }, this.config.decisionIntervalMs);
    }

    /**
     * Run a single decision cycle
     */
    private async runDecisionCycle(): Promise<void> {
        // Check kill switch
        if (this.killSwitch.isActive()) {
            return;
        }

        // Check if order book is ready
        if (!this.orderBook.isReady()) {
            return;
        }

        // Update SMC patterns
        this.smcDetector.update();

        // Get current state
        const position = this.balanceManager.getPosition();
        const features = this.features.calculate();
        const marketSnapshot = this.createMarketSnapshot();
        const riskMetrics = this.riskMetrics.getMetrics();
        const newsAssessment = this.newsAggregator.getImpactAssessment();

        // Check news restrictions
        if (newsAssessment.shouldAvoidTrading) {
            return;
        }

        // Request AI decision
        const decision = await this.decisionAPI.requestDecision(
            features,
            marketSnapshot,
            position,
            riskMetrics,
            { pending: newsAssessment.relevantEvents.length, highImpact: newsAssessment.hasHighImpactNews }
        );

        // Veto check
        const veto = await this.vetoGate.evaluate({
            decision,
            orderBook: this.orderBook.getOrderBook(),
            currentPrice: this.tradeTape.getLastPrice()
        });

        // Log decision
        const logId = this.decisionLogger.log(
            {
                requestId: decision.requestId,
                timestamp: Date.now(),
                features,
                marketSnapshot,
                hasPosition: position.side !== 'FLAT',
                positionSide: position.side,
                positionSize: position.quantity,
                positionEntryPrice: position.entryPrice,
                positionUnrealizedPnl: position.unrealizedPnl,
                recentTradesCount: riskMetrics.dailyTrades,
                pendingNewsEvents: newsAssessment.relevantEvents.length,
                highImpactNewsInWindow: newsAssessment.hasHighImpactNews,
                dailyPnlPercent: riskMetrics.dailyPnlPercent,
                currentDrawdownPercent: riskMetrics.currentDrawdown,
                consecutiveLosses: riskMetrics.consecutiveLosses
            },
            decision,
            veto,
            !veto.vetoed && decision.action !== 'HOLD'
        );

        // Execute if not vetoed
        if (!veto.vetoed && decision.action !== 'HOLD') {
            await this.executeDecision(decision, position, logId);
        }
    }

    /**
     * Execute a trading decision
     */
    private async executeDecision(
        decision: ReturnType<DecisionAPI['requestDecision']> extends Promise<infer T> ? T : never,
        position: Position,
        logId: string
    ): Promise<void> {
        const currentPrice = this.tradeTape.getLastPrice();

        if (decision.action === 'BUY' || decision.action === 'SELL') {
            // Entry order
            const side = decision.action;
            const sizing = this.positionSizer.calculateRecommended(currentPrice);
            const size = Math.min(decision.size, sizing.sizeBTC);

            if (size > 0) {
                const order = await this.orderManager.submitOrder({
                    side,
                    type: decision.orderType,
                    quantity: size,
                    price: decision.limitPrice,
                    decisionId: decision.requestId
                });

                // Open position on fill (simplified - in production, listen for fill events)
                if (order.status === 'FILLED' && order.avgFillPrice) {
                    const fee = this.feeModel.calculateFee(order.avgFillPrice * size, false);
                    this.balanceManager.openPosition(
                        side === 'BUY' ? 'LONG' : 'SHORT',
                        size,
                        order.avgFillPrice,
                        fee
                    );
                    this.riskMetrics.recordOrderPlaced();
                }
            }
        } else if (decision.action === 'EXIT' || decision.action === 'CLOSE_LONG' || decision.action === 'CLOSE_SHORT') {
            // Exit order
            if (position.side !== 'FLAT') {
                const side = position.side === 'LONG' ? 'SELL' : 'BUY';
                const order = await this.orderManager.submitOrder({
                    side,
                    type: 'MARKET',
                    quantity: position.quantity,
                    decisionId: decision.requestId
                });

                if (order.status === 'FILLED' && order.avgFillPrice) {
                    const fee = this.feeModel.calculateFee(order.avgFillPrice * position.quantity, false);
                    const { pnl, netPnl } = this.balanceManager.closePosition(order.avgFillPrice, fee);
                    this.riskMetrics.recordTradeClose(netPnl, this.balanceManager.getBalance().totalEquity);
                }
            }
        }
    }

    /**
     * Create market snapshot for AI
     */
    private createMarketSnapshot(): MarketSnapshot {
        return {
            symbol: 'BTCUSDT',
            price: this.tradeTape.getLastPrice(),
            bid: this.orderBook.getBestBid(),
            ask: this.orderBook.getBestAsk(),
            volume24h: 0, // Would come from exchange API
            high24h: this.tradeTape.getLastPrice() * 1.02, // Placeholder
            low24h: this.tradeTape.getLastPrice() * 0.98,  // Placeholder
            timestamp: Date.now()
        };
    }

    /**
     * Wait for order book to be ready
     */
    private async waitForOrderBook(timeoutMs: number = 30000): Promise<void> {
        const startTime = Date.now();
        while (!this.orderBook.isReady()) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error('Order book initialization timeout');
            }
            await this.sleep(100);
        }
    }

    /**
     * Get current status
     */
    getStatus(): {
        isRunning: boolean;
        sessionId: string;
        mode: string;
        runtime: number;
        equity: number;
        pnl: number;
        position: Position;
    } {
        return {
            isRunning: this.isRunning,
            sessionId: this.sessionId,
            mode: this.config.mode,
            runtime: this.isRunning ? Date.now() - this.startedAt : 0,
            equity: this.balanceManager.getBalance().totalEquity,
            pnl: this.balanceManager.getTotalPnl(),
            position: this.balanceManager.getPosition()
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
