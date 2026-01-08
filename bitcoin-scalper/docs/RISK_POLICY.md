# Risk Policy Document
## Bitcoin Scalping Bot

### Purpose

This document defines the non-negotiable risk controls that govern all trading activity.

---

## Core Principle

> **Risk modules have ABSOLUTE VETO POWER over all trading decisions.**

No AI recommendation, strategy signal, or manual override can bypass these limits.

---

## Hard Limits

### Position Size
| Parameter | Limit | Enforcement |
|-----------|-------|-------------|
| Max Position | 0.5 BTC | RulebookEngine |
| Max Exposure | 5% of equity | RulebookEngine |

### Loss Limits
| Parameter | Limit | Enforcement |
|-----------|-------|-------------|
| Max Daily Loss | 2% of equity | RiskMetricsTracker |
| Max Drawdown | 5% of peak equity | RiskMetricsTracker |
| Max Consecutive Losses | 5 trades | RiskMetricsTracker |

### Timing Limits
| Parameter | Limit | Enforcement |
|-----------|-------|-------------|
| Min Hold Time | 5 seconds | RulebookEngine |
| Max Hold Time | 5 minutes | RulebookEngine |
| Max Orders/Minute | 10 | RiskMetricsTracker |

### Market Quality
| Parameter | Limit | Enforcement |
|-----------|-------|-------------|
| Max Spread | 10 bps | ForbiddenConditionsChecker |
| Max Slippage | 5 bps | ForbiddenConditionsChecker |
| Min Order Book Depth | 25 BTC | ForbiddenConditionsChecker |

### Leverage
| Parameter | Limit | Enforcement |
|-----------|-------|-------------|
| Max Leverage | 3x | RulebookEngine |

---

## Kill Switch

### Triggers
- **Manual**: Human operator activation
- **Auto (Loss)**: Daily loss limit reached
- **Auto (Drawdown)**: Max drawdown exceeded
- **Auto (Streak)**: Max consecutive losses
- **Auto (Error)**: Critical system error

### Behavior
When activated:
1. Cancel all open orders immediately
2. Close all positions (if safe)
3. Lock trading for cooldown period (1 hour default)
4. Alert operators

### Reactivation
- Only possible after cooldown expires
- Requires manual confirmation

---

## Veto Gate Process

```
  AI Decision
       │
       ▼
  ┌─────────────────┐
  │  Kill Switch?   │──── Active ───▶ VETO
  └────────┬────────┘
           │ Not Active
           ▼
  ┌─────────────────┐
  │ Forbidden       │
  │ Conditions?     │──── Yes ─────▶ VETO
  └────────┬────────┘
           │ No
           ▼
  ┌─────────────────┐
  │ Rulebook        │
  │ Checks Pass?    │──── No ──────▶ VETO
  └────────┬────────┘
           │ Yes
           ▼
  ┌─────────────────┐
  │ Sanity Check    │
  │ (Size, Price)?  │──── Fail ────▶ VETO
  └────────┬────────┘
           │ Pass
           ▼
      APPROVED
```

---

## Audit Trail

Every decision is logged with:
- Full feature vector at decision time
- AI request and response
- All risk check results
- Execution details
- Trade outcome
- Blunder classification

Logs are retained for 90 days minimum.

---

## Emergency Procedures

### Daily Loss Limit Breach
1. Kill switch activates automatically
2. All positions closed at market
3. No trading for remainder of day
4. Alert sent to operators

### System Error
1. Kill switch activates
2. Attempt graceful order cancellation
3. Position closure if possible
4. Full diagnostic logging

### Exchange Connectivity Loss
1. Reconnection attempts with backoff
2. After 60s: Emergency position evaluation
3. After 120s: Kill switch activation

---

## Modifications

Changes to risk limits require:
1. Written justification
2. Backtesting on 6+ months of data
3. Walk-forward validation
4. Human approval
5. Version-controlled deployment

**Emergency limit increases are NOT permitted.**
