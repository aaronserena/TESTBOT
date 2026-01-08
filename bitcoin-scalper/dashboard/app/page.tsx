'use client';

import { useState, useEffect } from 'react';
import { EquityCurve } from '@/components/EquityCurve';
import { PnLCard } from '@/components/PnLCard';
import { BlunderChart } from '@/components/BlunderChart';
import { TradeTable } from '@/components/TradeTable';
import { KillSwitchPanel } from '@/components/KillSwitchPanel';
import { TradeSignals } from '@/components/TradeSignals';
import { BitcoinPrice } from '@/components/BitcoinPrice';

interface DashboardData {
    status: 'stopped' | 'running';
    equity: number;
    startingEquity: number;
    pnl: number;
    pnlPercent: number;
    unrealizedPnl: number;
    winRate: number;
    expectancy: number;
    drawdown: number;
    maxDrawdown: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalFees: number;
    avgLatency: number;
    regime: string;
    position: {
        side: 'LONG' | 'SHORT' | 'FLAT';
        size: number;
        entryPrice: number;
        unrealizedPnl: number;
    } | null;
}

interface Trade {
    id: string;
    time: number;
    side: 'LONG' | 'SHORT';
    entry: number;
    exit: number;
    pnl: number;
    blunder: 'NOT_A_MISTAKE' | 'INACCURACY' | 'MISTAKE' | 'BLUNDER';
}

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

// Empty initial state
const emptyData: DashboardData = {
    status: 'stopped',
    equity: 0,
    startingEquity: 0,
    pnl: 0,
    pnlPercent: 0,
    unrealizedPnl: 0,
    winRate: 0,
    expectancy: 0,
    drawdown: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalFees: 0,
    avgLatency: 0,
    regime: 'UNKNOWN',
    position: null
};

const emptyBlunderStats = {
    notAMistake: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
};

export default function Dashboard() {
    const [data, setData] = useState<DashboardData>(emptyData);
    const [equityHistory, setEquityHistory] = useState<Array<{ timestamp: number; equity: number }>>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [signals, setSignals] = useState<TradeSignal[]>([]);
    const [blunderStats, setBlunderStats] = useState(emptyBlunderStats);
    const [killSwitchActive, setKillSwitchActive] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch data on mount
    useEffect(() => {
        async function fetchData() {
            try {
                const [statusRes, tradesRes, signalsRes] = await Promise.all([
                    fetch('/api/status'),
                    fetch('/api/trades'),
                    fetch('/api/signals')
                ]);

                if (statusRes.ok) {
                    const status = await statusRes.json();
                    setData({
                        status: status.isRunning ? 'running' : 'stopped',
                        equity: status.equity || 0,
                        startingEquity: status.startingEquity || 0,
                        pnl: status.pnl || 0,
                        pnlPercent: status.pnlPercent || 0,
                        unrealizedPnl: status.unrealizedPnl || 0,
                        winRate: status.metrics?.winRate || 0,
                        expectancy: status.metrics?.expectancy || 0,
                        drawdown: status.metrics?.currentDrawdown || 0,
                        maxDrawdown: status.metrics?.maxDrawdown || 0,
                        totalTrades: status.metrics?.totalTrades || 0,
                        winningTrades: status.metrics?.winningTrades || 0,
                        losingTrades: status.metrics?.losingTrades || 0,
                        totalFees: status.metrics?.totalFees || 0,
                        avgLatency: status.metrics?.avgLatency || 0,
                        regime: status.regime || 'UNKNOWN',
                        position: status.position || null
                    });
                    setKillSwitchActive(status.killSwitchActive || false);
                }

                if (tradesRes.ok) {
                    const tradeData = await tradesRes.json();
                    setTrades(tradeData.trades || []);

                    // Calculate blunder stats from trades
                    const stats = { notAMistake: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
                    for (const trade of tradeData.trades || []) {
                        if (trade.blunder === 'NOT_A_MISTAKE') stats.notAMistake++;
                        else if (trade.blunder === 'INACCURACY') stats.inaccuracy++;
                        else if (trade.blunder === 'MISTAKE') stats.mistake++;
                        else if (trade.blunder === 'BLUNDER') stats.blunder++;
                    }
                    setBlunderStats(stats);
                }

                if (signalsRes.ok) {
                    const signalData = await signalsRes.json();
                    setSignals(signalData.signals || []);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleKillSwitchActivate = async (reason: string) => {
        try {
            await fetch('/api/kill-switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'activate', reason })
            });
            setKillSwitchActive(true);
        } catch (error) {
            console.error('Failed to activate kill switch:', error);
        }
    };

    const handleKillSwitchDeactivate = async () => {
        try {
            await fetch('/api/kill-switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deactivate' })
            });
            setKillSwitchActive(false);
        } catch (error) {
            console.error('Failed to deactivate kill switch:', error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <header className="header">
                <h1>Bitcoin Scalper</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className={`status-badge ${data.status}`}>
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: data.status === 'running' ? '#22c55e' : '#ef4444'
                        }} />
                        {data.status === 'running' ? 'Running' : 'Stopped'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                        Regime: <strong style={{ color: data.regime === 'UNKNOWN' ? 'var(--text-muted)' : '#22c55e' }}>
                            {data.regime}
                        </strong>
                    </span>
                </div>
            </header>

            <div className="container">
                {/* Bitcoin Price - Top of Dashboard */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <BitcoinPrice />
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <PnLCard
                        title="Total P&L"
                        value={data.pnl}
                        percent={data.pnlPercent}
                        isPositive={data.pnl >= 0}
                    />
                    <PnLCard
                        title="Unrealized P&L"
                        value={data.unrealizedPnl}
                        percent={data.startingEquity > 0 ? (data.unrealizedPnl / data.startingEquity) * 100 : 0}
                        isPositive={data.unrealizedPnl >= 0}
                    />
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Win Rate</span>
                        </div>
                        <div className={`card-value ${data.winRate > 0.5 ? 'positive' : 'neutral'}`}>
                            {data.totalTrades > 0 ? (data.winRate * 100).toFixed(1) : '0.0'}%
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            {data.winningTrades}W / {data.losingTrades}L ({data.totalTrades} total)
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Drawdown</span>
                        </div>
                        <div className={`card-value ${data.drawdown > 0 ? 'negative' : 'neutral'}`}>
                            {data.drawdown.toFixed(2)}%
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            Max: {data.maxDrawdown.toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="charts-grid">
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Equity Curve</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                ${data.equity.toLocaleString()}
                            </span>
                        </div>
                        <div className="chart-container">
                            {equityHistory.length > 0 ? (
                                <EquityCurve data={equityHistory} />
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                    No data yet
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Trade Quality</span>
                        </div>
                        <div className="chart-container">
                            <BlunderChart stats={blunderStats} />
                        </div>
                    </div>
                </div>

                {/* Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card">
                        <div className="card-title">Expectancy</div>
                        <div className={`card-value ${data.expectancy > 0 ? 'positive' : 'neutral'}`} style={{ fontSize: '1.5rem' }}>
                            ${data.expectancy.toFixed(2)}
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-title">Total Fees</div>
                        <div className="card-value neutral" style={{ fontSize: '1.5rem' }}>
                            ${data.totalFees.toFixed(2)}
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-title">Avg Latency</div>
                        <div className="card-value neutral" style={{ fontSize: '1.5rem' }}>
                            {data.avgLatency}ms
                        </div>
                    </div>
                    <KillSwitchPanel
                        isActive={killSwitchActive}
                        onActivate={handleKillSwitchActivate}
                        onDeactivate={handleKillSwitchDeactivate}
                    />
                </div>

                {/* Trade Signals - Upcoming Trades */}
                <TradeSignals signals={signals} />

                {/* Current Position */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div className="card-header">
                        <span className="card-title">Current Position</span>
                    </div>
                    {data.position && data.position.side !== 'FLAT' ? (
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <div>
                                <span style={{
                                    color: data.position.side === 'LONG' ? '#22c55e' : '#ef4444',
                                    fontSize: '1.5rem',
                                    fontWeight: 700
                                }}>
                                    {data.position.side}
                                </span>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Size</div>
                                <div style={{ fontWeight: 600 }}>{data.position.size} BTC</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Entry</div>
                                <div style={{ fontWeight: 600 }}>${data.position.entryPrice.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Unrealized P&L</div>
                                <div style={{
                                    fontWeight: 600,
                                    color: data.position.unrealizedPnl >= 0 ? '#22c55e' : '#ef4444'
                                }}>
                                    {data.position.unrealizedPnl >= 0 ? '+' : ''}${data.position.unrealizedPnl.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)' }}>No open position</div>
                    )}
                </div>

                {/* Trade History */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Recent Trades</span>
                    </div>
                    <TradeTable trades={trades} />
                </div>
            </div>
        </div>
    );
}
