/**
 * Order Retry Manager - Fault-Tolerant Order Handling
 * Production-grade Bitcoin Scalping Bot
 * 
 * Handles order retries, cancel-replace logic, and graceful degradation.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { Order, OrderStatus } from '../types/core.js';
import { OrderManager, OrderRequest } from './order-manager.js';
import { TYPES } from '../di/types.js';

export interface RetryConfig {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
    cancelTimeoutMs: number;
    replaceThresholdMs: number;
}

interface PendingRetry {
    originalOrder: Order;
    request: OrderRequest;
    attempts: number;
    lastAttemptAt: number;
    status: 'PENDING' | 'RETRYING' | 'CANCELLED' | 'COMPLETED' | 'FAILED';
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    retryDelayMs: 500,
    exponentialBackoff: true,
    cancelTimeoutMs: 5000,
    replaceThresholdMs: 2000
};

@injectable()
export class OrderRetryManager extends EventEmitter {
    private config: RetryConfig;
    private pendingRetries: Map<string, PendingRetry> = new Map();
    private retryTimer: NodeJS.Timeout | null = null;

    constructor(
        @inject(TYPES.OrderManager) private orderManager: OrderManager
    ) {
        super();
        this.config = { ...DEFAULT_CONFIG };
        this.setupOrderListeners();
        console.log('[OrderRetryManager] Initialized');
    }

    /**
     * Configure retry behavior
     */
    configure(config: Partial<RetryConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Submit order with retry capability
     */
    async submitWithRetry(request: OrderRequest): Promise<Order> {
        try {
            const order = await this.orderManager.submitOrder(request);

            // Track for potential retry
            this.pendingRetries.set(order.id, {
                originalOrder: order,
                request,
                attempts: 1,
                lastAttemptAt: Date.now(),
                status: 'PENDING'
            });

            return order;
        } catch (error) {
            console.error('[OrderRetryManager] Initial submission failed:', error);
            throw error;
        }
    }

    /**
     * Cancel and replace an order with new price
     */
    async cancelAndReplace(orderId: string, newPrice: number): Promise<Order | null> {
        const pending = this.pendingRetries.get(orderId);
        if (!pending) {
            console.warn('[OrderRetryManager] Order not found for replacement:', orderId);
            return null;
        }

        // Cancel original order
        const cancelled = await this.orderManager.cancelOrder(orderId);
        if (!cancelled) {
            console.warn('[OrderRetryManager] Failed to cancel order:', orderId);
            return null;
        }

        // Submit new order at new price
        const newRequest: OrderRequest = {
            ...pending.request,
            price: newPrice
        };

        try {
            const newOrder = await this.orderManager.submitOrder(newRequest);

            // Update tracking
            this.pendingRetries.delete(orderId);
            this.pendingRetries.set(newOrder.id, {
                originalOrder: newOrder,
                request: newRequest,
                attempts: pending.attempts + 1,
                lastAttemptAt: Date.now(),
                status: 'PENDING'
            });

            console.log(`[OrderRetryManager] Replaced ${orderId.slice(0, 8)} with ${newOrder.id.slice(0, 8)} at $${newPrice}`);
            this.emit('orderReplaced', { oldOrderId: orderId, newOrder });

            return newOrder;
        } catch (error) {
            console.error('[OrderRetryManager] Replacement failed:', error);
            this.emit('replaceFailed', { orderId, error });
            return null;
        }
    }

    /**
     * Set up listeners for order events
     */
    private setupOrderListeners(): void {
        this.orderManager.on('orderFilled', (order: Order) => {
            const pending = this.pendingRetries.get(order.id);
            if (pending) {
                pending.status = 'COMPLETED';
                this.pendingRetries.delete(order.id);
            }
        });

        this.orderManager.on('orderCancelled', (order: Order) => {
            const pending = this.pendingRetries.get(order.id);
            if (pending && pending.status === 'PENDING') {
                // Check if we should retry
                if (pending.attempts < this.config.maxRetries) {
                    this.scheduleRetry(order.id);
                } else {
                    pending.status = 'FAILED';
                    this.emit('maxRetriesReached', { orderId: order.id, attempts: pending.attempts });
                }
            }
        });
    }

    /**
     * Schedule a retry for an order
     */
    private scheduleRetry(orderId: string): void {
        const pending = this.pendingRetries.get(orderId);
        if (!pending) return;

        const delay = this.config.exponentialBackoff
            ? this.config.retryDelayMs * Math.pow(2, pending.attempts - 1)
            : this.config.retryDelayMs;

        pending.status = 'RETRYING';

        setTimeout(async () => {
            try {
                const newOrder = await this.orderManager.submitOrder(pending.request);

                this.pendingRetries.delete(orderId);
                this.pendingRetries.set(newOrder.id, {
                    originalOrder: newOrder,
                    request: pending.request,
                    attempts: pending.attempts + 1,
                    lastAttemptAt: Date.now(),
                    status: 'PENDING'
                });

                console.log(`[OrderRetryManager] Retry ${pending.attempts + 1} for ${orderId.slice(0, 8)}`);
                this.emit('orderRetried', { originalOrderId: orderId, newOrder, attempt: pending.attempts + 1 });
            } catch (error) {
                console.error('[OrderRetryManager] Retry failed:', error);
                pending.status = 'FAILED';
                this.emit('retryFailed', { orderId, error, attempt: pending.attempts });
            }
        }, delay);
    }

    /**
     * Cancel all pending retries
     */
    cancelAllRetries(): void {
        for (const [orderId, pending] of this.pendingRetries) {
            if (pending.status === 'RETRYING' || pending.status === 'PENDING') {
                pending.status = 'CANCELLED';
                this.orderManager.cancelOrder(orderId).catch(() => { });
            }
        }
        this.pendingRetries.clear();
    }

    /**
     * Get retry statistics
     */
    getStats(): {
        pending: number;
        retrying: number;
        completed: number;
        failed: number;
    } {
        const stats = { pending: 0, retrying: 0, completed: 0, failed: 0 };
        for (const pending of this.pendingRetries.values()) {
            switch (pending.status) {
                case 'PENDING': stats.pending++; break;
                case 'RETRYING': stats.retrying++; break;
                case 'COMPLETED': stats.completed++; break;
                case 'FAILED': stats.failed++; break;
            }
        }
        return stats;
    }
}
