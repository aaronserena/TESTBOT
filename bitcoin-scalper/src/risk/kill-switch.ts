/**
 * Kill Switch - Emergency Trading Halt
 * Production-grade Bitcoin Scalping Bot
 * 
 * Global emergency stop mechanism that halts ALL trading activity.
 * Can be triggered manually or automatically based on critical conditions.
 */

import { injectable, inject } from 'inversify';
import { EventEmitter } from 'events';
import type { KillSwitchState } from '../types/risk.js';
import { TYPES } from '../di/types.js';

export type KillSwitchTrigger =
    | 'MANUAL'
    | 'AUTO_DRAWDOWN'
    | 'AUTO_LOSS'
    | 'AUTO_ERROR'
    | 'SYSTEM';

@injectable()
export class KillSwitch extends EventEmitter {
    private state: KillSwitchState;
    private cooldownMs: number = 300000; // 5 minute cooldown

    constructor() {
        super();
        this.state = {
            active: false
        };
        console.log('[KillSwitch] Initialized - Emergency stop ready');
    }

    /**
     * Check if kill switch is currently active
     */
    isActive(): boolean {
        return this.state.active;
    }

    /**
     * Get current kill switch state
     */
    getState(): Readonly<KillSwitchState> {
        return { ...this.state };
    }

    /**
     * Activate the kill switch (HALT ALL TRADING)
     */
    activate(trigger: KillSwitchTrigger, reason: string): void {
        if (this.state.active) {
            console.warn('[KillSwitch] Already active, ignoring duplicate activation');
            return;
        }

        this.state = {
            active: true,
            activatedAt: Date.now(),
            activatedBy: trigger,
            reason,
            canReactivateAt: Date.now() + this.cooldownMs
        };

        console.error('━'.repeat(60));
        console.error('[KILL SWITCH ACTIVATED]');
        console.error(`Trigger: ${trigger}`);
        console.error(`Reason: ${reason}`);
        console.error(`Time: ${new Date().toISOString()}`);
        console.error('━'.repeat(60));

        // Emit event for other modules to react
        this.emit('activated', {
            trigger,
            reason,
            timestamp: Date.now()
        });
    }

    /**
     * Deactivate the kill switch (RESUME TRADING)
     * Requires explicit manual confirmation
     */
    deactivate(confirmation: string): boolean {
        if (!this.state.active) {
            console.warn('[KillSwitch] Not active, nothing to deactivate');
            return false;
        }

        // Require explicit confirmation
        if (confirmation !== 'CONFIRM_RESUME_TRADING') {
            console.error('[KillSwitch] Invalid confirmation. Use "CONFIRM_RESUME_TRADING"');
            return false;
        }

        // Check cooldown
        if (this.state.canReactivateAt && Date.now() < this.state.canReactivateAt) {
            const remainingMs = this.state.canReactivateAt - Date.now();
            console.error(`[KillSwitch] Cooldown active. Cannot resume for ${Math.ceil(remainingMs / 1000)} seconds`);
            return false;
        }

        console.log('━'.repeat(60));
        console.log('[KILL SWITCH DEACTIVATED]');
        console.log(`Was active for: ${Date.now() - (this.state.activatedAt || 0)}ms`);
        console.log(`Time: ${new Date().toISOString()}`);
        console.log('━'.repeat(60));

        this.state = {
            active: false
        };

        this.emit('deactivated', { timestamp: Date.now() });
        return true;
    }

    /**
     * Auto-activate based on drawdown threshold
     */
    checkDrawdownTrigger(currentDrawdownPercent: number, threshold: number): void {
        if (currentDrawdownPercent >= threshold && !this.state.active) {
            this.activate('AUTO_DRAWDOWN', `Drawdown ${currentDrawdownPercent.toFixed(2)}% exceeded threshold ${threshold}%`);
        }
    }

    /**
     * Auto-activate based on daily loss threshold
     */
    checkDailyLossTrigger(dailyLossPercent: number, threshold: number): void {
        if (dailyLossPercent >= threshold && !this.state.active) {
            this.activate('AUTO_LOSS', `Daily loss ${dailyLossPercent.toFixed(2)}% exceeded threshold ${threshold}%`);
        }
    }

    /**
     * Auto-activate based on critical error
     */
    triggerOnError(error: Error): void {
        if (!this.state.active) {
            this.activate('AUTO_ERROR', `Critical error: ${error.message}`);
        }
    }

    /**
     * Set cooldown duration
     */
    setCooldown(ms: number): void {
        this.cooldownMs = Math.max(60000, ms); // Minimum 1 minute
        console.log(`[KillSwitch] Cooldown set to ${this.cooldownMs}ms`);
    }

    /**
     * Get time remaining until can resume (if in cooldown)
     */
    getCooldownRemaining(): number {
        if (!this.state.active || !this.state.canReactivateAt) {
            return 0;
        }
        return Math.max(0, this.state.canReactivateAt - Date.now());
    }
}
