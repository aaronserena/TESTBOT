import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    // Handle case where Supabase isn't configured
    if (!supabase) {
        return NextResponse.json({ snapshots: [] });
    }

    try {
        const { data, error } = await supabase
            .from('equity_snapshots')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(500);

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ snapshots: [] });
        }

        const snapshots = (data || []).map(s => ({
            timestamp: new Date(s.created_at).getTime(),
            equity: s.equity,
            pnl: s.pnl,
            drawdown: s.drawdown
        }));

        return NextResponse.json({ snapshots });
    } catch (error) {
        console.error('Error fetching equity:', error);
        return NextResponse.json({ snapshots: [] });
    }
}

// Force dynamic to avoid build-time data fetching
export const dynamic = 'force-dynamic';
