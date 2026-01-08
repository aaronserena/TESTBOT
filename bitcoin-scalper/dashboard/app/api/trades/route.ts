import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const regime = searchParams.get('regime');
    const blunder = searchParams.get('blunder');
    const status = searchParams.get('status') || 'CLOSED';

    // Handle case where Supabase isn't configured
    if (!supabase) {
        return NextResponse.json({ trades: [], total: 0 });
    }

    try {
        let query = supabase
            .from('trades')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (regime) {
            query = query.eq('regime', regime);
        }

        if (blunder) {
            query = query.eq('blunder', blunder);
        }

        if (status !== 'ALL') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ trades: [], total: 0 });
        }

        const trades = (data || []).map(t => ({
            id: t.id,
            time: new Date(t.created_at).getTime(),
            side: t.side,
            entry: t.entry_price,
            exit: t.exit_price,
            size: t.size,
            pnl: t.pnl || 0,
            pnlPercent: t.pnl_percent || 0,
            holdTimeMs: t.hold_time_ms || 0,
            blunder: t.blunder || 'NOT_A_MISTAKE',
            regime: t.regime,
            sessionId: t.session_id,
            status: t.status
        }));

        return NextResponse.json({ trades, total: trades.length });
    } catch (error) {
        console.error('Error fetching trades:', error);
        return NextResponse.json({ trades: [], total: 0 });
    }
}

export const dynamic = 'force-dynamic';
