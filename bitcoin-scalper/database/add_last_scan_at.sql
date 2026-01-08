-- Run this in Supabase SQL Editor to add the last_scan_at column
-- This tracks when the bot last scanned the market

ALTER TABLE bot_status ADD COLUMN IF NOT EXISTS last_scan_at TIMESTAMPTZ;
