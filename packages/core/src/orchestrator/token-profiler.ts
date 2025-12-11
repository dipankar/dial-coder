/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserMode } from './mode-config.js';
import { MODE_CHARACTERISTICS } from './mode-config.js';
import { toInternalMode } from './mode-config.js';

/**
 * Token budget configuration.
 */
export interface TokenBudgetConfig {
  /** Maximum tokens per session */
  sessionLimit: number;
  /** Warning threshold (percentage of limit) */
  warningThreshold: number;
  /** Per-round soft limit */
  roundSoftLimit: number;
  /** Per-agent soft limit */
  agentSoftLimit: number;
}

/**
 * Default token budget configuration.
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  sessionLimit: 100000,
  warningThreshold: 0.8, // Warn at 80%
  roundSoftLimit: 20000,
  agentSoftLimit: 8000,
};

/**
 * Token profile for a component.
 */
export interface TokenProfile {
  /** Component name */
  name: string;
  /** Token count */
  tokens: number;
  /** Percentage of total */
  percentage: number;
  /** Child profiles */
  children?: TokenProfile[];
}

/**
 * Budget status.
 */
export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

/**
 * Token usage report.
 */
export interface TokenReport {
  /** Total tokens used */
  totalTokens: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Budget limit */
  budgetLimit: number;
  /** Percentage of budget used */
  budgetUsedPercent: number;
  /** Budget status */
  status: BudgetStatus;
  /** Tokens remaining */
  remaining: number;
  /** Profile breakdown by component */
  profile: TokenProfile[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Token estimates for different execution modes.
 * Based on typical usage patterns.
 */
export const MODE_TOKEN_ESTIMATES: Record<
  UserMode,
  {
    baseTokens: number;
    perRoundTokens: number;
    maxRounds: number;
  }
> = {
  ask: {
    baseTokens: 2000,
    perRoundTokens: 0,
    maxRounds: 0,
  },
  quick: {
    baseTokens: 4000,
    perRoundTokens: 3000,
    maxRounds: 1,
  },
  review: {
    baseTokens: 5000,
    perRoundTokens: 8000,
    maxRounds: 2,
  },
  safe: {
    baseTokens: 6000,
    perRoundTokens: 12000,
    maxRounds: 3,
  },
};

/**
 * Profiles and tracks token usage across the system.
 */
export class TokenProfiler {
  private config: TokenBudgetConfig;
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;
  private componentUsage: Map<string, { prompt: number; completion: number }> =
    new Map();
  private roundUsage: Array<{ prompt: number; completion: number }> = [];
  private warnings: string[] = [];

  constructor(config: Partial<TokenBudgetConfig> = {}) {
    this.config = { ...DEFAULT_TOKEN_BUDGET, ...config };
  }

  /**
   * Record token usage for a component.
   */
  recordUsage(
    component: string,
    promptTokens: number,
    completionTokens: number,
  ): void {
    this.totalPromptTokens += promptTokens;
    this.totalCompletionTokens += completionTokens;

    const existing = this.componentUsage.get(component) ?? {
      prompt: 0,
      completion: 0,
    };
    existing.prompt += promptTokens;
    existing.completion += completionTokens;
    this.componentUsage.set(component, existing);

    // Check thresholds
    this.checkThresholds(component);
  }

  /**
   * Record round completion.
   */
  recordRound(promptTokens: number, completionTokens: number): void {
    this.roundUsage.push({
      prompt: promptTokens,
      completion: completionTokens,
    });
  }

  /**
   * Check if any thresholds are exceeded.
   */
  private checkThresholds(component: string): void {
    const total = this.totalPromptTokens + this.totalCompletionTokens;
    const componentTotal = this.componentUsage.get(component);

    // Check session limit
    if (total > this.config.sessionLimit * this.config.warningThreshold) {
      const percent = Math.round((total / this.config.sessionLimit) * 100);
      this.warnings.push(`Session token usage at ${percent}% of limit`);
    }

    // Check component limit
    if (componentTotal) {
      const compTotal = componentTotal.prompt + componentTotal.completion;
      if (compTotal > this.config.agentSoftLimit) {
        this.warnings.push(
          `${component} exceeded soft limit (${compTotal} tokens)`,
        );
      }
    }
  }

  /**
   * Get current budget status.
   */
  getBudgetStatus(): BudgetStatus {
    const total = this.totalPromptTokens + this.totalCompletionTokens;
    const percent = total / this.config.sessionLimit;

    if (percent >= 1) return 'exceeded';
    if (percent >= this.config.warningThreshold) return 'warning';
    return 'ok';
  }

  /**
   * Get estimated tokens for a mode.
   */
  estimateTokensForMode(mode: UserMode, rounds?: number): number {
    const estimate = MODE_TOKEN_ESTIMATES[mode];
    const actualRounds = rounds ?? estimate.maxRounds;
    return estimate.baseTokens + estimate.perRoundTokens * actualRounds;
  }

  /**
   * Check if budget allows for a mode.
   */
  canAffordMode(mode: UserMode): boolean {
    const current = this.totalPromptTokens + this.totalCompletionTokens;
    const estimated = this.estimateTokensForMode(mode);
    return current + estimated <= this.config.sessionLimit;
  }

  /**
   * Get recommended mode based on remaining budget.
   */
  getRecommendedMode(): UserMode {
    const remaining =
      this.config.sessionLimit -
      (this.totalPromptTokens + this.totalCompletionTokens);

    if (
      remaining >=
      MODE_TOKEN_ESTIMATES.safe.baseTokens +
        MODE_TOKEN_ESTIMATES.safe.perRoundTokens * 3
    ) {
      return 'safe';
    }
    if (
      remaining >=
      MODE_TOKEN_ESTIMATES.review.baseTokens +
        MODE_TOKEN_ESTIMATES.review.perRoundTokens * 2
    ) {
      return 'review';
    }
    if (
      remaining >=
      MODE_TOKEN_ESTIMATES.quick.baseTokens +
        MODE_TOKEN_ESTIMATES.quick.perRoundTokens
    ) {
      return 'quick';
    }
    return 'ask';
  }

  /**
   * Generate a detailed token report.
   */
  getReport(): TokenReport {
    const totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    const budgetUsedPercent = (totalTokens / this.config.sessionLimit) * 100;

    // Build profile
    const profile: TokenProfile[] = [];
    for (const [name, usage] of this.componentUsage) {
      const tokens = usage.prompt + usage.completion;
      profile.push({
        name,
        tokens,
        percentage: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
        children: [
          {
            name: 'Prompt',
            tokens: usage.prompt,
            percentage: tokens > 0 ? (usage.prompt / tokens) * 100 : 0,
          },
          {
            name: 'Completion',
            tokens: usage.completion,
            percentage: tokens > 0 ? (usage.completion / tokens) * 100 : 0,
          },
        ],
      });
    }

    // Sort by tokens descending
    profile.sort((a, b) => b.tokens - a.tokens);

    // Generate recommendations
    const recommendations: string[] = [];
    const status = this.getBudgetStatus();

    if (status === 'exceeded') {
      recommendations.push(
        'Token budget exceeded. Consider starting a new session.',
      );
    } else if (status === 'warning') {
      recommendations.push(
        'Approaching token limit. Consider using simpler modes.',
      );
      if (!this.canAffordMode('safe')) {
        recommendations.push(
          'Not enough budget for Safe mode. Review or Quick recommended.',
        );
      }
    }

    // Find inefficient components
    for (const p of profile) {
      if (p.percentage > 40) {
        recommendations.push(
          `${p.name} using ${p.percentage.toFixed(0)}% of tokens. Consider optimization.`,
        );
      }
    }

    return {
      totalTokens,
      promptTokens: this.totalPromptTokens,
      completionTokens: this.totalCompletionTokens,
      budgetLimit: this.config.sessionLimit,
      budgetUsedPercent,
      status,
      remaining: this.config.sessionLimit - totalTokens,
      profile,
      recommendations,
    };
  }

  /**
   * Get a formatted summary string.
   */
  getSummary(): string {
    const report = this.getReport();
    const lines: string[] = [];

    // Status emoji
    const statusEmoji = {
      ok: '✓',
      warning: '⚠',
      exceeded: '✗',
    }[report.status];

    lines.push(
      `${statusEmoji} Token Usage: ${report.totalTokens.toLocaleString()} / ${report.budgetLimit.toLocaleString()} (${report.budgetUsedPercent.toFixed(1)}%)`,
    );
    lines.push(
      `  Prompt: ${report.promptTokens.toLocaleString()} | Completion: ${report.completionTokens.toLocaleString()}`,
    );

    if (report.profile.length > 0) {
      lines.push('');
      lines.push('Breakdown:');
      for (const p of report.profile.slice(0, 5)) {
        // Top 5
        const bar =
          '█'.repeat(Math.round(p.percentage / 5)) +
          '░'.repeat(20 - Math.round(p.percentage / 5));
        lines.push(`  ${p.name.padEnd(12)} ${bar} ${p.percentage.toFixed(1)}%`);
      }
    }

    if (report.recommendations.length > 0) {
      lines.push('');
      lines.push('Recommendations:');
      for (const rec of report.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset the profiler.
   */
  reset(): void {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.componentUsage.clear();
    this.roundUsage = [];
    this.warnings = [];
  }

  /**
   * Get warnings that have been generated.
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }
}

/**
 * Create a token profiler.
 */
export function createTokenProfiler(
  config?: Partial<TokenBudgetConfig>,
): TokenProfiler {
  return new TokenProfiler(config);
}

/**
 * Get the token multiplier for a mode.
 */
export function getModeTokenMultiplier(mode: UserMode): number {
  const internal = toInternalMode(mode);
  return MODE_CHARACTERISTICS[internal].tokenCostMultiplier;
}
