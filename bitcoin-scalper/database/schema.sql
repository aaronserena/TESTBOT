-- Supabase Database Schema for Bitcoin Scalper Bot
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bot Status Table (singleton with current state)
CREATE TABLE IF NOT EXISTS bot_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_running BOOLEAN DEFAULT FALSE,
    mode TEXT DEFAULT 'PAPER' CHECK (mode IN ('PAPER', 'LIVE')),
    session_id TEXT,
    equity NUMERIC DEFAULT 0,
    starting_equity NUMERIC DEFAULT 10000,
    pnl NUMERIC DEFAULT 0,
    unrealized_pnl NUMERIC DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    max_drawdown NUMERIC DEFAULT 0,
    current_drawdown NUMERIC DEFAULT 0,
    total_fees NUMERIC DEFAULT 0,
    regime TEXT DEFAULT 'UNKNOWN',
    kill_switch_active BOOLEAN DEFAULT FALSE,
    position_side TEXT CHECK (position_side IN ('LONG', 'SHORT', 'FLAT', NULL)),
    position_size NUMERIC,
    position_entry_price NUMERIC,
    position_unrealized_pnl NUMERIC
);

-- Trades Table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC,
    size NUMERIC NOT NULL,
    pnl NUMERIC,
    pnl_percent NUMERIC,
    hold_time_ms INTEGER,
    planned_hold_time_ms INTEGER NOT NULL,
    entry_fee NUMERIC NOT NULL,
    exit_fee NUMERIC,
    stop_loss NUMERIC NOT NULL,
    take_profit NUMERIC NOT NULL,
    blunder TEXT CHECK (blunder IN ('NOT_A_MISTAKE', 'INACCURACY', 'MISTAKE', 'BLUNDER', NULL)),
    blunder_reason TEXT,
    regime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    entry_features JSONB DEFAULT '{}',
    exit_features JSONB,
    entry_rationale TEXT,
    exit_reason TEXT
);

-- Trade Signals Table
CREATE TABLE IF NOT EXISTS signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    signal_strength NUMERIC NOT NULL,
    confidence NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    suggested_size NUMERIC NOT NULL,
    suggested_stop_loss NUMERIC NOT NULL,
    suggested_take_profit NUMERIC NOT NULL,
    regime TEXT NOT NULL,
    triggers TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED')),
    expires_at TIMESTAMPTZ NOT NULL,
    features JSONB DEFAULT '{}'
);

-- Equity Snapshots (for equity curve)
CREATE TABLE IF NOT EXISTS equity_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT NOT NULL,
    equity NUMERIC NOT NULL,
    pnl NUMERIC NOT NULL,
    drawdown NUMERIC DEFAULT 0
);

-- Decision Log (audit trail)
CREATE TABLE IF NOT EXISTS decision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decision_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    signal_id UUID REFERENCES signals(id),
    trade_id UUID REFERENCES trades(id),
    action TEXT NOT NULL,
    features JSONB,
    ai_request JSONB,
    ai_response JSONB,
    risk_checks JSONB,
    veto_result JSONB,
    execution_result JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equity_session ON equity_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_equity_created ON equity_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_session ON decision_logs(session_id);

-- Insert initial bot status row
INSERT INTO bot_status (is_running, mode, equity, starting_equity)
VALUES (false, 'PAPER', 10000, 10000)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE bot_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_logs ENABLE ROW LEVEL SECURITY;

-- Policies for anon access (read-only for dashboard)
CREATE POLICY "Allow anon read bot_status" ON bot_status FOR SELECT USING (true);
CREATE POLICY "Allow anon read trades" ON trades FOR SELECT USING (true);
CREATE POLICY "Allow anon read signals" ON signals FOR SELECT USING (true);
CREATE POLICY "Allow anon read equity_snapshots" ON equity_snapshots FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access bot_status" ON bot_status FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access trades" ON trades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access signals" ON signals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access equity_snapshots" ON equity_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access decision_logs" ON decision_logs FOR ALL USING (auth.role() = 'service_role');
