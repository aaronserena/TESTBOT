/**
 * Volume Profile Calculator
 * Production-grade Bitcoin Scalping Bot
 * 
 * Calculates volume profile for support/resistance identification.
 */

import { injectable, inject } from 'inversify';
import type { Candle } from '../types/core.js';
import { CandleAggregator } from '../data/candle-aggregator.js';
import { TradeTapeProcessor } from '../data/trade-tape.js';
import { TYPES } from '../di/types.js';

export interface VolumeNode {
    priceLevel: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
    isHVN: boolean;  // High Volume Node
    isLVN: boolean;  // Low Volume Node
    isPOC: boolean;  // Point of Control
}

export interface VolumeProfile {
    startTime: number;
    endTime: number;
    nodes: VolumeNode[];
    poc: number;           // Point of Control (highest volume price)
    vah: number;           // Value Area High
    val: number;           // Value Area Low
    valueAreaVolume: number;
    totalVolume: number;
}

@injectable()
export class VolumeProfileCalculator {
    private profiles: Map<string, VolumeProfile> = new Map();
    private bucketSize: number = 50; // $50 price buckets

    constructor(
        @inject(TYPES.CandleAggregator) private candles: CandleAggregator,
        @inject(TYPES.TradeTapeProcessor) private tradeTape: TradeTapeProcessor
    ) {
        console.log('[VolumeProfileCalculator] Initialized');
    }

    /**
     * Calculate volume profile from candle data
     */
    calculate(timeframeName: string = 'session'): VolumeProfile {
        const candles = this.candles.getCandles('5m', 288); // Last 24 hours
        if (candles.length === 0) {
            return this.createEmptyProfile();
        }

        const startTime = candles[0].openTime;
        const endTime = candles[candles.length - 1].closeTime;

        // Find price range
        const prices = candles.flatMap(c => [c.high, c.low]);
        const minPrice = Math.floor(Math.min(...prices) / this.bucketSize) * this.bucketSize;
        const maxPrice = Math.ceil(Math.max(...prices) / this.bucketSize) * this.bucketSize;

        // Create buckets
        const buckets: Map<number, { volume: number; buyVolume: number; sellVolume: number }> = new Map();

        for (let price = minPrice; price <= maxPrice; price += this.bucketSize) {
            buckets.set(price, { volume: 0, buyVolume: 0, sellVolume: 0 });
        }

        // Distribute volume into buckets
        for (const candle of candles) {
            const bucketLow = Math.floor(candle.low / this.bucketSize) * this.bucketSize;
            const bucketHigh = Math.ceil(candle.high / this.bucketSize) * this.bucketSize;
            const numBuckets = (bucketHigh - bucketLow) / this.bucketSize + 1;
            const volumePerBucket = candle.volume / numBuckets;

            // Estimate buy/sell split from candle direction
            const isBuyCandle = candle.close > candle.open;
            const buyRatio = isBuyCandle ? 0.6 : 0.4;

            for (let price = bucketLow; price <= bucketHigh; price += this.bucketSize) {
                const bucket = buckets.get(price);
                if (bucket) {
                    bucket.volume += volumePerBucket;
                    bucket.buyVolume += volumePerBucket * buyRatio;
                    bucket.sellVolume += volumePerBucket * (1 - buyRatio);
                }
            }
        }

        // Convert to nodes array
        const nodes: VolumeNode[] = [];
        let maxVolume = 0;
        let pocPrice = 0;
        let totalVolume = 0;

        for (const [price, bucket] of buckets) {
            totalVolume += bucket.volume;
            if (bucket.volume > maxVolume) {
                maxVolume = bucket.volume;
                pocPrice = price;
            }

            nodes.push({
                priceLevel: price,
                volume: bucket.volume,
                buyVolume: bucket.buyVolume,
                sellVolume: bucket.sellVolume,
                delta: bucket.buyVolume - bucket.sellVolume,
                isHVN: false,
                isLVN: false,
                isPOC: false
            });
        }

        // Sort by price
        nodes.sort((a, b) => a.priceLevel - b.priceLevel);

        // Identify HVN, LVN, POC
        const avgVolume = totalVolume / nodes.length;
        for (const node of nodes) {
            node.isPOC = node.priceLevel === pocPrice;
            node.isHVN = node.volume > avgVolume * 1.5;
            node.isLVN = node.volume < avgVolume * 0.5;
        }

        // Calculate Value Area (70% of volume)
        const valueAreaThreshold = totalVolume * 0.7;
        const { vah, val, valueAreaVolume } = this.calculateValueArea(nodes, pocPrice, valueAreaThreshold);

        const profile: VolumeProfile = {
            startTime,
            endTime,
            nodes,
            poc: pocPrice,
            vah,
            val,
            valueAreaVolume,
            totalVolume
        };

        this.profiles.set(timeframeName, profile);
        return profile;
    }

    /**
     * Calculate Value Area (70% of volume around POC)
     */
    private calculateValueArea(
        nodes: VolumeNode[],
        pocPrice: number,
        threshold: number
    ): { vah: number; val: number; valueAreaVolume: number } {
        const pocIndex = nodes.findIndex(n => n.priceLevel === pocPrice);
        if (pocIndex === -1) {
            return { vah: pocPrice, val: pocPrice, valueAreaVolume: 0 };
        }

        let valueAreaVolume = nodes[pocIndex].volume;
        let upperIndex = pocIndex;
        let lowerIndex = pocIndex;

        while (valueAreaVolume < threshold && (upperIndex < nodes.length - 1 || lowerIndex > 0)) {
            const upperVol = upperIndex < nodes.length - 1 ? nodes[upperIndex + 1].volume : 0;
            const lowerVol = lowerIndex > 0 ? nodes[lowerIndex - 1].volume : 0;

            if (upperVol >= lowerVol && upperIndex < nodes.length - 1) {
                upperIndex++;
                valueAreaVolume += nodes[upperIndex].volume;
            } else if (lowerIndex > 0) {
                lowerIndex--;
                valueAreaVolume += nodes[lowerIndex].volume;
            } else {
                break;
            }
        }

        return {
            vah: nodes[upperIndex].priceLevel,
            val: nodes[lowerIndex].priceLevel,
            valueAreaVolume
        };
    }

    /**
     * Get nearest support/resistance from volume profile
     */
    getNearestLevels(currentPrice: number): {
        nearestSupport: number;
        nearestResistance: number;
        poc: number;
    } {
        const profile = this.profiles.get('session') || this.calculate();

        // Find HVN levels as support/resistance
        const hvnNodes = profile.nodes.filter(n => n.isHVN);

        let nearestSupport = profile.val;
        let nearestResistance = profile.vah;

        for (const node of hvnNodes) {
            if (node.priceLevel < currentPrice && node.priceLevel > nearestSupport) {
                nearestSupport = node.priceLevel;
            }
            if (node.priceLevel > currentPrice && node.priceLevel < nearestResistance) {
                nearestResistance = node.priceLevel;
            }
        }

        return {
            nearestSupport,
            nearestResistance,
            poc: profile.poc
        };
    }

    /**
     * Create empty profile
     */
    private createEmptyProfile(): VolumeProfile {
        return {
            startTime: Date.now(),
            endTime: Date.now(),
            nodes: [],
            poc: 0,
            vah: 0,
            val: 0,
            valueAreaVolume: 0,
            totalVolume: 0
        };
    }
}
