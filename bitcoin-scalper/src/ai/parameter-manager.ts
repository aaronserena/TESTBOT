/**
 * Parameter Manager - Version-Controlled Parameter Updates
 * Production-grade Bitcoin Scalping Bot
 * 
 * Manages AI-proposed parameter changes with versioning, approval flow,
 * and rollback capability.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { ParameterUpdateProposal } from '../types/decision.js';
import { RulebookEngine } from '../risk/rulebook.js';
import { TYPES } from '../di/types.js';

export interface ParameterSet {
    id: string;
    version: number;
    createdAt: number;
    createdBy: 'HUMAN' | 'AI' | 'SYSTEM';
    description: string;
    parameters: {
        // Strategy parameters
        minSignalStrength: number;
        rsiOversoldThreshold: number;
        rsiOverboughtThreshold: number;
        bookImbalanceThreshold: number;
        volumeImbalanceThreshold: number;
        bbPositionLongThreshold: number;
        bbPositionShortThreshold: number;

        // Position sizing
        riskPerTradePct: number;
        atrMultiplierSL: number;
        atrMultiplierTP: number;

        // Timing
        minHoldTimeMs: number;
        maxHoldTimeMs: number;
        decisionIntervalMs: number;
    };
    performance?: {
        trades: number;
        winRate: number;
        sharpeRatio: number;
        maxDrawdown: number;
        pnl: number;
    };
    status: 'ACTIVE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ROLLED_BACK';
}

const DEFAULT_PARAMETERS: ParameterSet['parameters'] = {
    minSignalStrength: 0.5,
    rsiOversoldThreshold: 30,
    rsiOverboughtThreshold: 70,
    bookImbalanceThreshold: 0.3,
    volumeImbalanceThreshold: 0.3,
    bbPositionLongThreshold: 0.1,
    bbPositionShortThreshold: 0.9,
    riskPerTradePct: 1.0,
    atrMultiplierSL: 1.5,
    atrMultiplierTP: 2.5,
    minHoldTimeMs: 5000,
    maxHoldTimeMs: 300000,
    decisionIntervalMs: 1000
};

@injectable()
export class ParameterManager extends EventEmitter {
    private versions: ParameterSet[] = [];
    private activeVersion: ParameterSet;
    private pendingProposals: Map<string, ParameterUpdateProposal> = new Map();

    constructor(
        @inject(TYPES.RulebookEngine) private rulebook: RulebookEngine
    ) {
        super();

        // Initialize with default parameters
        this.activeVersion = {
            id: uuidv4(),
            version: 1,
            createdAt: Date.now(),
            createdBy: 'SYSTEM',
            description: 'Initial default parameters',
            parameters: { ...DEFAULT_PARAMETERS },
            status: 'ACTIVE'
        };
        this.versions.push(this.activeVersion);

        console.log('[ParameterManager] Initialized with version 1');
    }

    /**
     * Get current active parameters
     */
    getActiveParameters(): ParameterSet['parameters'] {
        return { ...this.activeVersion.parameters };
    }

    /**
     * Get active parameter set
     */
    getActiveVersion(): ParameterSet {
        return { ...this.activeVersion };
    }

    /**
     * Propose parameter update
     */
    proposeUpdate(proposal: ParameterUpdateProposal): string {
        const proposalId = uuidv4();

        // Validate against rulebook limits
        const rules = this.rulebook.getRulebook();
        const violations: string[] = [];

        for (const change of proposal.proposedChanges) {
            if (change.parameter === 'minHoldTimeMs' && change.newValue < rules.minHoldTimeMs) {
                violations.push(`minHoldTimeMs cannot be less than rulebook minimum ${rules.minHoldTimeMs}`);
            }
            if (change.parameter === 'maxHoldTimeMs' && change.newValue > rules.maxHoldTimeMs) {
                violations.push(`maxHoldTimeMs cannot exceed rulebook maximum ${rules.maxHoldTimeMs}`);
            }
        }

        if (violations.length > 0) {
            console.warn('[ParameterManager] Proposal rejected:', violations);
            this.emit('proposalRejected', { proposalId, violations });
            return proposalId;
        }

        this.pendingProposals.set(proposalId, {
            ...proposal,
            requestId: proposalId
        });

        console.log(`[ParameterManager] New proposal ${proposalId.slice(0, 8)} with ${proposal.proposedChanges.length} changes`);
        this.emit('proposalCreated', { proposalId, proposal });

        return proposalId;
    }

    /**
     * Approve and apply a proposal
     */
    approveProposal(proposalId: string, approvedBy: 'HUMAN' | 'AI'): boolean {
        const proposal = this.pendingProposals.get(proposalId);
        if (!proposal) {
            console.warn('[ParameterManager] Proposal not found:', proposalId);
            return false;
        }

        // Create new version
        const newVersion: ParameterSet = {
            id: uuidv4(),
            version: this.activeVersion.version + 1,
            createdAt: Date.now(),
            createdBy: approvedBy,
            description: proposal.rationale,
            parameters: { ...this.activeVersion.parameters },
            status: 'ACTIVE'
        };

        // Apply changes
        for (const change of proposal.proposedChanges) {
            const key = change.parameter as keyof ParameterSet['parameters'];
            if (key in newVersion.parameters) {
                (newVersion.parameters[key] as number) = change.newValue;
            }
        }

        // Deactivate old version
        this.activeVersion.status = 'APPROVED';

        // Activate new version
        this.activeVersion = newVersion;
        this.versions.push(newVersion);
        this.pendingProposals.delete(proposalId);

        console.log(`[ParameterManager] Approved proposal, now on version ${newVersion.version}`);
        this.emit('versionActivated', { version: newVersion });

        return true;
    }

    /**
     * Reject a proposal
     */
    rejectProposal(proposalId: string, reason: string): boolean {
        const proposal = this.pendingProposals.get(proposalId);
        if (!proposal) return false;

        this.pendingProposals.delete(proposalId);
        this.emit('proposalRejected', { proposalId, reason });

        return true;
    }

    /**
     * Rollback to a previous version
     */
    rollback(targetVersion: number): boolean {
        const target = this.versions.find(v => v.version === targetVersion);
        if (!target) {
            console.warn('[ParameterManager] Version not found:', targetVersion);
            return false;
        }

        // Create rollback version
        const rollbackVersion: ParameterSet = {
            id: uuidv4(),
            version: this.activeVersion.version + 1,
            createdAt: Date.now(),
            createdBy: 'HUMAN',
            description: `Rollback to version ${targetVersion}`,
            parameters: { ...target.parameters },
            status: 'ACTIVE'
        };

        this.activeVersion.status = 'ROLLED_BACK';
        this.activeVersion = rollbackVersion;
        this.versions.push(rollbackVersion);

        console.log(`[ParameterManager] Rolled back to v${targetVersion}, now on v${rollbackVersion.version}`);
        this.emit('rollback', { from: this.activeVersion.version - 1, to: targetVersion });

        return true;
    }

    /**
     * Record performance for current version
     */
    recordPerformance(trades: number, winRate: number, sharpeRatio: number, maxDrawdown: number, pnl: number): void {
        this.activeVersion.performance = {
            trades,
            winRate,
            sharpeRatio,
            maxDrawdown,
            pnl
        };
    }

    /**
     * Get version history
     */
    getVersionHistory(): ParameterSet[] {
        return [...this.versions];
    }

    /**
     * Get pending proposals
     */
    getPendingProposals(): ParameterUpdateProposal[] {
        return Array.from(this.pendingProposals.values());
    }

    /**
     * Export all versions as JSON
     */
    exportJSON(): string {
        return JSON.stringify(this.versions, null, 2);
    }
}
