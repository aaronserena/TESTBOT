import { createClient } from '@supabase/supabase-js';

// Supabase client for dashboard
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if we have the URL (handles build time)
export const supabase = supabaseUrl
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Server-side client with service role (for API routes)
export function createServerClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        console.warn('Supabase credentials not configured');
        return null;
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

// Database types
export interface DbTrade {
    id: string;
    created_at: string;
    session_id: string;
    side: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price: number | null;
    size: number;
    pnl: number | null;
    pnl_percent: number | null;
    hold_time_ms: number | null;
    planned_hold_time_ms: number;
    entry_fee: number;
    exit_fee: number | null;
    stop_loss: number;
    take_profit: number;
    blunder: string | null;
    blunder_reason: string | null;
    regime: string;
    status: 'OPEN' | 'CLOSED' | 'CANCELLED';
    entry_features: Record<string, number>;
    exit_features: Record<string, number> | null;
    entry_rationale: string;
    exit_reason: string | null;
}

export interface DbSignal {
    id: string;
    created_at: string;
    direction: 'LONG' | 'SHORT';
    signal_strength: number;
    confidence: number;
    entry_price: number;
    suggested_size: number;
    suggested_stop_loss: number;
    suggested_take_profit: number;
    regime: string;
    triggers: string[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
    expires_at: string;
    features: Record<string, number>;
}

export interface DbBotStatus {
    id: string;
    updated_at: string;
    is_running: boolean;
    mode: 'PAPER' | 'LIVE';
    session_id: string | null;
    equity: number;
    starting_equity: number;
    pnl: number;
    unrealized_pnl: number;
    win_rate: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    max_drawdown: number;
    current_drawdown: number;
    total_fees: number;
    regime: string;
    kill_switch_active: boolean;
    position_side: 'LONG' | 'SHORT' | 'FLAT' | null;
    position_size: number | null;
    position_entry_price: number | null;
    position_unrealized_pnl: number | null;
}

export interface DbEquitySnapshot {
    id: string;
    created_at: string;
    session_id: string;
    equity: number;
    pnl: number;
    drawdown: number;
}
