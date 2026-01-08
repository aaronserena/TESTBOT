import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    // Handle case where Supabase isn't configured
    if (!supabase) {
        return NextResponse.json({
            isRunning: false,
            sessionId: null,
            mode: 'PAPER',
            runtime: 0,
            equity: 10000,
            startingEquity: 10000,
            pnl: 0,
            pnlPercent: 0,
            unrealizedPnl: 0,
            position: null,
            metrics: {
                winRate: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                expectancy: 0,
                maxDrawdown: 0,
                currentDrawdown: 0,
                totalFees: 0,
                avgLatency: 0
            },
            regime: 'UNKNOWN',
            killSwitchActive: false,
            timestamp: Date.now()
        });
    }

    try {
        const { data, error } = await supabase
            .from('bot_status')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Supabase error:', error);
            return NextResponse.json({
                isRunning: false,
                sessionId: null,
                mode: 'PAPER',
                runtime: 0,
                equity: 0,
                startingEquity: 10000,
                pnl: 0,
                pnlPercent: 0,
                unrealizedPnl: 0,
                position: null,
                metrics: {
                    winRate: 0,
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    expectancy: 0,
                    maxDrawdown: 0,
                    currentDrawdown: 0,
                    totalFees: 0,
                    avgLatency: 0
                },
                regime: 'UNKNOWN',
                killSwitchActive: false,
                timestamp: Date.now()
            });
        }

        if (!data) {
            return NextResponse.json({
                isRunning: false,
                sessionId: null,
                mode: 'PAPER',
                runtime: 0,
                equity: 10000,
                startingEquity: 10000,
                pnl: 0,
                pnlPercent: 0,
                unrealizedPnl: 0,
                position: null,
                metrics: {
                    winRate: 0,
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    expectancy: 0,
                    maxDrawdown: 0,
                    currentDrawdown: 0,
                    totalFees: 0,
                    avgLatency: 0
                },
                regime: 'UNKNOWN',
                killSwitchActive: false,
                timestamp: Date.now()
            });
        }

        const pnlPercent = data.starting_equity > 0
            ? ((data.pnl || 0) / data.starting_equity) * 100
            : 0;

        return NextResponse.json({
            isRunning: data.is_running,
            sessionId: data.session_id,
            mode: data.mode,
            runtime: 0,
            equity: data.equity || 0,
            startingEquity: data.starting_equity || 10000,
            pnl: data.pnl || 0,
            pnlPercent,
            unrealizedPnl: data.unrealized_pnl || 0,
            position: data.position_side && data.position_side !== 'FLAT' ? {
                side: data.position_side,
                size: data.position_size,
                entryPrice: data.position_entry_price,
                unrealizedPnl: data.position_unrealized_pnl
            } : null,
            metrics: {
                winRate: data.win_rate || 0,
                totalTrades: data.total_trades || 0,
                winningTrades: data.winning_trades || 0,
                losingTrades: data.losing_trades || 0,
                expectancy: data.total_trades > 0 ? (data.pnl || 0) / data.total_trades : 0,
                maxDrawdown: data.max_drawdown || 0,
                currentDrawdown: data.current_drawdown || 0,
                totalFees: data.total_fees || 0,
                avgLatency: 0
            },
            regime: data.regime || 'UNKNOWN',
            killSwitchActive: data.kill_switch_active || false,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error fetching status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch status' },
            { status: 500 }
        );
    }
}

export const dynamic = 'force-dynamic';
