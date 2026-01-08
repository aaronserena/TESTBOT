import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Trading configuration
const CONFIG = {
    MIN_SIGNAL_STRENGTH: 0.5,
    DEFAULT_POSITION_SIZE_USD: 100,
};

interface TradeCheckResult {
    timestamp: number;
    price: number | null;
    signal: 'LONG' | 'SHORT' | 'HOLD';
    signalStrength: number;
    reason: string;
    executed: boolean;
    error?: string;
}

interface CronResponse {
    success: boolean;
    message: string;
    check: TradeCheckResult | null;
    duration_ms: number;
}

/**
 * Fetch current BTC price from Binance (no rate limits for public API)
 */
async function fetchBTCPrice(): Promise<number> {
    const response = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
        { cache: 'no-store' }
    );

    if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.price);
}

/**
 * Simple trading signal generator (serverless-compatible)
 * Uses price momentum based on recent price history from Supabase
 */
async function generateSignal(
    currentPrice: number,
    supabase: ReturnType<typeof createServerClient>
): Promise<{ signal: 'LONG' | 'SHORT' | 'HOLD'; strength: number; reason: string }> {
    if (!supabase) {
        return { signal: 'HOLD', strength: 0, reason: 'Supabase not configured' };
    }

    try {
        // Get recent price snapshots for momentum calculation
        const { data: recentPrices } = await supabase
            .from('price_history')
            .select('price, created_at')
            .order('created_at', { ascending: false })
            .limit(10);

        // Store current price
        await supabase.from('price_history').insert({
            price: currentPrice,
            created_at: new Date().toISOString()
        });

        if (!recentPrices || recentPrices.length < 3) {
            return { signal: 'HOLD', strength: 0, reason: 'Insufficient price history' };
        }

        // Calculate simple momentum (price change over last few readings)
        const oldestPrice = recentPrices[recentPrices.length - 1].price;
        const momentum = ((currentPrice - oldestPrice) / oldestPrice) * 100;

        // Calculate volatility (standard deviation)
        const prices = recentPrices.map(p => p.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance) / avgPrice * 100;

        // Simple signal logic
        const absMovement = Math.abs(momentum);

        if (absMovement < 0.05) {
            return { signal: 'HOLD', strength: 0.1, reason: 'Low momentum - no clear direction' };
        }

        // Avoid trading in high volatility
        if (volatility > 1) {
            return { signal: 'HOLD', strength: 0.2, reason: `High volatility (${volatility.toFixed(2)}%) - staying flat` };
        }

        if (momentum > 0.1) {
            const strength = Math.min(1, absMovement / 0.5);
            return { signal: 'LONG', strength, reason: `Bullish momentum: +${momentum.toFixed(2)}%` };
        }

        if (momentum < -0.1) {
            const strength = Math.min(1, absMovement / 0.5);
            return { signal: 'SHORT', strength, reason: `Bearish momentum: ${momentum.toFixed(2)}%` };
        }

        return { signal: 'HOLD', strength: 0.3, reason: 'Neutral momentum' };
    } catch (error) {
        console.error('Signal generation error:', error);
        return { signal: 'HOLD', strength: 0, reason: 'Error generating signal' };
    }
}

/**
 * Log signal to Supabase
 */
async function logSignal(
    supabase: ReturnType<typeof createServerClient>,
    price: number,
    signal: 'LONG' | 'SHORT' | 'HOLD',
    strength: number,
    reason: string
): Promise<void> {
    if (!supabase) return;

    try {
        await supabase.from('signals').insert({
            direction: signal === 'HOLD' ? 'LONG' : signal,
            signal_strength: strength,
            confidence: strength,
            entry_price: price,
            suggested_size: signal !== 'HOLD' ? CONFIG.DEFAULT_POSITION_SIZE_USD : 0,
            suggested_stop_loss: signal === 'LONG' ? price * 0.99 : price * 1.01,
            suggested_take_profit: signal === 'LONG' ? price * 1.02 : price * 0.98,
            regime: 'UNKNOWN',
            triggers: [reason],
            status: signal === 'HOLD' ? 'EXPIRED' : 'PENDING',
            expires_at: new Date(Date.now() + 60000).toISOString(),
            features: { reason }
        });
    } catch (error) {
        console.error('Error logging signal:', error);
    }
}

/**
 * Run a single trade check
 */
async function runTradeCheck(
    supabase: ReturnType<typeof createServerClient>
): Promise<TradeCheckResult> {
    const timestamp = Date.now();

    try {
        // Fetch current price
        const price = await fetchBTCPrice();

        // Generate trading signal
        const { signal, strength, reason } = await generateSignal(price, supabase);

        // Log the signal
        await logSignal(supabase, price, signal, strength, reason);

        const executed = signal !== 'HOLD' && strength >= CONFIG.MIN_SIGNAL_STRENGTH;

        console.log(`[Cron Trade] Price: $${price}, Signal: ${signal}, Strength: ${strength.toFixed(2)}`);

        return {
            timestamp,
            price,
            signal,
            signalStrength: strength,
            reason,
            executed
        };
    } catch (error) {
        console.error('[Cron Trade] Error:', error);
        return {
            timestamp,
            price: null,
            signal: 'HOLD',
            signalStrength: 0,
            reason: 'Error during check',
            executed: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Main cron handler - called by cronjobs.org
 * Runs a single trade check per call
 * 
 * Set up TWO cron jobs on cronjobs.org:
 * 1. Every minute at :00 seconds
 * 2. Every minute at :30 seconds
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const supabase = createServerClient();

    try {
        // Check kill switch
        if (supabase) {
            const { data: status } = await supabase
                .from('bot_status')
                .select('kill_switch_active, is_running')
                .limit(1)
                .single();

            if (status?.kill_switch_active) {
                return NextResponse.json({
                    success: true,
                    message: 'Kill switch active - trading disabled',
                    check: null,
                    duration_ms: Date.now() - startTime
                } as CronResponse);
            }

            if (!status?.is_running) {
                return NextResponse.json({
                    success: true,
                    message: 'Bot is not running - skipping trade check',
                    check: null,
                    duration_ms: Date.now() - startTime
                } as CronResponse);
            }
        }

        // Run single trade check
        console.log('[Cron] Running trade check...');
        const check = await runTradeCheck(supabase);

        // Update last_scan_at to show bot activity
        if (supabase) {
            await supabase
                .from('bot_status')
                .update({
                    last_scan_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .not('id', 'is', null);
        }

        const response: CronResponse = {
            success: true,
            message: 'Trade check completed',
            check,
            duration_ms: Date.now() - startTime
        };

        console.log(`[Cron] Complete. Duration: ${response.duration_ms}ms`);
        return NextResponse.json(response);

    } catch (error) {
        console.error('[Cron] Fatal error:', error);
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error',
                check: null,
                duration_ms: Date.now() - startTime
            } as CronResponse,
            { status: 500 }
        );
    }
}

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
    // For GET requests, also run the trade check (easy browser testing)
    return POST(request);
}

export const dynamic = 'force-dynamic';
