/**
 * News Aggregator - Sandboxed News Ingestion
 * Production-grade Bitcoin Scalping Bot
 * 
 * Ingests whitelisted high-impact Bitcoin-related sources and outputs
 * structured, timestamped events with sentiment and impact classification.
 */

import { injectable } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import type {
    NewsEvent,
    NewsSource,
    NewsFeedState,
    NewsImpactAssessment,
    Sentiment,
    ImpactLevel
} from '../types/news.js';
import { WHITELISTED_NEWS_SOURCES } from '../types/news.js';

@injectable()
export class NewsAggregator extends EventEmitter {
    private events: NewsEvent[] = [];
    private maxEvents: number = 1000;
    private state: NewsFeedState;
    private pollIntervalMs: number = 60000; // 1 minute
    private pollTimer: NodeJS.Timeout | null = null;

    constructor() {
        super();
        this.state = {
            isConnected: false,
            pendingEvents: 0,
            highImpactEvents24h: 0
        };
        console.log('[NewsAggregator] Initialized with', WHITELISTED_NEWS_SOURCES.length, 'whitelisted sources');
    }

    /**
     * Start polling news sources
     */
    start(): void {
        if (this.pollTimer) return;

        this.state.isConnected = true;
        console.log('[NewsAggregator] Started polling');

        // Initial poll
        this.pollSources();

        // Set up interval
        this.pollTimer = setInterval(() => {
            this.pollSources();
        }, this.pollIntervalMs);
    }

    /**
     * Stop polling
     */
    stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.state.isConnected = false;
        console.log('[NewsAggregator] Stopped polling');
    }

    /**
     * Poll all whitelisted sources
     */
    private async pollSources(): Promise<void> {
        for (const source of WHITELISTED_NEWS_SOURCES) {
            if (!source.enabled) continue;

            try {
                // In production, this would fetch from actual RSS/API
                // For now, we simulate with placeholder logic
                await this.fetchFromSource(source);
            } catch (error) {
                console.error(`[NewsAggregator] Error polling ${source.name}:`, error);
                this.state.lastError = `Failed to fetch from ${source.name}`;
            }
        }

        this.state.lastUpdateAt = Date.now();
        this.updateStats();
    }

    /**
     * Fetch from a single source (placeholder)
     */
    private async fetchFromSource(source: NewsSource): Promise<void> {
        // This is a placeholder - in production, implement actual RSS/API fetching
        // For now, we just update the state

        // Simulate network delay
        await this.sleep(100);

        // In production:
        // const response = await axios.get(source.url);
        // const headlines = parseRSS(response.data);
        // for (const headline of headlines) {
        //   const event = this.createNewsEvent(source, headline);
        //   this.addEvent(event);
        // }
    }

    /**
     * Add a news event manually (for testing or direct API input)
     */
    addEvent(event: Omit<NewsEvent, 'id' | 'ingestedAt' | 'expiresAt' | 'processed'>): void {
        const fullEvent: NewsEvent = {
            ...event,
            id: uuidv4(),
            ingestedAt: Date.now(),
            expiresAt: Date.now() + 86400000, // 24 hours
            processed: false
        };

        this.events.push(fullEvent);

        // Trim old events
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        this.state.pendingEvents++;
        this.emit('newEvent', fullEvent);

        if (fullEvent.impactLevel === 'HIGH' || fullEvent.impactLevel === 'CRITICAL') {
            console.warn(`[NewsAggregator] HIGH IMPACT NEWS: ${fullEvent.title}`);
            this.emit('highImpactNews', fullEvent);
        }
    }

    /**
     * Get pending news events
     */
    getPendingEvents(): NewsEvent[] {
        return this.events.filter(e => !e.processed);
    }

    /**
     * Get high impact events
     */
    getHighImpactEvents(windowMs: number = 86400000): NewsEvent[] {
        const cutoff = Date.now() - windowMs;
        return this.events.filter(e =>
            (e.impactLevel === 'HIGH' || e.impactLevel === 'CRITICAL') &&
            e.publishedAt > cutoff
        );
    }

    /**
     * Mark event as processed
     */
    markProcessed(eventId: string): void {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.processed = true;
            this.state.pendingEvents = Math.max(0, this.state.pendingEvents - 1);
        }
    }

    /**
     * Get impact assessment for trading decisions
     */
    getImpactAssessment(): NewsImpactAssessment {
        const now = Date.now();
        const highImpact = this.getHighImpactEvents(3600000); // Last hour
        const pending = this.getPendingEvents();

        const hasHighImpact = highImpact.length > 0;
        const criticalNews = highImpact.filter(e => e.impactLevel === 'CRITICAL');

        let shouldAvoidTrading = false;
        let shouldReduceSize = false;
        let sizeMultiplier = 1;
        let reason = 'No significant news';

        if (criticalNews.length > 0) {
            shouldAvoidTrading = true;
            sizeMultiplier = 0;
            reason = `Critical news alert: ${criticalNews[0].title}`;
        } else if (highImpact.length > 0) {
            shouldReduceSize = true;
            sizeMultiplier = 0.5;
            reason = `High impact news: ${highImpact[0].title}`;
        }

        return {
            timestamp: now,
            hasHighImpactNews: hasHighImpact,
            hasPendingScheduledEvent: false, // Would integrate with calendar
            shouldReduceSize,
            sizeMultiplier,
            shouldAvoidTrading,
            relevantEvents: highImpact.map(e => e.id),
            reason
        };
    }

    /**
     * Get feed state
     */
    getState(): NewsFeedState {
        return { ...this.state };
    }

    /**
     * Update statistics
     */
    private updateStats(): void {
        const now = Date.now();
        const dayAgo = now - 86400000;

        this.state.pendingEvents = this.events.filter(e => !e.processed).length;
        this.state.highImpactEvents24h = this.events.filter(e =>
            (e.impactLevel === 'HIGH' || e.impactLevel === 'CRITICAL') &&
            e.publishedAt > dayAgo
        ).length;
    }

    /**
     * Classify sentiment from text (placeholder - would use NLP in production)
     */
    classifySentiment(text: string): { sentiment: Sentiment; confidence: number } {
        // Placeholder sentiment analysis
        const bullishWords = ['surge', 'rally', 'bullish', 'gain', 'high', 'adoption', 'approval'];
        const bearishWords = ['crash', 'drop', 'bearish', 'loss', 'low', 'ban', 'hack', 'regulation'];

        const lowerText = text.toLowerCase();
        const bullishCount = bullishWords.filter(w => lowerText.includes(w)).length;
        const bearishCount = bearishWords.filter(w => lowerText.includes(w)).length;

        if (bullishCount > bearishCount + 1) {
            return { sentiment: 'BULLISH', confidence: 0.6 };
        } else if (bearishCount > bullishCount + 1) {
            return { sentiment: 'BEARISH', confidence: 0.6 };
        }

        return { sentiment: 'NEUTRAL', confidence: 0.5 };
    }

    /**
     * Classify impact level (placeholder)
     */
    classifyImpact(text: string, source: NewsSource): { impact: ImpactLevel; confidence: number } {
        const highImpactWords = ['etf', 'sec', 'fed', 'regulation', 'ban', 'hack', 'crash', 'billion'];
        const lowerText = text.toLowerCase();

        const highImpactCount = highImpactWords.filter(w => lowerText.includes(w)).length;

        if (highImpactCount >= 2) {
            return { impact: 'HIGH', confidence: 0.7 };
        } else if (highImpactCount >= 1) {
            return { impact: 'MEDIUM', confidence: 0.6 };
        }

        return { impact: 'LOW', confidence: 0.5 };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
