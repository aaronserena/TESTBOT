import { NextResponse } from 'next/server';

interface PriceData {
    price: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    marketCap: number;
    timestamp: number;
    source: string;
}

// Fetch Bitcoin price from CoinGecko (works globally, no geo-restrictions)
async function fetchBitcoinPrice(): Promise<PriceData> {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false',
            {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const marketData = data.market_data;

        return {
            price: marketData.current_price.usd,
            change24h: marketData.price_change_24h,
            changePercent24h: marketData.price_change_percentage_24h,
            high24h: marketData.high_24h.usd,
            low24h: marketData.low_24h.usd,
            volume24h: marketData.total_volume.usd,
            marketCap: marketData.market_cap.usd,
            timestamp: Date.now(),
            source: 'CoinGecko'
        };
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);

        // Fallback: try Binance Spot API (more likely to work than Futures)
        try {
            const [tickerRes, priceRes] = await Promise.all([
                fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { cache: 'no-store' }),
                fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { cache: 'no-store' })
            ]);

            if (tickerRes.ok && priceRes.ok) {
                const ticker = await tickerRes.json();
                const price = await priceRes.json();

                return {
                    price: parseFloat(price.price),
                    change24h: parseFloat(ticker.priceChange),
                    changePercent24h: parseFloat(ticker.priceChangePercent),
                    high24h: parseFloat(ticker.highPrice),
                    low24h: parseFloat(ticker.lowPrice),
                    volume24h: parseFloat(ticker.volume) * parseFloat(price.price),
                    marketCap: 0,
                    timestamp: Date.now(),
                    source: 'Binance Spot'
                };
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }

        return {
            price: 0,
            change24h: 0,
            changePercent24h: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            marketCap: 0,
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
