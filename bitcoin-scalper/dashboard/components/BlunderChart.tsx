'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BlunderChartProps {
    stats: {
        notAMistake: number;
        inaccuracy: number;
        mistake: number;
        blunder: number;
    };
}

const COLORS = {
    notAMistake: '#22c55e',
    inaccuracy: '#f59e0b',
    mistake: '#f87171',
    blunder: '#ef4444',
};

const LABELS = {
    notAMistake: 'Not a Mistake',
    inaccuracy: 'Inaccuracy',
    mistake: 'Mistake',
    blunder: 'Blunder',
};

export function BlunderChart({ stats }: BlunderChartProps) {
    const data = [
        { name: LABELS.notAMistake, value: stats.notAMistake, color: COLORS.notAMistake },
        { name: LABELS.inaccuracy, value: stats.inaccuracy, color: COLORS.inaccuracy },
        { name: LABELS.mistake, value: stats.mistake, color: COLORS.mistake },
        { name: LABELS.blunder, value: stats.blunder, color: COLORS.blunder },
    ].filter(d => d.value > 0);

    const total = data.reduce((sum, d) => sum + d.value, 0);
    const qualityScore = total > 0
        ? ((stats.notAMistake * 100 + stats.inaccuracy * 70 + stats.mistake * 30 + stats.blunder * 0) / total).toFixed(1)
        : '100';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {qualityScore}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Quality Score
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1a1a24',
                                border: '1px solid #2a2a3a',
                                borderRadius: '8px',
                                color: '#ffffff',
                            }}
                            formatter={(value: number, name: string) => [
                                `${value} trades (${((value / total) * 100).toFixed(1)}%)`,
                                name,
                            ]}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {data.map((entry) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({entry.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
