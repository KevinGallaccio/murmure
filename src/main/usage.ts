import {
  appendSession,
  bumpTotalSeconds,
  getRatePerHour,
  getUsage,
  resetUsage as resetUsageStore,
  setRatePerHour as setRatePerHourStore,
} from './settings';
import type { UsageUpdate } from '../shared/ipc';
import { USAGE_CHECKPOINT_INTERVAL_MS } from '../shared/constants';

export type UsageBroadcaster = (payload: UsageUpdate) => void;

class UsageTracker {
  private sessionStartMs: number | null = null;
  private lastCheckpointMs: number | null = null;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private broadcaster: UsageBroadcaster | null = null;

  bind(broadcaster: UsageBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  startSession(): void {
    const now = Date.now();
    this.sessionStartMs = now;
    this.lastCheckpointMs = now;
    this.startCheckpointTimer();
    this.broadcast();
  }

  endSession(): void {
    if (this.sessionStartMs === null) return;
    const now = Date.now();
    this.checkpoint(now, /*finalize*/ true);
    const startedAt = new Date(this.sessionStartMs).toISOString();
    const endedAt = new Date(now).toISOString();
    const sessionSeconds = (now - this.sessionStartMs) / 1000;
    appendSession({ startedAt, endedAt, seconds: 0 });
    this.sessionStartMs = null;
    this.lastCheckpointMs = null;
    this.stopCheckpointTimer();
    this.broadcast(sessionSeconds);
  }

  abandonSession(): void {
    if (this.sessionStartMs === null) return;
    this.checkpoint(Date.now(), true);
    this.sessionStartMs = null;
    this.lastCheckpointMs = null;
    this.stopCheckpointTimer();
    this.broadcast();
  }

  resetUsage(): UsageUpdate {
    resetUsageStore();
    return this.snapshot(0);
  }

  setRate(rate: number): UsageUpdate {
    setRatePerHourStore(rate);
    return this.snapshot(this.elapsedSessionSeconds());
  }

  snapshot(sessionSeconds = this.elapsedSessionSeconds()): UsageUpdate {
    const usage = getUsage();
    const rate = getRatePerHour();
    return {
      sessionSeconds,
      totalSeconds: usage.totalSeconds,
      estimatedCost: (usage.totalSeconds / 3600) * rate,
      ratePerHour: rate,
      sessionCount: usage.sessions.length,
      resetAt: usage.resetAt,
    };
  }

  isActive(): boolean {
    return this.sessionStartMs !== null;
  }

  private elapsedSessionSeconds(): number {
    if (this.sessionStartMs === null) return 0;
    return (Date.now() - this.sessionStartMs) / 1000;
  }

  private broadcast(sessionSeconds = this.elapsedSessionSeconds()): void {
    this.broadcaster?.(this.snapshot(sessionSeconds));
  }

  private startCheckpointTimer(): void {
    this.stopCheckpointTimer();
    this.checkpointTimer = setInterval(() => this.checkpoint(Date.now(), false), USAGE_CHECKPOINT_INTERVAL_MS);
  }

  private stopCheckpointTimer(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  private checkpoint(now: number, finalize: boolean): void {
    if (this.sessionStartMs === null || this.lastCheckpointMs === null) return;
    const delta = (now - this.lastCheckpointMs) / 1000;
    if (delta <= 0) return;
    bumpTotalSeconds(delta);
    this.lastCheckpointMs = now;
    if (!finalize) this.broadcast();
  }
}

export const usageTracker = new UsageTracker();
