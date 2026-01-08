'use client';

interface PnLCardProps {
    title: string;
    value: number;
    percent: number;
    isPositive: boolean;
}

export function PnLCard({ title, value, percent, isPositive }: PnLCardProps) {
    const colorClass = isPositive ? 'positive' : 'negative';
    const sign = isPositive ? '+' : '';

    return (
        <div className="card">
            <div className="card-header">
                <span className="card-title">{title}</span>
                <span
                    style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '9999px',
                        background: isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: isPositive ? '#22c55e' : '#ef4444',
                    }}
                >
                    {sign}{percent.toFixed(2)}%
                </span>
            </div>
            <div className={`card-value ${colorClass}`}>
                {sign}${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        width: `${Math.min(100, Math.abs(percent) * 10)}%`,
                        background: isPositive
                            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                            : 'linear-gradient(90deg, #ef4444, #f87171)',
                        borderRadius: '2px',
                        transition: 'width 0.3s ease',
                    }}
                />
            </div>
        </div>
    );
}
