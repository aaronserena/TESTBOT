'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';

interface EquityCurveProps {
    data: Array<{
        timestamp: number;
        equity: number;
    }>;
}

export function EquityCurve({ data }: EquityCurveProps) {
    const formatDate = (timestamp: number) => format(new Date(timestamp), 'HH:mm');
    const formatValue = (value: number) => `$${value.toLocaleString()}`;

    const minEquity = Math.min(...data.map(d => d.equity)) * 0.998;
    const maxEquity = Math.max(...data.map(d => d.equity)) * 1.002;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatDate}
                    stroke="#6a6a7a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                    stroke="#6a6a7a"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[minEquity, maxEquity]}
                    width={60}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1a1a24',
                        border: '1px solid #2a2a3a',
                        borderRadius: '8px',
                        color: '#ffffff',
                    }}
                    labelFormatter={(label) => format(new Date(label), 'MMM dd, HH:mm')}
                    formatter={(value: number) => [formatValue(value), 'Equity']}
                />
                <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#equityGradient)"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
