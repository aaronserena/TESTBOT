'use client';

interface LatencyMonitorProps {
    currentLatency: number;
    avgLatency: number;
    maxLatency: number;
}

export function LatencyMonitor({ currentLatency, avgLatency, maxLatency }: LatencyMonitorProps) {
    const getLatencyColor = (ms: number) => {
        if (ms < 50) return '#22c55e';
        if (ms < 100) return '#f59e0b';
        return '#ef4444';
    };

    const getLatencyStatus = (ms: number) => {
        if (ms < 50) return 'Excellent';
        if (ms < 100) return 'Good';
        if (ms < 200) return 'Fair';
        return 'Poor';
    };

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">Latency</span>
                <span
                    style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        background: `${getLatencyColor(currentLatency)}20`,
                        color: getLatencyColor(currentLatency),
                    }}
                >
                    {getLatencyStatus(currentLatency)}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                <span
                    style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: getLatencyColor(currentLatency),
                    }}
                >
                    {currentLatency}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>ms</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Average
                    </div>
                    <div style={{ fontWeight: 600 }}>{avgLatency}ms</div>
                </div>
                <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Max
                    </div>
                    <div style={{ fontWeight: 600 }}>{maxLatency}ms</div>
                </div>
            </div>

            <div
                style={{
                    marginTop: '1rem',
                    height: '4px',
                    borderRadius: '2px',
                    background: 'var(--bg-tertiary)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${Math.min(100, (currentLatency / 200) * 100)}%`,
                        background: getLatencyColor(currentLatency),
                        borderRadius: '2px',
                        transition: 'all 0.3s ease',
                    }}
                />
            </div>
        </div>
    );
}
