# Bitcoin Scalping Bot

A production-grade, Bitcoin-only scalping trading bot with AI-driven decision making.

## Features

- **AI Chief Trader**: GPT-based decision making with schema-validated JSON interface
- **Risk-First Architecture**: Absolute veto power over all AI decisions
- **Real-Time Market Data**: Low-latency WebSocket connection to Binance Futures
- **Feature Engineering**: Microstructure, momentum, mean-reversion, and volatility signals
- **Smart Money Concepts**: BOS, CHoCH, FVG, and Order Block detection
- **Blunder Analysis**: Chess-style trade quality assessment
- **News Awareness**: Sandboxed news aggregation with impact scoring
- **Paper Trading**: Full simulation mode before live deployment

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start in paper trading mode (default)
npm run dev

# Or build and run
npm run build
npm run start:paper
```

## Project Structure

```
src/
├── types/          # Type definitions with Zod schemas
├── risk/           # Risk management (rulebook, veto gate, kill switch)
├── data/           # Market data ingestion (WebSocket, order book, trades)
├── features/       # Feature engineering pipeline
├── strategy/       # Base strategy and SMC detector
├── ai/             # AI decision API and regime detection
├── portfolio/      # Balance, position sizing, fees
├── execution/      # Order management and paper trading
├── news/           # News aggregation
├── analysis/       # Blunder analysis
├── logging/        # Decision logging
└── index.ts        # Entry point
```

## Risk Controls

The system enforces hard limits that **cannot be bypassed**:

| Limit | Value |
|-------|-------|
| Max Position Size | 0.5 BTC |
| Max Exposure | 5% of portfolio |
| Max Daily Loss | 2% |
| Max Drawdown | 5% |
| Max Spread | 10 bps |
| Hold Time | 5s - 5min |
| Max Leverage | 3x |

## Configuration

Edit `.env` to configure:

```env
NODE_ENV=paper          # paper or live
STARTING_EQUITY=10000   # Starting balance in USD
AI_API_ENDPOINT=...     # AI model endpoint
AI_API_KEY=...          # API key
```

## Commands

```bash
npm run dev           # Development with hot reload
npm run build         # Compile TypeScript
npm run start:paper   # Start paper trading
npm run start:live    # Start live trading (requires explicit config)
npm run test          # Run tests
npm run lint          # Lint code
```

## Architecture

```
Market Data → Feature Engine → Base Strategy → AI Decision → Veto Gate → Execution
                                    ↑              ↓
                              News Context    Risk Rulebook
                                               ↓
                                          Kill Switch
```

## Safety

- **Paper Trading by Default**: Live mode requires explicit configuration
- **Kill Switch**: Manual or automatic emergency stop
- **Full Audit Trail**: Every decision logged with complete context
- **Blunder Detection**: Post-trade analysis identifies mistakes

## License

Private - All Rights Reserved
