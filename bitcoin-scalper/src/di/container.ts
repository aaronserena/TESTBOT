/**
 * Dependency Injection Container
 * Production-grade Bitcoin Scalping Bot
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';

// Risk
import { RulebookEngine, VetoGate, KillSwitch, ForbiddenConditionsChecker, RiskMetricsTracker } from '../risk/index.js';

// Data
import { WebSocketClient, OrderBookManager, TradeTapeProcessor, CandleAggregator } from '../data/index.js';

// Features
import { MicrostructureCalculator, MomentumCalculator, MeanReversionCalculator, VolatilityCalculator, FeatureEngine } from '../features/index.js';

// Strategy
import { BaseStrategy, SMCDetector } from '../strategy/index.js';

// AI
import { DecisionAPI, RegimeDetector } from '../ai/index.js';

// Portfolio
import { PositionSizer, FeeModel, BalanceManager } from '../portfolio/index.js';

// Execution
import { OrderManager, EmergencyShutdown } from '../execution/index.js';

// News
import { NewsAggregator } from '../news/index.js';

// Analysis
import { BlunderAnalyzer } from '../analysis/index.js';

// Logging
import { DecisionLogger } from '../logging/index.js';

export function createContainer(): Container {
    const container = new Container();

    // Risk Management (Singleton - CRITICAL)
    container.bind(TYPES.RulebookEngine).to(RulebookEngine).inSingletonScope();
    container.bind(TYPES.KillSwitch).to(KillSwitch).inSingletonScope();
    container.bind(TYPES.RiskMetricsTracker).to(RiskMetricsTracker).inSingletonScope();
    container.bind(TYPES.ForbiddenConditionsChecker).to(ForbiddenConditionsChecker).inSingletonScope();
    container.bind(TYPES.VetoGate).to(VetoGate).inSingletonScope();

    // Data Layer (Singleton)
    container.bind(TYPES.WebSocketClient).to(WebSocketClient).inSingletonScope();
    container.bind(TYPES.OrderBookManager).to(OrderBookManager).inSingletonScope();
    container.bind(TYPES.TradeTapeProcessor).to(TradeTapeProcessor).inSingletonScope();
    container.bind(TYPES.CandleAggregator).to(CandleAggregator).inSingletonScope();

    // Features (Singleton)
    container.bind(TYPES.MicrostructureCalculator).to(MicrostructureCalculator).inSingletonScope();
    container.bind(TYPES.MomentumCalculator).to(MomentumCalculator).inSingletonScope();
    container.bind(TYPES.MeanReversionCalculator).to(MeanReversionCalculator).inSingletonScope();
    container.bind(TYPES.VolatilityCalculator).to(VolatilityCalculator).inSingletonScope();
    container.bind(TYPES.FeatureEngine).to(FeatureEngine).inSingletonScope();

    // Strategy (Singleton)
    container.bind(TYPES.BaseStrategy).to(BaseStrategy).inSingletonScope();
    container.bind(TYPES.SMCDetector).to(SMCDetector).inSingletonScope();

    // AI (Singleton)
    container.bind(TYPES.DecisionAPI).to(DecisionAPI).inSingletonScope();
    container.bind(TYPES.RegimeDetector).to(RegimeDetector).inSingletonScope();

    // Portfolio (Singleton)
    container.bind(TYPES.PositionSizer).to(PositionSizer).inSingletonScope();
    container.bind(TYPES.FeeModel).to(FeeModel).inSingletonScope();
    container.bind(TYPES.BalanceManager).to(BalanceManager).inSingletonScope();

    // Execution (Singleton)
    container.bind(TYPES.OrderManager).to(OrderManager).inSingletonScope();
    container.bind(TYPES.EmergencyShutdown).to(EmergencyShutdown).inSingletonScope();

    // News (Singleton)
    container.bind(TYPES.NewsAggregator).to(NewsAggregator).inSingletonScope();

    // Analysis (Singleton)
    container.bind(TYPES.BlunderAnalyzer).to(BlunderAnalyzer).inSingletonScope();

    // Logging (Singleton)
    container.bind(TYPES.DecisionLogger).to(DecisionLogger).inSingletonScope();

    return container;
}

export { TYPES } from './types.js';
