'use client';

import { format } from 'date-fns';

interface TradeSignal {
    id: string;
    timestamp: number;
    direction: 'LONG' | 'SHORT';
    signalStrength: number;
    confidence: number;
    entryPrice: number;
    suggestedSize: number;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    regime: string;
    triggers: string[];
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
    expiresAt: number;
    features: {
        rsi: number;
        bookImbalance: number;
        spreadBps: number;
        volumeImbalance: number;
        atrPercent: number;
    };
}

interface TradeSignalsProps {
    signals: TradeSignal[];
}

export function TradeSignals({ signals }: TradeSignalsProps) {
    if (signals.length === 0) {
        return (
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Upcoming Trade Signals</span>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-muted)',
                        }}
                    >
                        0 pending
                    </span>
                </div>
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem'
                }}>
                    No trade signals at the moment. The system is analyzing market conditions.
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Upcoming Trade Signals</span>
                <span
                    style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                    }}
                >
                    {signals.filter(s => s.status === 'PENDING').length} pending
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {signals.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                ))}
            </div>
        </div>
    );
}

function SignalCard({ signal }: { signal: TradeSignal }) {
    const isLong = signal.direction === 'LONG';
    const strengthPercent = signal.signalStrength * 100;
    const confidencePercent = signal.confidence * 100;
    const timeRemaining = Math.max(0, signal.expiresAt - Date.now());
    const timeRemainingSeconds = Math.floor(timeRemaining / 1000);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return '#6366f1';
            case 'APPROVED': return '#22c55e';
            case 'EXECUTED': return '#22c55e';
            case 'REJECTED': return '#ef4444';
            case 'EXPIRED': return '#6a6a7a';
            default: return '#6a6a7a';
        }
    };

    return (
        <div
            style={{
                padding: '1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: '0.75rem',
                border: `1px solid ${isLong ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                        style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: isLong ? '#22c55e' : '#ef4444',
                        }}
                    >
                        {signal.direction}
                    </span>
                    <span
                        style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            background: `${getStatusColor(signal.status)}20`,
                            color: getStatusColor(signal.status),
                            fontWeight: 600,
                        }}
                    >
                        {signal.status}
                    </span>
                </div>
                {signal.status === 'PENDING' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Expires in {timeRemainingSeconds}s
                    </span>
                )}
            </div>

            {/* Strength & Confidence Bars */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Signal Strength
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                            style={{
                                flex: 1,
                                height: '6px',
                                background: 'var(--bg-primary)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${strengthPercent}%`,
                                    height: '100%',
                                    background: isLong
                                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                                        : 'linear-gradient(90deg, #ef4444, #f87171)',
                                    borderRadius: '3px',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{strengthPercent.toFixed(0)}%</span>
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Confidence
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                            style={{
                                flex: 1,
                                height: '6px',
                                background: 'var(--bg-primary)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${confidencePercent}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                    borderRadius: '3px',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{confidencePercent.toFixed(0)}%</span>
                    </div>
                </div>
            </div>

            {/* Trade Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Entry</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${signal.entryPrice.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Size</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {signal.suggestedSize} BTC
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#ef4444' }}>Stop Loss</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${signal.suggestedStopLoss.toLocaleString()}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#22c55e' }}>Take Profit</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${signal.suggestedTakeProfit.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Triggers */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {signal.triggers.map((trigger, i) => (
                    <span
                        key={i}
                        style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '9999px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        {trigger}
                    </span>
                ))}
            </div>
        </div>
    );
}
