# Cron Job Setup with cronjobs.org

This guide explains how to set up automated trading triggers using **cronjobs.org**.

## How It Works

You'll create **two cron jobs** on cronjobs.org:
- **Job 1**: Runs every minute at `:00` seconds
- **Job 2**: Runs every minute at `:30` seconds

This gives you **2 trade checks per minute**, 30 seconds apart.

## Prerequisites

1. Your dashboard deployed to Vercel
2. A cronjobs.org account (free tier works)

## Step 1: Deploy to Vercel

Make sure your dashboard is deployed and the `/api/cron/trade` endpoint is accessible.

## Step 2: Run the Database Migration

Run this SQL in your Supabase SQL Editor to add the required table:

```sql
-- Price History (for cron-based signal generation)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    price NUMERIC NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at DESC);

-- Enable RLS
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Service role can read/write
CREATE POLICY "Service role full access price_history" 
    ON price_history FOR ALL 
    USING (auth.role() = 'service_role');
```

## Step 3: Configure cronjobs.org

Sign up at [cronjobs.org](https://cronjobs.org) and create **two** cron jobs:

### Job 1: Trade Check at :00

| Setting | Value |
|---------|-------|
| **Title** | Bitcoin Scalper - Check 1 |
| **URL** | `https://your-app.vercel.app/api/cron/trade` |
| **Schedule** | Every 1 minute |
| **Seconds** | `0` (at the start of each minute) |
| **Request Method** | `POST` |

### Job 2: Trade Check at :30

| Setting | Value |
|---------|-------|
| **Title** | Bitcoin Scalper - Check 2 |
| **URL** | `https://your-app.vercel.app/api/cron/trade` |
| **Schedule** | Every 1 minute |
| **Seconds** | `30` (30 seconds into each minute) |
| **Request Method** | `POST` |

> **Note**: If cronjobs.org doesn't support second-level scheduling on free tier, you can use their "delay" feature to add 30 seconds to Job 2.

## Step 4: Test Your Setup

### Quick Test in Browser

Just visit:
```
https://your-app.vercel.app/api/cron/trade
```

### Test with cURL

```bash
curl -X POST https://your-app.vercel.app/api/cron/trade
```

Expected response:
```json
{
  "success": true,
  "message": "Trade check completed",
  "check": {
    "timestamp": 1704783600000,
    "price": 45000,
    "signal": "HOLD",
    "signalStrength": 0.1,
    "reason": "Low momentum - no clear direction",
    "executed": false
  },
  "duration_ms": 1234
}
```

## Verify in Supabase

Check your `signals` table:
```sql
SELECT * FROM signals ORDER BY created_at DESC LIMIT 10;
```

Check price history:
```sql
SELECT * FROM price_history ORDER BY created_at DESC LIMIT 20;
```

## Monitoring

### Vercel Logs
1. Go to your Vercel project
2. Click **Logs** → Filter by `/api/cron/trade`

### cronjobs.org Dashboard
View execution history, success/failure status, and response times.

## Troubleshooting

### "Bot is not running"
- The bot status shows `is_running: false`
- Enable it in the `bot_status` table or via the dashboard

### "Kill switch active"  
- Trading is disabled
- Set `kill_switch_active: false` in `bot_status`

### "Insufficient price history"
- Normal for first few calls
- Wait for 3+ price readings to accumulate

### No signals appearing
- Check Vercel logs for errors
- Verify Supabase connection (env variables set correctly)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  cronjobs.org   │     │  cronjobs.org   │
│   Job 1 (:00)   │     │   Job 2 (:30)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │   POST /api/cron/trade
         ▼                       ▼
┌─────────────────────────────────────────┐
│            Vercel Serverless            │
│  ┌───────────────────────────────────┐  │
│  │  1. Check kill switch             │  │
│  │  2. Fetch BTC price (CoinGecko)   │  │
│  │  3. Calculate momentum signal     │  │
│  │  4. Log to Supabase               │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │     Supabase     │
         │  - price_history │
         │  - signals       │
         │  - bot_status    │
         └──────────────────┘
```

## Cost

| Service | Free Tier | Notes |
|---------|-----------|-------|
| cronjobs.org | 1-2 cron jobs | Check their current limits |
| Vercel | Hobby: 10s timeout | Sufficient for single check |
| Supabase | 500MB database | More than enough |
