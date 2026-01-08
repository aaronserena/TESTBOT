import { NextResponse } from 'next/server';

interface PriceData {
    price: number;
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    timestamp: number;
    source: string;
}

// Fetch real Bitcoin price from Binance Futures API (perpetual contract)
async function fetchBitcoinPrice(): Promise<PriceData> {
    try {
        const [tickerRes, premiumRes] = await Promise.all([
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT', {
                cache: 'no-store'
            }),
            fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT', {
                cache: 'no-store'
            })
        ]);

        if (!tickerRes.ok || !premiumRes.ok) {
            throw new Error('Failed to fetch from Binance Futures');
        }

        const tickerData = await tickerRes.json();
        const premiumData = await premiumRes.json();

        return {
            price: parseFloat(tickerData.lastPrice),
            markPrice: parseFloat(premiumData.markPrice),
            indexPrice: parseFloat(premiumData.indexPrice),
            fundingRate: parseFloat(premiumData.lastFundingRate) * 100,
            change24h: parseFloat(tickerData.priceChange),
            changePercent24h: parseFloat(tickerData.priceChangePercent),
            high24h: parseFloat(tickerData.highPrice),
            low24h: parseFloat(tickerData.lowPrice),
            volume24h: parseFloat(tickerData.volume),
            timestamp: Date.now(),
            source: 'Binance Futures BTCUSDT Perpetual'
        };
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);
        return {
            price: 0,
            markPrice: 0,
            indexPrice: 0,
            fundingRate: 0,
            change24h: 0,
            changePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            timestamp: Date.now(),
            source: 'Error'
        };
    }
}

export async function GET() {
    try {
        const priceData = await fetchBitcoinPrice();
        return NextResponse.json(priceData);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch Bitcoin price' },
            { status: 500 }
        );
    }
}

export const dynamic = 'force-dynamic';
