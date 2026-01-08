# API Specifications
## Bitcoin Scalping Bot

### AI Decision API

The AI Decision API is the interface between the trading system and the AI model.

---

## Request Schema

```typescript
interface AIDecisionRequest {
  requestId: string;           // Unique request identifier
  timestamp: number;           // Unix timestamp (ms)
  
  // Feature vector
  features: {
    microstructure: {
      spreadBps: number;       // Bid-ask spread in basis points
      spreadZScore: number;    // Z-score of spread
      bookImbalance: number;   // -1 to 1 (negative = sell pressure)
      queuePressure: number;   // Net queue pressure
      tradeVelocity: number;   // Trades per second
      volumeImbalance: number; // -1 to 1
    };
    momentum: {
      rsi14: number;           // 0-100
      macdHistogram: number;   // MACD histogram value
      ema9: number;            // 9-period EMA
      ema21: number;           // 21-period EMA
      return5Bar: number;      // 5-bar return %
      return10Bar: number;     // 10-bar return %
      rsiDivergence: 'BULLISH' | 'BEARISH' | 'NONE';
    };
    meanReversion: {
      bbPosition: number;      // 0-1 position in Bollinger Bands
      bbWidth: number;         // Band width
      vwapDeviation: number;   // Deviation from VWAP %
      orderFlowImbalance: number;
    };
    volatility: {
      atr14: number;           // 14-period ATR
      atrPercent: number;      // ATR as % of price
      realizedVol: number;     // Realized volatility
      regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
    };
  };
  
  // Market state
  marketSnapshot: {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    timestamp: number;
  };
  
  // Current position
  hasPosition: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'FLAT';
  positionSize?: number;
  positionEntryPrice?: number;
  positionUnrealizedPnl?: number;
  
  // Context
  recentTradesCount: number;
  pendingNewsEvents: number;
  highImpactNewsInWindow: boolean;
  dailyPnlPercent: number;
  currentDrawdownPercent: number;
  consecutiveLosses: number;
}
```

---

## Response Schema

```typescript
interface AIDecisionResponse {
  requestId: string;           // Must match request
  timestamp: number;
  
  // Decision
  action: 'BUY' | 'SELL' | 'HOLD' | 'EXIT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  
  // Parameters (bounded by rulebook)
  size: number;                // Position size in BTC (max 0.5)
  holdTimeMs: number;          // Planned hold time (5000-300000)
  orderType: 'LIMIT' | 'MARKET';
  limitPrice?: number;
  
  // Risk levels
  stopLossPrice?: number;
  takeProfitPrice?: number;
  
  // Metadata
  confidence: number;          // 0-1
  rationale: string;           // Human-readable explanation
  
  // Optional parameter proposals
  parameterProposal?: {
    proposedChanges: Array<{
      parameter: string;
      currentValue: number;
      newValue: number;
      reason: string;
    }>;
    rationale: string;
  };
}
```

---

## Validation Rules

| Field | Constraint | Enforced By |
|-------|------------|-------------|
| `size` | ≤ 0.5 BTC | RulebookEngine |
| `holdTimeMs` | 5000-300000 | RulebookEngine |
| `confidence` | 0-1 | DecisionAPI |
| `action` | Valid enum | Zod schema |

---

## HTTP Endpoints

### POST /v1/decision
Request AI trading decision.

**Request Body**: `AIDecisionRequest`
**Response**: `AIDecisionResponse`
**Timeout**: 2000ms

---

## Dashboard API

### GET /api/status
Returns current trading engine status.

```json
{
  "isRunning": true,
  "sessionId": "uuid",
  "mode": "PAPER",
  "runtime": 3600000,
  "equity": 10523.45,
  "pnl": 523.45,
  "position": { ... },
  "metrics": { ... }
}
```

### GET /api/trades
Returns trade history with optional filtering.

**Query Parameters**:
- `limit` (number): Max trades to return
- `regime` (string): Filter by regime
- `blunder` (string): Filter by blunder label

### GET /api/trades/:id
Returns detailed trade information.

### GET /api/kill-switch
Returns kill switch status.

### POST /api/kill-switch
Activate or deactivate kill switch.

```json
{ "action": "activate", "reason": "Manual emergency stop" }
```
