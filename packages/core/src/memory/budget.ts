/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MemoryLoader } from './types.js';

/**
 * Result of budget allocation.
 */
export interface BudgetAllocation {
  content: string[];
  usedTokens: number;
  remainingTokens: number;
  loadedSources: string[];
  truncatedSources: string[];
}

/**
 * Manages token budget for memory context loading.
 *
 * Memory loading must respect context limits to avoid
 * exceeding model token limits. This class handles:
 * - Priority-based loading
 * - Token estimation
 * - Content truncation
 * - Budget tracking
 */
export class TokenBudget {
  private maxTokens: number;
  private usedTokens: number = 0;
  private charsPerToken: number;

  constructor(maxTokens: number = 8000, charsPerToken: number = 4) {
    this.maxTokens = maxTokens;
    this.charsPerToken = charsPerToken;
  }

  /**
   * Load content from multiple sources respecting the token budget.
   */
  async loadWithBudget(loaders: MemoryLoader[]): Promise<BudgetAllocation> {
    const results: string[] = [];
    const loadedSources: string[] = [];
    const truncatedSources: string[] = [];

    // Sort by priority (higher first)
    const sorted = [...loaders].sort((a, b) => b.priority - a.priority);

    for (const loader of sorted) {
      try {
        const content = await loader.load();
        const tokens = this.estimateTokens(content);

        if (this.usedTokens + tokens <= this.maxTokens) {
          // Fits within budget
          results.push(content);
          this.usedTokens += tokens;
          loadedSources.push(loader.name);
        } else if (loader.canTruncate) {
          // Truncate to fit remaining budget
          const availableTokens = this.maxTokens - this.usedTokens;
          if (availableTokens > 100) {
            // Only truncate if we have meaningful space
            const truncated = this.truncateToTokens(content, availableTokens);
            results.push(truncated);
            this.usedTokens += availableTokens;
            truncatedSources.push(loader.name);
          }
          break; // No more room after truncation
        }
        // If can't truncate and doesn't fit, skip
      } catch {
        // Skip failed loaders
        continue;
      }
    }

    return {
      content: results,
      usedTokens: this.usedTokens,
      remainingTokens: this.maxTokens - this.usedTokens,
      loadedSources,
      truncatedSources,
    };
  }

  /**
   * Estimate token count for text.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Truncate text to fit within a token budget.
   */
  truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * this.charsPerToken;

    if (text.length <= maxChars) {
      return text;
    }

    // Try to truncate at a sentence boundary
    const truncated = text.slice(0, maxChars);
    const lastSentence = truncated.lastIndexOf('. ');
    const lastNewline = truncated.lastIndexOf('\n');

    const breakPoint = Math.max(lastSentence, lastNewline);
    if (breakPoint > maxChars * 0.5) {
      return truncated.slice(0, breakPoint + 1) + '\n[...truncated]';
    }

    return truncated + '\n[...truncated]';
  }

  /**
   * Check if there's room for more content.
   */
  hasRoom(tokens: number = 100): boolean {
    return this.usedTokens + tokens <= this.maxTokens;
  }

  /**
   * Get remaining token budget.
   */
  getRemainingTokens(): number {
    return this.maxTokens - this.usedTokens;
  }

  /**
   * Get used tokens.
   */
  getUsedTokens(): number {
    return this.usedTokens;
  }

  /**
   * Reserve tokens for a specific purpose.
   */
  reserve(tokens: number): boolean {
    if (this.usedTokens + tokens > this.maxTokens) {
      return false;
    }
    this.usedTokens += tokens;
    return true;
  }

  /**
   * Release previously reserved tokens.
   */
  release(tokens: number): void {
    this.usedTokens = Math.max(0, this.usedTokens - tokens);
  }

  /**
   * Reset the budget.
   */
  reset(): void {
    this.usedTokens = 0;
  }

  /**
   * Create a sub-budget with a portion of the remaining tokens.
   */
  createSubBudget(portion: number = 0.5): TokenBudget {
    const subTokens = Math.floor(this.getRemainingTokens() * portion);
    return new TokenBudget(subTokens, this.charsPerToken);
  }
}

/**
 * Create memory loaders for common memory sources.
 */
export function createMemoryLoaders(options: {
  invariants?: () => Promise<string>;
  decisions?: () => Promise<string>;
  microSummaries?: () => Promise<string>;
  moduleMemory?: () => Promise<string>;
  sessionHistory?: () => Promise<string>;
}): MemoryLoader[] {
  const loaders: MemoryLoader[] = [];

  if (options.invariants) {
    loaders.push({
      name: 'invariants',
      load: options.invariants,
      priority: 100,
      canTruncate: false,
    });
  }

  if (options.decisions) {
    loaders.push({
      name: 'decisions',
      load: options.decisions,
      priority: 90,
      canTruncate: true,
    });
  }

  if (options.microSummaries) {
    loaders.push({
      name: 'microSummaries',
      load: options.microSummaries,
      priority: 80,
      canTruncate: true,
    });
  }

  if (options.moduleMemory) {
    loaders.push({
      name: 'moduleMemory',
      load: options.moduleMemory,
      priority: 70,
      canTruncate: true,
    });
  }

  if (options.sessionHistory) {
    loaders.push({
      name: 'sessionHistory',
      load: options.sessionHistory,
      priority: 60,
      canTruncate: true,
    });
  }

  return loaders;
}

/**
 * Format decisions for inclusion in prompts.
 */
export function formatDecisionsForPrompt(
  decisions: Array<{ scope: string; summary: string }>,
): string {
  if (decisions.length === 0) {
    return 'No relevant decisions recorded.';
  }

  return decisions.map((d) => `- [${d.scope}] ${d.summary}`).join('\n');
}

/**
 * Format invariants for inclusion in prompts.
 */
export function formatInvariantsForPrompt(invariants: string[]): string {
  if (invariants.length === 0) {
    return 'No invariants defined.';
  }

  return invariants.map((inv, i) => `${i + 1}. ${inv}`).join('\n');
}

/**
 * Format module memory for inclusion in prompts.
 */
export function formatModuleForPrompt(module: {
  module: string;
  description: string;
  invariants: string[];
  patterns: Array<{ name: string; description: string }>;
}): string {
  const lines: string[] = [];

  lines.push(`## Module: ${module.module}`);
  lines.push(module.description);
  lines.push('');

  if (module.invariants.length > 0) {
    lines.push('### Invariants');
    for (const inv of module.invariants) {
      lines.push(`- ${inv}`);
    }
    lines.push('');
  }

  if (module.patterns.length > 0) {
    lines.push('### Patterns');
    for (const pat of module.patterns) {
      lines.push(`- **${pat.name}**: ${pat.description}`);
    }
  }

  return lines.join('\n');
}
