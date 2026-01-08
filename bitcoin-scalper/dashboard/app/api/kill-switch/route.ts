import { NextResponse } from 'next/server';
import { supabase, createServerClient } from '@/lib/supabase';

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('bot_status')
            .select('kill_switch_active')
            .limit(1)
            .single();

        if (error) {
            return NextResponse.json({ active: false, activatedAt: null, reason: null });
        }

        return NextResponse.json({
            active: data?.kill_switch_active || false,
            activatedAt: null,
            reason: null
        });
    } catch (error) {
        return NextResponse.json({ active: false, activatedAt: null, reason: null });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, reason } = body;

        // Use service role client for write operations
        const serverClient = createServerClient();

        if (action === 'activate') {
            const { error } = await serverClient
                .from('bot_status')
                .update({
                    kill_switch_active: true,
                    updated_at: new Date().toISOString()
                })
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

            if (error) {
                console.error('Failed to activate kill switch:', error);
                return NextResponse.json({ error: 'Failed to activate' }, { status: 500 });
            }

            console.log(`[API] Kill switch activated: ${reason}`);
            return NextResponse.json({
                success: true,
                active: true,
                activatedAt: Date.now(),
                activatedBy: 'MANUAL',
                reason
            });
        } else if (action === 'deactivate') {
            const { error } = await serverClient
                .from('bot_status')
                .update({
                    kill_switch_active: false,
                    updated_at: new Date().toISOString()
                })
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (error) {
                console.error('Failed to deactivate kill switch:', error);
                return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
            }

            console.log('[API] Kill switch deactivated');
            return NextResponse.json({
                success: true,
                active: false
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Kill switch error:', error);
        return NextResponse.json({ error: 'Failed to update kill switch' }, { status: 500 });
    }
}
