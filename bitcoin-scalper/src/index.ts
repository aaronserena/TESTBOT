/**
 * Bitcoin Scalping Bot - Entry Point
 * Production-grade Bitcoin Scalping Bot
 */

import 'reflect-metadata';
import { createContainer } from './di/container.js';
import { TYPES } from './di/types.js';
import { TradingEngine } from './trading-engine.js';

async function main() {
    console.log('━'.repeat(60));
    console.log('  BITCOIN SCALPING BOT');
    console.log('  Production-grade AI-driven Trading System');
    console.log('━'.repeat(60));

    // Check environment
    const mode = process.env.NODE_ENV === 'live' ? 'LIVE' : 'PAPER';
    const startingEquity = parseFloat(process.env.STARTING_EQUITY || '10000');

    console.log(`Mode: ${mode}`);
    console.log(`Starting Equity: $${startingEquity}`);

    if (mode === 'LIVE') {
        console.warn('⚠️  LIVE TRADING MODE - Real money at risk!');
        console.log('Starting in 10 seconds... Press Ctrl+C to cancel.');
        await sleep(10000);
    }

    // Create DI container
    const container = createContainer();

    // Bind trading engine
    container.bind(TYPES.TradingEngine).to(TradingEngine).inSingletonScope();

    // Get trading engine
    const engine = container.get<TradingEngine>(TYPES.TradingEngine);

    // Configure
    engine.configure({
        mode: mode as 'PAPER' | 'LIVE',
        startingEquity,
        decisionIntervalMs: 1000
    });

    // Handle shutdown signals
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down...');
        await engine.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down...');
        await engine.stop();
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught exception:', error);
        await engine.stop();
        process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
        console.error('Unhandled rejection:', reason);
        await engine.stop();
        process.exit(1);
    });

    // Start the engine
    try {
        await engine.start();
    } catch (error) {
        console.error('Failed to start trading engine:', error);
        process.exit(1);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(console.error);
