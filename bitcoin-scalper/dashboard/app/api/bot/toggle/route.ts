import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    const supabase = createServerClient();

    if (!supabase) {
        return NextResponse.json(
            { success: false, error: 'Supabase not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { action } = body;

        if (action !== 'start' && action !== 'stop') {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Use "start" or "stop"' },
                { status: 400 }
            );
        }

        const isRunning = action === 'start';

        // Update bot status
        const { error } = await supabase
            .from('bot_status')
            .update({
                is_running: isRunning,
                updated_at: new Date().toISOString()
            })
            .not('id', 'is', null); // Update all rows (there should only be one)

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        console.log(`[Bot Toggle] Bot ${action}ed`);

        return NextResponse.json({
            success: true,
            isRunning,
            message: `Bot ${action}ed successfully`
        });

    } catch (error) {
        console.error('Error toggling bot:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to toggle bot' },
            { status: 500 }
        );
    }
}

export const dynamic = 'force-dynamic';
