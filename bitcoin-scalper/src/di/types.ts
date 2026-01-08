/**
 * Dependency Injection Types
 * Production-grade Bitcoin Scalping Bot
 */

export const TYPES = {
    // Risk Management
    RulebookEngine: Symbol.for('RulebookEngine'),
    VetoGate: Symbol.for('VetoGate'),
    KillSwitch: Symbol.for('KillSwitch'),
    ForbiddenConditionsChecker: Symbol.for('ForbiddenConditionsChecker'),
    RiskMetricsTracker: Symbol.for('RiskMetricsTracker'),

    // Data Layer
    WebSocketClient: Symbol.for('WebSocketClient'),
    OrderBookManager: Symbol.for('OrderBookManager'),
    TradeTapeProcessor: Symbol.for('TradeTapeProcessor'),
    CandleAggregator: Symbol.for('CandleAggregator'),

    // Features
    MicrostructureCalculator: Symbol.for('MicrostructureCalculator'),
    MomentumCalculator: Symbol.for('MomentumCalculator'),
    MeanReversionCalculator: Symbol.for('MeanReversionCalculator'),
    VolatilityCalculator: Symbol.for('VolatilityCalculator'),
    FeatureEngine: Symbol.for('FeatureEngine'),

    // Strategy
    BaseStrategy: Symbol.for('BaseStrategy'),
    SMCDetector: Symbol.for('SMCDetector'),
    SignalGenerator: Symbol.for('SignalGenerator'),

    // AI Layer
    DecisionAPI: Symbol.for('DecisionAPI'),
    RegimeDetector: Symbol.for('RegimeDetector'),
    WalkForwardTester: Symbol.for('WalkForwardTester'),

    // Portfolio
    BalanceManager: Symbol.for('BalanceManager'),
    PositionSizer: Symbol.for('PositionSizer'),
    FeeModel: Symbol.for('FeeModel'),

    // Execution
    OrderManager: Symbol.for('OrderManager'),
    OrderStateMachine: Symbol.for('OrderStateMachine'),
    PaperTradingEngine: Symbol.for('PaperTradingEngine'),
    EmergencyShutdown: Symbol.for('EmergencyShutdown'),

    // News
    NewsAggregator: Symbol.for('NewsAggregator'),
    SentimentAnalyzer: Symbol.for('SentimentAnalyzer'),

    // Analysis
    BlunderAnalyzer: Symbol.for('BlunderAnalyzer'),

    // Logging
    DecisionLogger: Symbol.for('DecisionLogger'),
    TradeHistoryLogger: Symbol.for('TradeHistoryLogger'),

    // Core
    TradingEngine: Symbol.for('TradingEngine'),
    Config: Symbol.for('Config'),
    Database: Symbol.for('Database')
};
