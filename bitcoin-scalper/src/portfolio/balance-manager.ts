/**
 * Balance Manager - Account Balance and Position Tracking
 * Production-grade Bitcoin Scalping Bot
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { Position } from '../types/core.js';
import { createEmptyPosition } from '../types/core.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { TYPES } from '../di/types.js';

export interface AccountBalance {
    totalEquity: number;
    availableBalance: number;
    marginUsed: number;
    unrealizedPnl: number;
    realizedPnl: number;
}

@injectable()
export class BalanceManager extends EventEmitter {
    private balance: AccountBalance;
    private position: Position;
    private initialEquity: number = 0;

    constructor(
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        super();
        this.balance = {
            totalEquity: 0,
            availableBalance: 0,
            marginUsed: 0,
            unrealizedPnl: 0,
            realizedPnl: 0
        };
        this.position = createEmptyPosition();
        console.log('[BalanceManager] Initialized');
    }

    /**
     * Initialize with starting balance
     */
    initialize(startingEquity: number): void {
        this.initialEquity = startingEquity;
        this.balance = {
            totalEquity: startingEquity,
            availableBalance: startingEquity,
            marginUsed: 0,
            unrealizedPnl: 0,
            realizedPnl: 0
        };
        console.log(`[BalanceManager] Initialized with $${startingEquity}`);
    }

    /**
     * Get current balance
     */
    getBalance(): Readonly<AccountBalance> {
        this.updateUnrealizedPnl();
        return { ...this.balance };
    }

    /**
     * Get current position
     */
    getPosition(): Readonly<Position> {
        return { ...this.position };
    }

    /**
     * Open a new position
     */
    openPosition(side: 'LONG' | 'SHORT', size: number, entryPrice: number, fee: number): void {
        const marginRequired = size * entryPrice;

        if (marginRequired > this.balance.availableBalance) {
            throw new Error('Insufficient balance for position');
        }

        this.position = {
            symbol: 'BTCUSDT',
            side,
            quantity: size,
            entryPrice,
            unrealizedPnl: 0,
            realizedPnl: 0,
            marginUsed: marginRequired,
            leverage: 1,
            openedAt: Date.now(),
            updatedAt: Date.now()
        };

        this.balance.marginUsed = marginRequired;
        this.balance.availableBalance -= marginRequired;
        this.balance.realizedPnl -= fee;
        this.balance.totalEquity -= fee;

        this.emit('positionOpened', {
            side,
            size,
            entryPrice,
            timestamp: Date.now()
        });
    }

    /**
     * Close current position
     */
    closePosition(exitPrice: number, fee: number): { pnl: number; netPnl: number } {
        if (this.position.side === 'FLAT') {
            return { pnl: 0, netPnl: 0 };
        }

        const entryPrice = this.position.entryPrice || exitPrice;
        const size = this.position.quantity;

        // Calculate P&L
        let pnl: number;
        if (this.position.side === 'LONG') {
            pnl = (exitPrice - entryPrice) * size;
        } else {
            pnl = (entryPrice - exitPrice) * size;
        }

        const netPnl = pnl - fee;

        // Update balance
        this.balance.realizedPnl += netPnl;
        this.balance.marginUsed = 0;
        this.balance.availableBalance = this.balance.totalEquity + netPnl - fee;
        this.balance.totalEquity += netPnl;
        this.balance.unrealizedPnl = 0;

        // Reset position
        const closedPosition = { ...this.position };
        this.position = createEmptyPosition();

        this.emit('positionClosed', {
            ...closedPosition,
            exitPrice,
            pnl,
            netPnl,
            timestamp: Date.now()
        });

        return { pnl, netPnl };
    }

    /**
     * Update unrealized P&L
     */
    private updateUnrealizedPnl(): void {
        if (this.position.side === 'FLAT') {
            this.balance.unrealizedPnl = 0;
            return;
        }

        const currentPrice = this.tradeTape.getLastPrice();
        const entryPrice = this.position.entryPrice || currentPrice;
        const size = this.position.quantity;

        if (this.position.side === 'LONG') {
            this.balance.unrealizedPnl = (currentPrice - entryPrice) * size;
        } else {
            this.balance.unrealizedPnl = (entryPrice - currentPrice) * size;
        }

        this.position.unrealizedPnl = this.balance.unrealizedPnl;
        this.balance.totalEquity = this.balance.availableBalance + this.balance.marginUsed + this.balance.unrealizedPnl;
    }

    /**
     * Get total P&L since start
     */
    getTotalPnl(): number {
        this.updateUnrealizedPnl();
        return this.balance.totalEquity - this.initialEquity;
    }

    /**
     * Get P&L percentage
     */
    getPnlPercent(): number {
        if (this.initialEquity === 0) return 0;
        return (this.getTotalPnl() / this.initialEquity) * 100;
    }

    /**
     * Check if has open position
     */
    hasPosition(): boolean {
        return this.position.side !== 'FLAT';
    }
}
