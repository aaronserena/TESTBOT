import { NextResponse } from 'next/server';

interface Params {
    params: {
        id: string;
    };
}

// TODO: Connect to actual trade history store
const getTradeDetail = (id: string) => null;

export async function GET(request: Request, { params }: Params) {
    const { id } = params;

    try {
        const trade = getTradeDetail(id);

        if (!trade) {
            return NextResponse.json(
                { error: 'Trade not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(trade);
    } catch (error) {
        return NextResponse.json(
            { error: 'Trade not found' },
            { status: 404 }
        );
    }
}
