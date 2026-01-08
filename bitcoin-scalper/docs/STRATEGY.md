# Trading Strategy Documentation
## Bitcoin Scalping Bot

### Overview

This document describes the deterministic trading strategy and AI decision framework.

---

## Strategy Philosophy

1. **Scalping Focus**: Short-term trades (5s - 5min hold time)
2. **Bitcoin Only**: Single instrument focus
3. **Risk-First**: Never violate hard limits
4. **AI-Assisted**: AI recommends, rules enforce

---

## Entry Conditions

### Long Entry
All conditions must be met:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| RSI | < 35 | Oversold |
| Book Imbalance | > 0.25 | Bid pressure |
| Spread | < 10 bps | Sufficient liquidity |
| Volume Imbalance | > 0.2 | Buying pressure |
| Volatility Regime | Not EXTREME | Manageable risk |

### Short Entry
All conditions must be met:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| RSI | > 65 | Overbought |
| Book Imbalance | < -0.25 | Ask pressure |
| Spread | < 10 bps | Sufficient liquidity |
| Volume Imbalance | < -0.2 | Selling pressure |
| Volatility Regime | Not EXTREME | Manageable risk |

---

## Exit Conditions

### Take Profit
- ATR-based: Entry ± (ATR × 2.5)
- Dynamic adjustment based on momentum

### Stop Loss
- ATR-based: Entry ∓ (ATR × 1.5)
- Never moved against position

### Emergency Exit
Triggered when:
- Spread > 15 bps (sudden illiquidity)
- Position held > max hold time
- Kill switch activated
- Daily loss limit approached

---

## Smart Money Concepts (SMC)

### Break of Structure (BOS)
```
Higher High → BOS Bullish
Lower Low → BOS Bearish
```

### Change of Character (CHoCH)
```
Trend reversal confirmation
Requires structure break + momentum shift
```

### Fair Value Gaps (FVG)
- Unfilled price gaps
- Potential support/resistance

### Order Blocks
- Institutional entry zones
- High-volume reversal candles

---

## Regime Detection

| Regime | Characteristics | Strategy Adjustment |
|--------|-----------------|---------------------|
| TRENDING_UP | ADX > 25, +DI > -DI | Favor longs |
| TRENDING_DOWN | ADX > 25, -DI > +DI | Favor shorts |
| RANGING | ADX < 20 | Mean reversion |
| VOLATILE | ATR% > 0.5 | Reduce size |
| QUIET | ATR% < 0.1 | Skip trading |

---

## Position Sizing

### Fixed-Fractional Method
```
Size = (Account × Risk%) / (Entry − Stop)
```

### Volatility-Adjusted
```
Size = BaseSize × (TargetVol / CurrentVol)
```

### Hard Limits
- Never exceed 0.5 BTC
- Never exceed 5% account exposure

---

## Signal Strength

Composite score combining:
- RSI deviation from neutral (30%)
- Book imbalance magnitude (25%)
- Volume imbalance (20%)
- Momentum alignment (15%)
- SMC confluence (10%)

Minimum threshold: 0.5 (50%)

---

## Forbidden Conditions

Trading is blocked when:
- Spread > 10 bps
- Expected slippage > 5 bps
- Order book depth < threshold
- Kill switch active
- High-impact news within 1 hour
