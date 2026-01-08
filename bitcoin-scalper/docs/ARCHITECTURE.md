# Architecture Documentation
## Bitcoin Scalping Bot - Production System

### System Overview

This document describes the architecture of a production-grade, Bitcoin-only scalping trading bot with AI-driven decision-making and absolute risk controls.

---

## Core Principles

1. **Risk-First Architecture**: Risk module has absolute veto power over all trades
2. **AI as Advisor**: AI recommends, but risk rules are non-negotiable
3. **Full Audit Trail**: Every decision logged with complete context
4. **Paper Trading First**: Live mode requires explicit configuration
5. **Bounded Autonomy**: AI operates within predefined parameter bounds

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRADING ENGINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   Data   │───▶│ Features │───▶│ Strategy │───▶│    AI    │  │
│  │  Layer   │    │  Engine  │    │   Base   │    │ Decision │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                        │        │
│                                                        ▼        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   News   │───▶│  Regime  │───▶│  VETO    │◀───│ Rulebook │  │
│  │Aggregator│    │ Detector │    │  GATE    │    │  Engine  │  │
│  └──────────┘    └──────────┘    └────┬─────┘    └──────────┘  │
│                                        │                        │
│                                        ▼                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Balance  │◀───│ Order    │◀───│Execution │    │  Kill    │  │
│  │ Manager  │    │ Manager  │    │  Engine  │    │  Switch  │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      ANALYSIS & LOGGING                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                   │
│  │ Decision │    │ Blunder  │    │  Trade   │                   │
│  │  Logger  │    │ Analyzer │    │  Store   │                   │
│  └──────────┘    └──────────┘    └──────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Descriptions

### Data Layer
- **WebSocketClient**: Low-latency connection to Binance Futures
- **OrderBookManager**: L2 order book with imbalance calculation
- **TradeTapeProcessor**: Trade stream with VWAP, velocity
- **CandleAggregator**: Multi-timeframe OHLCV

### Feature Engineering
- **MicrostructureCalculator**: Spread, imbalance, queue pressure
- **MomentumCalculator**: RSI, MACD, EMA, returns
- **MeanReversionCalculator**: Bollinger Bands, VWAP
- **VolatilityCalculator**: ATR, regime classification
- **VolumeProfileCalculator**: POC, Value Area, HVN/LVN

### Strategy
- **BaseStrategy**: Entry/exit logic, SLTP
- **SMCDetector**: BOS, CHoCH, FVG, Order Blocks

### AI Layer
- **DecisionAPI**: Schema-validated AI interface
- **RegimeDetector**: Market state classification
- **ParameterManager**: Version-controlled parameters
- **WalkForwardTester**: OOS validation

### Risk Management
- **RulebookEngine**: Immutable hard limits
- **VetoGate**: Final decision authority
- **KillSwitch**: Emergency stop
- **ForbiddenConditionsChecker**: Market condition guards
- **RiskMetricsTracker**: Real-time metrics

### Execution
- **OrderManager**: Order lifecycle, paper trading
- **OrderRetryManager**: Cancel-replace logic
- **EmergencyShutdown**: Graceful halt

---

## Data Flow

1. **Market Data** arrives via WebSocket
2. **Feature Engine** calculates all features
3. **Base Strategy** generates initial signal
4. **AI Decision API** requests recommendation
5. **Veto Gate** validates against all risk rules
6. **Order Manager** executes if approved
7. **Decision Logger** records full context
8. **Blunder Analyzer** labels trade quality

---

## Risk Hierarchy

```
Level 1: KILL SWITCH
         │
         ▼
Level 2: FORBIDDEN CONDITIONS
         │
         ▼
Level 3: RULEBOOK CHECKS
         │
         ▼
Level 4: SANITY CHECKS
         │
         ▼
Level 5: AI DECISION
```

Each level has **absolute veto power** over the levels below.

---

## Hard Limits (Non-Negotiable)

| Parameter | Limit | Rationale |
|-----------|-------|-----------|
| Max Position | 0.5 BTC | Capital preservation |
| Max Daily Loss | 2% | Prevent ruin |
| Max Drawdown | 5% | Protect equity |
| Max Spread | 10 bps | Avoid illiquid markets |
| Min Hold Time | 5 sec | Prevent flickering |
| Max Hold Time | 5 min | Scalping focus |
| Max Consecutive Losses | 5 | Detect adverse conditions |
| Max Leverage | 3x | Controlled risk |

---

## Deployment Modes

### Paper Trading (Default)
- Simulated fills
- No real orders
- Full logging

### Live Trading (Explicit)
- Real exchange orders
- Requires `NODE_ENV=live`
- 10-second startup delay

---

## Dashboard

Next.js application at `/dashboard/` providing:
- Real-time equity curve
- P&L tracking
- Trade history with filtering
- Blunder analysis visualization
- Kill switch controls
- Latency monitoring
