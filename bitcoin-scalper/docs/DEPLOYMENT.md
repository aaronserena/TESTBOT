# Deployment Guide
## Bitcoin Scalping Bot

### Prerequisites

- Node.js 20+ (with npm)
- TypeScript 5.3+
- Network access to Binance Futures API
- AI model endpoint (OpenAI-compatible API)

---

## Quick Start

### 1. Clone and Install

```bash
cd /path/to/bitcoin-scalper

# Install trading bot dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
NODE_ENV=paper
STARTING_EQUITY=10000
AI_API_ENDPOINT=http://localhost:8080/v1/chat/completions
AI_API_KEY=your-api-key
AI_MODEL=gpt-4-turbo
```

### 3. Build

```bash
npm run build
```

### 4. Run Paper Trading

```bash
npm run start:paper
```

### 5. Run Dashboard

```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

---

## Deployment Modes

### Paper Trading (Default)

```bash
NODE_ENV=paper npm start
```

- Simulated order fills
- No real exchange API calls
- Full logging and analysis

### Live Trading

```bash
NODE_ENV=live npm start
```

**Requirements**:
- Exchange API keys configured
- AI endpoint available
- 10-second safety delay on startup

⚠️ **WARNING**: Live mode uses real money. Ensure paper testing is complete.

---

## Directory Structure

```
bitcoin-scalper/
├── src/                 # TypeScript source
├── dist/                # Compiled JavaScript
├── dashboard/           # Next.js dashboard
├── docs/                # Documentation
├── logs/                # Runtime logs
├── .env                 # Configuration
└── package.json
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | paper | Trading mode (paper/live) |
| `STARTING_EQUITY` | 10000 | Initial paper balance |
| `AI_API_ENDPOINT` | - | AI model HTTP endpoint |
| `AI_API_KEY` | - | API authentication key |
| `AI_MODEL` | gpt-4-turbo | Model identifier |
| `LOG_LEVEL` | info | Logging verbosity |

---

## Health Checks

### Trading Engine
- WebSocket connection status
- Order book freshness
- AI API latency
- Kill switch state

### Dashboard
- API connectivity
- Real-time data updates

---

## Monitoring

### Logs
```bash
tail -f logs/trading.log
```

### Metrics
- Dashboard: `http://localhost:3000`
- Status API: `GET /api/status`

---

## Troubleshooting

### WebSocket Connection Failed
- Check network connectivity
- Verify Binance API is accessible
- Check for IP restrictions

### AI API Timeout
- Verify endpoint URL
- Check API key validity
- Review model availability

### Kill Switch Activated
- Check logs for trigger reason
- Wait for cooldown (1 hour)
- Investigate and resolve cause
- Manually reactivate if safe

---

## Production Checklist

- [ ] Paper trading profitable for 30+ days
- [ ] Walk-forward test passed
- [ ] Risk limits reviewed
- [ ] Exchange API keys secured
- [ ] Monitoring configured
- [ ] Alert notifications set up
- [ ] Backup procedures documented
- [ ] Kill switch tested

---

## Backup & Recovery

### Data Backup
- Trade history exported daily
- Decision logs retained 90 days
- Parameter versions archived

### Recovery
1. Restore from latest backup
2. Verify configuration
3. Start in paper mode
4. Confirm system health
5. Switch to live if appropriate

---

## Support

For issues:
1. Check logs for errors
2. Review risk metrics
3. Consult documentation
4. Test in paper mode first
