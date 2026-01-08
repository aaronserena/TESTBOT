-- Run this SQL in Supabase SQL Editor to add the price_history table
-- This is for the cron-based trading feature

-- Price History table (for momentum signal generation)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    price NUMERIC NOT NULL
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at DESC);

-- Enable Row Level Security
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access price_history" 
    ON price_history FOR ALL 
    USING (auth.role() = 'service_role');

-- Optional: Cleanup function to remove old price data (keeps last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_prices()
RETURNS void AS $$
BEGIN
    DELETE FROM price_history 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
