/**
 * Order Manager - Order Lifecycle Management
 * Production-grade Bitcoin Scalping Bot
 * 
 * Handles order placement, cancellation, and updates.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Order, OrderSide, OrderType, OrderStatus } from '../types/core.js';
import { OrderBookManager } from '../data/orderbook.js';
import { VetoGate, VetoContext } from '../risk/veto-gate.js';
import { TYPES } from '../di/types.js';

export interface OrderRequest {
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    decisionId?: string;
}

@injectable()
export class OrderManager extends EventEmitter {
    private orders: Map<string, Order> = new Map();
    private openOrders: Set<string> = new Set();
    private isPaperTrading: boolean = true;

    constructor(
        @inject(TYPES.OrderBookManager) private orderBook: OrderBookManager,
        @inject(TYPES.VetoGate) private vetoGate: VetoGate
    ) {
        super();
        console.log('[OrderManager] Initialized in', this.isPaperTrading ? 'PAPER' : 'LIVE', 'mode');
    }

    /**
     * Set trading mode
     */
    setMode(paperTrading: boolean): void {
        this.isPaperTrading = paperTrading;
        console.log('[OrderManager] Mode set to:', paperTrading ? 'PAPER' : 'LIVE');
    }

    /**
     * Submit a new order
     */
    async submitOrder(request: OrderRequest): Promise<Order> {
        const orderId = uuidv4();
        const now = Date.now();

        // Create order object
        const order: Order = {
            id: orderId,
            clientOrderId: `bot_${now}_${orderId.slice(0, 8)}`,
            symbol: 'BTCUSDT',
            side: request.side,
            type: request.type,
            status: 'PENDING',
            timeInForce: request.type === 'POST_ONLY' ? 'POST_ONLY' : 'GTC',
            quantity: request.quantity,
            filledQuantity: 0,
            remainingQuantity: request.quantity,
            price: request.price,
            createdAt: now,
            updatedAt: now,
            decisionId: request.decisionId
        };

        // Store order
        this.orders.set(orderId, order);
        this.emit('orderCreated', order);

        // Submit to exchange (or simulate)
        if (this.isPaperTrading) {
            await this.simulateOrder(order);
        } else {
            await this.submitToExchange(order);
        }

        return order;
    }

    /**
     * Cancel an order
     */
    async cancelOrder(orderId: string): Promise<boolean> {
        const order = this.orders.get(orderId);
        if (!order) return false;

        if (!['PENDING', 'SUBMITTED', 'PARTIAL'].includes(order.status)) {
            return false;
        }

        order.status = 'CANCELLED';
        order.cancelledAt = Date.now();
        order.updatedAt = Date.now();
        this.openOrders.delete(orderId);

        this.emit('orderCancelled', order);
        return true;
    }

    /**
     * Cancel all open orders
     */
    async cancelAllOrders(): Promise<number> {
        let cancelled = 0;
        for (const orderId of this.openOrders) {
            if (await this.cancelOrder(orderId)) {
                cancelled++;
            }
        }
        return cancelled;
    }

    /**
     * Get order by ID
     */
    getOrder(orderId: string): Order | undefined {
        return this.orders.get(orderId);
    }

    /**
     * Get all open orders
     */
    getOpenOrders(): Order[] {
        return Array.from(this.openOrders)
            .map(id => this.orders.get(id))
            .filter((o): o is Order => o !== undefined);
    }

    /**
     * Simulate order execution (paper trading)
     */
    private async simulateOrder(order: Order): Promise<void> {
        // Simulate latency
        await this.sleep(50 + Math.random() * 50);

        order.status = 'SUBMITTED';
        order.submittedAt = Date.now();
        this.openOrders.add(order.id);
        this.emit('orderSubmitted', order);

        // Simulate fill
        if (order.type === 'MARKET') {
            // Market orders fill immediately at current price
            const fillPrice = order.side === 'BUY'
                ? this.orderBook.getBestAsk()
                : this.orderBook.getBestBid();

            await this.fillOrder(order, fillPrice);
        } else if (order.type === 'LIMIT' || order.type === 'POST_ONLY') {
            // Limit orders may fill if price is favorable
            const bestBid = this.orderBook.getBestBid();
            const bestAsk = this.orderBook.getBestAsk();

            if (order.side === 'BUY' && order.price && order.price >= bestAsk) {
                await this.fillOrder(order, order.price);
            } else if (order.side === 'SELL' && order.price && order.price <= bestBid) {
                await this.fillOrder(order, order.price);
            }
            // Otherwise, order stays open until filled or cancelled
        }
    }

    /**
     * Submit to real exchange (placeholder for live trading)
     */
    private async submitToExchange(order: Order): Promise<void> {
        // This would use ccxt or direct exchange API
        throw new Error('Live trading not implemented - use paper trading');
    }

    /**
     * Fill an order
     */
    private async fillOrder(order: Order, fillPrice: number): Promise<void> {
        await this.sleep(10 + Math.random() * 20);

        order.status = 'FILLED';
        order.filledQuantity = order.quantity;
        order.remainingQuantity = 0;
        order.avgFillPrice = fillPrice;
        order.filledAt = Date.now();
        order.updatedAt = Date.now();
        this.openOrders.delete(order.id);

        // Calculate fee (0.05% taker)
        order.feePaid = (fillPrice * order.quantity * 0.0005);
        order.feeAsset = 'USDT';

        this.emit('orderFilled', order);
    }

    /**
     * Check and fill pending limit orders
     */
    async checkPendingFills(): Promise<void> {
        if (!this.isPaperTrading) return;

        const bestBid = this.orderBook.getBestBid();
        const bestAsk = this.orderBook.getBestAsk();

        for (const orderId of this.openOrders) {
            const order = this.orders.get(orderId);
            if (!order || order.status !== 'SUBMITTED') continue;
            if (order.type === 'MARKET') continue;
            if (!order.price) continue;

            // Check if limit order should fill
            if (order.side === 'BUY' && order.price >= bestAsk) {
                await this.fillOrder(order, order.price);
            } else if (order.side === 'SELL' && order.price <= bestBid) {
                await this.fillOrder(order, order.price);
            }
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
