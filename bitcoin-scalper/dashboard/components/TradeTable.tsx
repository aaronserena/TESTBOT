'use client';

import { format } from 'date-fns';

interface Trade {
    id: string;
    time: number;
    side: 'LONG' | 'SHORT';
    entry: number;
    exit: number;
    pnl: number;
    blunder: 'NOT_A_MISTAKE' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER';
}

interface TradeTableProps {
    trades: Trade[];
}

const blunderLabels: Record<string, { text: string; className: string }> = {
    NOT_A_MISTAKE: { text: '✓ Good', className: 'not-a-mistake' },
    INACCURACY: { text: '~ Inaccuracy', className: 'inaccuracy' },
    MISTAKE: { text: '✗ Mistake', className: 'mistake' },
    BLUNDER: { text: '✗✗ Blunder', className: 'blunder' },
};

export function TradeTable({ trades }: TradeTableProps) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table className="trade-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Side</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>P&L</th>
                        <th>Quality</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade) => {
                        const isPositive = trade.pnl >= 0;
                        const blunderInfo = blunderLabels[trade.blunder];

                        return (
                            <tr key={trade.id}>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                    {format(new Date(trade.time), 'MMM dd, HH:mm')}
                                </td>
                                <td>
                                    <span
                                        style={{
                                            color: trade.side === 'LONG' ? '#22c55e' : '#ef4444',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {trade.side}
                                    </span>
                                </td>
                                <td style={{ fontFamily: 'monospace' }}>
                                    ${trade.entry.toLocaleString()}
                                </td>
                                <td style={{ fontFamily: 'monospace' }}>
                                    ${trade.exit.toLocaleString()}
                                </td>
                                <td
                                    style={{
                                        fontWeight: 600,
                                        color: isPositive ? '#22c55e' : '#ef4444',
                                    }}
                                >
                                    {isPositive ? '+' : ''}${trade.pnl.toFixed(2)}
                                </td>
                                <td>
                                    <span className={`blunder-label ${blunderInfo.className}`}>
                                        {blunderInfo.text}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                    {trades.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                No trades yet
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
