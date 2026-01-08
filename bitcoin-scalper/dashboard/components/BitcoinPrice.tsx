'use client';

import { useState, useEffect } from 'react';

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

export function BitcoinPrice() {
    const [priceData, setPriceData] = useState<PriceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [prevPrice, setPrevPrice] = useState<number | null>(null);
    const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);

    useEffect(() => {
        async function fetchPrice() {
            try {
                const res = await fetch('/api/price');
                if (res.ok) {
                    const data = await res.json();

                    // Flash effect on price change
                    if (prevPrice !== null && data.price !== prevPrice) {
                        setPriceFlash(data.price > prevPrice ? 'up' : 'down');
                        setTimeout(() => setPriceFlash(null), 500);
                    }
                    setPrevPrice(priceData?.price || null);
                    setPriceData(data);
                }
            } catch (error) {
                console.error('Failed to fetch price:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchPrice();
        const interval = setInterval(fetchPrice, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, [prevPrice, priceData?.price]);

    if (loading || !priceData || priceData.price === 0) {
        return (
            <div className="card" style={{ background: 'linear-gradient(135deg, #f7931a20 0%, #f7931a10 100%)' }}>
                <div className="card-header">
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>₿</span> Bitcoin Price
                    </span>
                </div>
                <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>
                    {loading ? 'Connecting to Binance Futures...' : 'Price unavailable'}
                </div>
            </div>
        );
    }

    const isPositive = priceData.changePercent24h >= 0;

    return (
        <div
            className="card"
            style={{
                background: 'linear-gradient(135deg, #f7931a15 0%, #f7931a05 100%)',
                borderColor: '#f7931a30'
            }}
        >
            <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', color: '#f7931a' }}>₿</span> BTCUSDT Perpetual
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                    Binance Futures
                </span>
            </div>

            {/* Main Price */}
            <div style={{ marginBottom: '1rem' }}>
                <div
                    style={{
                        fontSize: '2.25rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: priceFlash === 'up' ? '#22c55e' : priceFlash === 'down' ? '#ef4444' : 'var(--text-primary)',
                        transition: 'color 0.3s ease'
                    }}
                >
                    ${priceData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <span
                        style={{
                            color: isPositive ? '#22c55e' : '#ef4444',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        {isPositive ? '▲' : '▼'} {Math.abs(priceData.changePercent24h).toFixed(2)}%
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        ({isPositive ? '+' : ''}${priceData.change24h.toFixed(2)})
                    </span>
                    <span style={{
                        color: priceData.fundingRate >= 0 ? '#22c55e' : '#ef4444',
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.4rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px'
                    }}>
                        Funding: {priceData.fundingRate >= 0 ? '+' : ''}{priceData.fundingRate.toFixed(4)}%
                    </span>
                </div>
            </div>

            {/* Price Types Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                marginBottom: '0.75rem'
            }}>
                <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Mark Price</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${priceData.markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
                <div style={{ padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Index Price</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${priceData.indexPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                borderRadius: '0.5rem'
            }}>
                <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>24h High</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', color: '#22c55e' }}>
                        ${priceData.high24h.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>24h Low</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', color: '#ef4444' }}>
                        ${priceData.low24h.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>24h Volume</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {priceData.volume24h > 1000000
                            ? `${(priceData.volume24h / 1000000).toFixed(2)}M`
                            : `${(priceData.volume24h / 1000).toFixed(1)}K`} BTC
                    </div>
                </div>
            </div>
        </div>
    );
}
