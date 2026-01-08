'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface TradeDetail {
    id: string;
    time: number;
    side: 'LONG' | 'SHORT';
    entry: number;
    exit: number;
    size: number;
    pnl: number;
    pnlPercent: number;
    holdTimeMs: number;
    plannedHoldTimeMs: number;
    blunder: string;
    blunderReason: string;
    regime: string;
    sessionId: string;
    decisionId: string;
    orderId: string;
    entryFeatures: Record<string, number>;
    entryRationale: string;
    exitFeatures: Record<string, number>;
    exitReason: string;
    riskChecks: Array<{ name: string; passed: boolean; value: number; limit: number }>;
    entryFee: number;
    exitFee: number;
    totalFees: number;
    grossPnl: number;
    netPnl: number;
    expectedEntryPrice: number;
    expectedExitPrice: number;
    entrySlippage: number;
    exitSlippage: number;
}

export default function TradeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [trade, setTrade] = useState<TradeDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/trades/${params.id}`)
            .then(res => res.json())
            .then(data => {
                setTrade(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [params.id]);

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
            </div>
        );
    }

    if (!trade) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>Trade not found</div>
            </div>
        );
    }

    const isPositive = trade.pnl >= 0;

    return (
        <div>
            <header className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => router.back()}
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: '0.5rem',
                            padding: '0.5rem 1rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                        }}
                    >
                        ← Back
                    </button>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        Trade {trade.id.slice(0, 8)}
                    </h1>
                </div>
                <span
                    className={`blunder-label ${trade.blunder.toLowerCase().replace(/_/g, '-')}`}
                    style={{ fontSize: '0.875rem' }}
                >
                    {trade.blunder.replace(/_/g, ' ')}
                </span>
            </header>

            <div className="container">
                {/* Summary Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card">
                        <div className="card-title">Side</div>
                        <div
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: trade.side === 'LONG' ? '#22c55e' : '#ef4444',
                            }}
                        >
                            {trade.side}
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-title">Net P&L</div>
                        <div
                            className={`card-value ${isPositive ? 'positive' : 'negative'}`}
                            style={{ fontSize: '1.5rem' }}
                        >
                            {isPositive ? '+' : ''}${trade.netPnl.toFixed(2)}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {isPositive ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-title">Hold Time</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                            {(trade.holdTimeMs / 1000).toFixed(1)}s
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Planned: {(trade.plannedHoldTimeMs / 1000).toFixed(1)}s
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-title">Regime</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                            {trade.regime.replace(/_/g, ' ')}
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                    {/* Entry Details */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '1rem' }}>Entry Details</div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                                <span style={{ fontFamily: 'monospace' }}>${trade.entry.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Size</span>
                                <span>{trade.size} BTC</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Fee</span>
                                <span>${trade.entryFee.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Slippage</span>
                                <span>${trade.entrySlippage.toFixed(2)}</span>
                            </div>
                            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Rationale</div>
                                <div style={{ fontSize: '0.875rem' }}>{trade.entryRationale}</div>
                            </div>
                        </div>
                    </div>

                    {/* Exit Details */}
                    <div className="card">
                        <div className="card-title" style={{ marginBottom: '1rem' }}>Exit Details</div>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Price</span>
                                <span style={{ fontFamily: 'monospace' }}>${trade.exit.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Gross P&L</span>
                                <span style={{ color: isPositive ? '#22c55e' : '#ef4444' }}>
                                    ${trade.grossPnl.toFixed(2)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Fee</span>
                                <span>${trade.exitFee.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Slippage</span>
                                <span>${trade.exitSlippage.toFixed(2)}</span>
                            </div>
                            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Exit Reason</div>
                                <div style={{ fontSize: '0.875rem' }}>{trade.exitReason}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Risk Checks */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Risk Checks</div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {trade.riskChecks.map((check, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '0.5rem',
                                    gap: '0.75rem',
                                }}
                            >
                                <span style={{ color: check.passed ? '#22c55e' : '#ef4444' }}>
                                    {check.passed ? '✓' : '✗'}
                                </span>
                                <span style={{ flex: 1 }}>{check.name}</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                    {check.value.toFixed(2)} / {check.limit}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Blunder Analysis */}
                {trade.blunder !== 'NOT_A_MISTAKE' && (
                    <div
                        className="card"
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                        }}
                    >
                        <div className="card-title" style={{ color: '#ef4444', marginBottom: '0.5rem' }}>
                            ⚠️ Blunder Analysis
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>{trade.blunderReason}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
