/**
 * WebSocket Client - Low-Latency Market Data Connection
 * Production-grade Bitcoin Scalping Bot
 * 
 * Connects to Binance Futures WebSocket for real-time market data.
 */

import { injectable } from 'inversify';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketConfig {
    baseUrl: string;
    symbol: string;
    reconnectDelay: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
    baseUrl: 'wss://fstream.binance.com',
    symbol: 'btcusdt',
    reconnectDelay: 1000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000
};

export type StreamType =
    | 'depth'      // Order book updates
    | 'trade'      // Individual trades
    | 'kline'      // Candlestick updates
    | 'bookTicker' // Best bid/ask
    | 'aggTrade';  // Aggregated trades

@injectable()
export class WebSocketClient extends EventEmitter {
    private config: WebSocketConfig;
    private connections: Map<string, WebSocket> = new Map();
    private reconnectAttempts: Map<string, number> = new Map();
    private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
    private isShuttingDown = false;
    private latencyMs: number = 0;
    private lastMessageTime: number = 0;

    constructor(config: Partial<WebSocketConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[WebSocketClient] Initialized');
    }

    /**
     * Connect to a specific stream
     */
    async connect(streamType: StreamType, interval?: string): Promise<void> {
        const streamName = this.getStreamName(streamType, interval);
        const url = `${this.config.baseUrl}/ws/${streamName}`;

        return new Promise((resolve, reject) => {
            if (this.connections.has(streamName)) {
                console.log(`[WebSocket] Already connected to ${streamName}`);
                resolve();
                return;
            }

            console.log(`[WebSocket] Connecting to ${streamName}...`);
            const ws = new WebSocket(url);

            ws.on('open', () => {
                console.log(`[WebSocket] Connected to ${streamName}`);
                this.reconnectAttempts.set(streamName, 0);
                this.connections.set(streamName, ws);
                this.startHeartbeat(streamName, ws);
                this.emit('connected', { stream: streamName });
                resolve();
            });

            ws.on('message', (data: WebSocket.RawData) => {
                const receiveTime = Date.now();
                try {
                    const parsed = JSON.parse(data.toString());

                    // Calculate latency from exchange timestamp if available
                    if (parsed.E) {
                        this.latencyMs = receiveTime - parsed.E;
                    }
                    this.lastMessageTime = receiveTime;

                    this.emit('message', {
                        stream: streamName,
                        type: streamType,
                        data: parsed,
                        latencyMs: this.latencyMs,
                        receivedAt: receiveTime
                    });
                } catch (error) {
                    console.error(`[WebSocket] Parse error on ${streamName}:`, error);
                }
            });

            ws.on('error', (error) => {
                console.error(`[WebSocket] Error on ${streamName}:`, error.message);
                this.emit('error', { stream: streamName, error });
            });

            ws.on('close', (code, reason) => {
                console.log(`[WebSocket] Closed ${streamName}: ${code} ${reason}`);
                this.stopHeartbeat(streamName);
                this.connections.delete(streamName);
                this.emit('disconnected', { stream: streamName, code, reason: reason.toString() });

                if (!this.isShuttingDown) {
                    this.attemptReconnect(streamType, interval);
                }
            });

            ws.on('ping', () => {
                ws.pong();
            });

            // Timeout for initial connection
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    ws.terminate();
                    reject(new Error(`Connection timeout for ${streamName}`));
                }
            }, 10000);
        });
    }

    /**
     * Connect to multiple streams
     */
    async connectAll(): Promise<void> {
        await Promise.all([
            this.connect('depth'),           // Order book
            this.connect('aggTrade'),        // Aggregated trades
            this.connect('kline', '1m'),     // 1-minute candles
            this.connect('kline', '5m'),     // 5-minute candles
            this.connect('bookTicker')       // Best bid/ask
        ]);
        console.log('[WebSocket] All streams connected');
    }

    /**
     * Disconnect from a specific stream
     */
    disconnect(streamType: StreamType, interval?: string): void {
        const streamName = this.getStreamName(streamType, interval);
        const ws = this.connections.get(streamName);

        if (ws) {
            this.stopHeartbeat(streamName);
            ws.close(1000, 'Normal closure');
            this.connections.delete(streamName);
            console.log(`[WebSocket] Disconnected from ${streamName}`);
        }
    }

    /**
     * Disconnect all streams
     */
    disconnectAll(): void {
        this.isShuttingDown = true;
        for (const [streamName, ws] of this.connections) {
            this.stopHeartbeat(streamName);
            ws.close(1000, 'Shutdown');
        }
        this.connections.clear();
        console.log('[WebSocket] All streams disconnected');
    }

    /**
     * Get current latency
     */
    getLatency(): number {
        return this.latencyMs;
    }

    /**
     * Check if connected to a stream
     */
    isConnected(streamType: StreamType, interval?: string): boolean {
        const streamName = this.getStreamName(streamType, interval);
        const ws = this.connections.get(streamName);
        return ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get time since last message
     */
    getTimeSinceLastMessage(): number {
        return Date.now() - this.lastMessageTime;
    }

    /**
     * Get stream name for a stream type
     */
    private getStreamName(streamType: StreamType, interval?: string): string {
        const symbol = this.config.symbol.toLowerCase();

        switch (streamType) {
            case 'depth':
                return `${symbol}@depth@100ms`;
            case 'trade':
                return `${symbol}@trade`;
            case 'aggTrade':
                return `${symbol}@aggTrade`;
            case 'kline':
                return `${symbol}@kline_${interval || '1m'}`;
            case 'bookTicker':
                return `${symbol}@bookTicker`;
            default:
                return `${symbol}@${streamType}`;
        }
    }

    /**
     * Start heartbeat monitoring
     */
    private startHeartbeat(streamName: string, ws: WebSocket): void {
        const timer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            }
        }, this.config.heartbeatInterval);

        this.heartbeatTimers.set(streamName, timer);
    }

    /**
     * Stop heartbeat monitoring
     */
    private stopHeartbeat(streamName: string): void {
        const timer = this.heartbeatTimers.get(streamName);
        if (timer) {
            clearInterval(timer);
            this.heartbeatTimers.delete(streamName);
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    private async attemptReconnect(streamType: StreamType, interval?: string): Promise<void> {
        const streamName = this.getStreamName(streamType, interval);
        const attempts = (this.reconnectAttempts.get(streamName) || 0) + 1;

        if (attempts > this.config.maxReconnectAttempts) {
            console.error(`[WebSocket] Max reconnect attempts reached for ${streamName}`);
            this.emit('maxReconnectReached', { stream: streamName });
            return;
        }

        this.reconnectAttempts.set(streamName, attempts);
        const delay = this.config.reconnectDelay * Math.pow(2, attempts - 1);

        console.log(`[WebSocket] Reconnecting to ${streamName} in ${delay}ms (attempt ${attempts})`);

        await this.sleep(delay);

        try {
            await this.connect(streamType, interval);
        } catch (error) {
            console.error(`[WebSocket] Reconnect failed for ${streamName}:`, error);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
