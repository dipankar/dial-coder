/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserMode } from './mode-config.js';

/**
 * Timing data for a single operation.
 */
export interface TimingData {
  /** Operation name */
  name: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Nested timings */
  children?: TimingData[];
}

/**
 * Token usage data.
 */
export interface TokenUsageData {
  /** Prompt tokens sent */
  promptTokens: number;
  /** Completion tokens received */
  completionTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Estimated cost in USD (if available) */
  estimatedCost?: number;
}

/**
 * Agent-level metrics.
 */
export interface AgentMetrics {
  /** Agent display name (Planner, Reviewer, Resolver, Learner) */
  agentName: string;
  /** Number of invocations */
  invocations: number;
  /** Total time spent */
  totalTimeMs: number;
  /** Average time per invocation */
  avgTimeMs: number;
  /** Token usage */
  tokenUsage: TokenUsageData;
  /** Success rate (0-1) */
  successRate: number;
  /** Retry count */
  retries: number;
}

/**
 * Round-level metrics.
 */
export interface RoundMetrics {
  /** Round number */
  round: number;
  /** Total round duration */
  durationMs: number;
  /** Phase timings */
  phases: {
    planning: number; // Planner (thesis)
    reviewing: number; // Reviewer (antithesis)
    resolving: number; // Resolver (synthesis)
    verifying: number; // Verification
  };
  /** Token usage for this round */
  tokenUsage: TokenUsageData;
  /** Outcome */
  outcome: 'success' | 'partial' | 'failed';
}

/**
 * Session-level metrics.
 */
export interface SessionMetrics {
  /** Session ID */
  sessionId: string;
  /** Execution mode used */
  mode: UserMode;
  /** Whether mode was auto-selected */
  modeAutoSelected: boolean;
  /** Mode selection confidence */
  modeConfidence: number;
  /** Total session duration */
  totalDurationMs: number;
  /** Number of rounds executed */
  roundCount: number;
  /** Round metrics */
  rounds: RoundMetrics[];
  /** Agent metrics */
  agents: Record<string, AgentMetrics>;
  /** Total token usage */
  totalTokenUsage: TokenUsageData;
  /** Final outcome */
  outcome: 'success' | 'partial' | 'failed';
  /** Escalation events */
  escalations: Array<{
    fromMode: UserMode;
    toMode: UserMode;
    reason: string;
    atRound: number;
  }>;
}

/**
 * Performance tracker for monitoring execution metrics.
 */
export class PerformanceTracker {
  private sessionId: string;
  private mode: UserMode = 'quick';
  private modeAutoSelected = false;
  private modeConfidence = 1.0;
  private startTime: number;
  private roundMetrics: RoundMetrics[] = [];
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private currentTiming: TimingData | null = null;
  private timingStack: TimingData[] = [];
  private escalations: SessionMetrics['escalations'] = [];

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? `session-${Date.now()}`;
    this.startTime = Date.now();
  }

  /**
   * Set the execution mode.
   */
  setMode(mode: UserMode, autoSelected: boolean, confidence: number): void {
    this.mode = mode;
    this.modeAutoSelected = autoSelected;
    this.modeConfidence = confidence;
  }

  /**
   * Record a mode escalation.
   */
  recordEscalation(fromMode: UserMode, toMode: UserMode, reason: string): void {
    this.escalations.push({
      fromMode,
      toMode,
      reason,
      atRound: this.roundMetrics.length + 1,
    });
  }

  /**
   * Start timing an operation.
   */
  startTiming(name: string): void {
    const timing: TimingData = {
      name,
      startTime: Date.now(),
      children: [],
    };

    if (this.currentTiming) {
      this.timingStack.push(this.currentTiming);
      this.currentTiming.children?.push(timing);
    }

    this.currentTiming = timing;
  }

  /**
   * End timing an operation.
   */
  endTiming(): TimingData | null {
    if (!this.currentTiming) return null;

    this.currentTiming.endTime = Date.now();
    this.currentTiming.duration =
      this.currentTiming.endTime - this.currentTiming.startTime;

    const completed = this.currentTiming;
    this.currentTiming = this.timingStack.pop() ?? null;

    return completed;
  }

  /**
   * Record agent invocation.
   */
  recordAgentInvocation(
    agentName: string,
    durationMs: number,
    tokenUsage: TokenUsageData,
    success: boolean,
    retried: boolean,
  ): void {
    let metrics = this.agentMetrics.get(agentName);

    if (!metrics) {
      metrics = {
        agentName,
        invocations: 0,
        totalTimeMs: 0,
        avgTimeMs: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        successRate: 1.0,
        retries: 0,
      };
      this.agentMetrics.set(agentName, metrics);
    }

    metrics.invocations++;
    metrics.totalTimeMs += durationMs;
    metrics.avgTimeMs = metrics.totalTimeMs / metrics.invocations;
    metrics.tokenUsage.promptTokens += tokenUsage.promptTokens;
    metrics.tokenUsage.completionTokens += tokenUsage.completionTokens;
    metrics.tokenUsage.totalTokens += tokenUsage.totalTokens;

    if (retried) metrics.retries++;

    // Update success rate
    const successCount = Math.round(
      metrics.successRate * (metrics.invocations - 1),
    );
    metrics.successRate =
      (successCount + (success ? 1 : 0)) / metrics.invocations;
  }

  /**
   * Record a completed round.
   */
  recordRound(round: Omit<RoundMetrics, 'round'>): void {
    this.roundMetrics.push({
      round: this.roundMetrics.length + 1,
      ...round,
    });
  }

  /**
   * Get session metrics.
   */
  getMetrics(): SessionMetrics {
    const totalDurationMs = Date.now() - this.startTime;

    // Calculate total token usage
    const totalTokenUsage: TokenUsageData = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (const round of this.roundMetrics) {
      totalTokenUsage.promptTokens += round.tokenUsage.promptTokens;
      totalTokenUsage.completionTokens += round.tokenUsage.completionTokens;
      totalTokenUsage.totalTokens += round.tokenUsage.totalTokens;
    }

    // Determine overall outcome
    const lastRound = this.roundMetrics[this.roundMetrics.length - 1];
    const outcome = lastRound?.outcome ?? 'success';

    // Convert agent metrics map to record
    const agents: Record<string, AgentMetrics> = {};
    for (const [name, metrics] of this.agentMetrics) {
      agents[name] = metrics;
    }

    return {
      sessionId: this.sessionId,
      mode: this.mode,
      modeAutoSelected: this.modeAutoSelected,
      modeConfidence: this.modeConfidence,
      totalDurationMs,
      roundCount: this.roundMetrics.length,
      rounds: this.roundMetrics,
      agents,
      totalTokenUsage,
      outcome,
      escalations: this.escalations,
    };
  }

  /**
   * Get a formatted summary string.
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push(`Session: ${metrics.sessionId}`);
    lines.push(
      `Mode: ${metrics.mode}${metrics.modeAutoSelected ? ` (auto ${Math.round(metrics.modeConfidence * 100)}%)` : ''}`,
    );
    lines.push(`Duration: ${(metrics.totalDurationMs / 1000).toFixed(2)}s`);
    lines.push(`Rounds: ${metrics.roundCount}`);
    lines.push(
      `Tokens: ${metrics.totalTokenUsage.totalTokens.toLocaleString()} (${metrics.totalTokenUsage.promptTokens.toLocaleString()} prompt, ${metrics.totalTokenUsage.completionTokens.toLocaleString()} completion)`,
    );

    if (Object.keys(metrics.agents).length > 0) {
      lines.push('');
      lines.push('Agent Performance:');
      for (const [name, agent] of Object.entries(metrics.agents)) {
        lines.push(
          `  ${name}: ${agent.invocations} calls, ${agent.avgTimeMs.toFixed(0)}ms avg, ${Math.round(agent.successRate * 100)}% success`,
        );
      }
    }

    if (metrics.escalations.length > 0) {
      lines.push('');
      lines.push('Escalations:');
      for (const esc of metrics.escalations) {
        lines.push(
          `  Round ${esc.atRound}: ${esc.fromMode} → ${esc.toMode} (${esc.reason})`,
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset tracker for a new session.
   */
  reset(sessionId?: string): void {
    this.sessionId = sessionId ?? `session-${Date.now()}`;
    this.startTime = Date.now();
    this.roundMetrics = [];
    this.agentMetrics.clear();
    this.currentTiming = null;
    this.timingStack = [];
    this.escalations = [];
    this.mode = 'quick';
    this.modeAutoSelected = false;
    this.modeConfidence = 1.0;
  }
}

/**
 * Create a performance tracker.
 */
export function createPerformanceTracker(
  sessionId?: string,
): PerformanceTracker {
  return new PerformanceTracker(sessionId);
}

/**
 * Format duration in human-readable form.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format token count with locale-aware separators.
 */
export function formatTokens(count: number): string {
  return count.toLocaleString();
}
