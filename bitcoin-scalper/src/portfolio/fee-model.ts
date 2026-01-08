/**
 * Fee Model - Trading Fee and Slippage Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Accurate fee calculation for profitability analysis.
 */

import { injectable } from 'inversify';

export interface FeeConfig {
    makerFeeBps: number;
    takerFeeBps: number;
    fundingRateAnnualized?: number;
}

export interface FeeCalculation {
    grossPnl: number;
    entryFee: number;
    exitFee: number;
    totalFees: number;
    netPnl: number;
    netPnlPercent: number;
    breakEvenMove: number;
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
    makerFeeBps: 2,    // 0.02% maker fee
    takerFeeBps: 5,    // 0.05% taker fee
    fundingRateAnnualized: 10 // 10% annual funding
};

@injectable()
export class FeeModel {
    private config: FeeConfig;

    constructor(config?: Partial<FeeConfig>) {
        this.config = { ...DEFAULT_FEE_CONFIG, ...config };
        console.log('[FeeModel] Initialized with maker:', this.config.makerFeeBps, 'bps, taker:', this.config.takerFeeBps, 'bps');
    }

    /**
     * Calculate fees for a round-trip trade
     */
    calculateRoundTrip(
        entryPrice: number,
        exitPrice: number,
        sizeBTC: number,
        entryIsMaker: boolean,
        exitIsMaker: boolean
    ): FeeCalculation {
        const entryValue = entryPrice * sizeBTC;
        const exitValue = exitPrice * sizeBTC;

        // Calculate fees
        const entryFeeBps = entryIsMaker ? this.config.makerFeeBps : this.config.takerFeeBps;
        const exitFeeBps = exitIsMaker ? this.config.makerFeeBps : this.config.takerFeeBps;

        const entryFee = (entryValue * entryFeeBps) / 10000;
        const exitFee = (exitValue * exitFeeBps) / 10000;
        const totalFees = entryFee + exitFee;

        // Calculate P&L
        const side = exitPrice > entryPrice ? 'LONG' : 'SHORT';
        const grossPnl = side === 'LONG'
            ? (exitPrice - entryPrice) * sizeBTC
            : (entryPrice - exitPrice) * sizeBTC;

        const netPnl = grossPnl - totalFees;
        const netPnlPercent = (netPnl / entryValue) * 100;

        // Calculate break-even move needed
        const totalFeeBps = entryFeeBps + exitFeeBps;
        const breakEvenMove = (entryPrice * totalFeeBps) / 10000;

        return {
            grossPnl,
            entryFee,
            exitFee,
            totalFees,
            netPnl,
            netPnlPercent,
            breakEvenMove
        };
    }

    /**
     * Calculate single-side fee
     */
    calculateFee(value: number, isMaker: boolean): number {
        const feeBps = isMaker ? this.config.makerFeeBps : this.config.takerFeeBps;
        return (value * feeBps) / 10000;
    }

    /**
     * Estimate slippage cost
     */
    estimateSlippageCost(sizeBTC: number, currentPrice: number, slippageBps: number): number {
        return (currentPrice * sizeBTC * slippageBps) / 10000;
    }

    /**
     * Calculate net entry price after fees
     */
    getNetEntryPrice(rawPrice: number, isMaker: boolean, side: 'LONG' | 'SHORT'): number {
        const feeBps = isMaker ? this.config.makerFeeBps : this.config.takerFeeBps;
        const feeMultiplier = feeBps / 10000;

        if (side === 'LONG') {
            return rawPrice * (1 + feeMultiplier);
        } else {
            return rawPrice * (1 - feeMultiplier);
        }
    }

    /**
     * Get minimum profitable move (in price)
     */
    getMinProfitableMove(entryPrice: number, isMakerEntry: boolean, isMakerExit: boolean): number {
        const entryFeeBps = isMakerEntry ? this.config.makerFeeBps : this.config.takerFeeBps;
        const exitFeeBps = isMakerExit ? this.config.makerFeeBps : this.config.takerFeeBps;
        const totalBps = entryFeeBps + exitFeeBps;
        return (entryPrice * totalBps) / 10000;
    }

    /**
     * Calculate funding cost for a position held over time
     */
    calculateFundingCost(sizeBTC: number, price: number, holdTimeHours: number): number {
        if (!this.config.fundingRateAnnualized) return 0;

        const positionValue = sizeBTC * price;
        const annualCost = positionValue * (this.config.fundingRateAnnualized / 100);
        const hourlyRate = annualCost / (365 * 24);

        return hourlyRate * holdTimeHours;
    }

    /**
     * Get fee configuration
     */
    getConfig(): FeeConfig {
        return { ...this.config };
    }

    /**
     * Update fee configuration
     */
    updateConfig(config: Partial<FeeConfig>): void {
        this.config = { ...this.config, ...config };
    }
}
