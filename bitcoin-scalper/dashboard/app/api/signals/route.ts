import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Handle case where Supabase isn't configured
    if (!supabase) {
        return NextResponse.json({ signals: [], total: 0 });
    }

    try {
        let query = supabase
            .from('signals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ signals: [], total: 0 });
        }

        const signals = (data || []).map(s => ({
            id: s.id,
            timestamp: new Date(s.created_at).getTime(),
            direction: s.direction,
            signalStrength: s.signal_strength,
            confidence: s.confidence,
            entryPrice: s.entry_price,
            suggestedSize: s.suggested_size,
            suggestedStopLoss: s.suggested_stop_loss,
            suggestedTakeProfit: s.suggested_take_profit,
            regime: s.regime,
            triggers: s.triggers || [],
            status: s.status,
            expiresAt: new Date(s.expires_at).getTime(),
            features: s.features || {}
        }));

        return NextResponse.json({ signals, total: signals.length });
    } catch (error) {
        console.error('Error fetching signals:', error);
        return NextResponse.json({ signals: [], total: 0 });
    }
}

export const dynamic = 'force-dynamic';
