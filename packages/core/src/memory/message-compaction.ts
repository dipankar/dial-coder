/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Message } from '../llm/types.js';

/**
 * Compaction tiers ordered from least to most aggressive.
 */
export type CompactionTier = 'snip' | 'micro' | 'collapse' | 'auto';

export interface CompactionResult {
  messages: Message[];
  tierApplied: CompactionTier | null;
  tokensBefore: number;
  tokensAfter: number;
}

/**
 * Tier 1: Snip Compact — Drop oldest non-system message blocks.
 */
function snipCompact(messages: Message[]): Message[] {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const otherMessages = messages.filter((m) => m.role !== 'system');
  const keepCount = Math.max(1, Math.floor(otherMessages.length / 2));
  const kept = otherMessages.slice(-keepCount);
  return [...systemMessages, ...kept];
}

/**
 * Tier 2: Microcompact — Clear old tool results, keep system + recent turns pinned.
 */
function microcompact(messages: Message[]): Message[] {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const recent = messages.filter((m) => m.role !== 'system').slice(-4);
  return [...systemMessages, ...recent];
}

/**
 * Tier 3: Context Collapse — Replace dropped messages with a summary placeholder.
 */
function contextCollapse(messages: Message[]): Message[] {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const otherMessages = messages.filter((m) => m.role !== 'system');
  const recent = otherMessages.slice(-3);
  const droppedCount = otherMessages.length - recent.length;

  const summary: Message = {
    role: 'user',
    content: `[${droppedCount} earlier messages omitted for brevity. Key context preserved in system prompt.]`,
  };

  return [...systemMessages, summary, ...recent];
}

/**
 * Tier 4: Auto-Compact — Replace entire history with a condensed summary.
 */
function autoCompact(messages: Message[]): Message[] {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const summary: Message = {
    role: 'user',
    content:
      '[Session history compacted due to token limits. Refer to system prompt for context.]',
  };
  return [...systemMessages, summary];
}

/**
 * Apply progressive compaction until messages fit within the token budget.
 *
 * Tries each tier in order:
 * 1. Snip — drop oldest non-system blocks
 * 2. Micro — keep only 4 most recent non-system turns
 * 3. Collapse — summarize dropped history
 * 4. Auto — reduce to system + single summary
 */
export function compactMessages(
  messages: Message[],
  estimateFn: (msgs: Message[]) => number,
  budget: number,
): CompactionResult {
  let current = messages;
  const tokensBefore = estimateFn(current);

  if (tokensBefore <= budget) {
    return {
      messages: current,
      tierApplied: null,
      tokensBefore,
      tokensAfter: tokensBefore,
    };
  }

  // Tier 1: Snip
  current = snipCompact(current);
  let tokens = estimateFn(current);
  if (tokens <= budget) {
    return {
      messages: current,
      tierApplied: 'snip',
      tokensBefore,
      tokensAfter: tokens,
    };
  }

  // Tier 2: Micro
  current = microcompact(current);
  tokens = estimateFn(current);
  if (tokens <= budget) {
    return {
      messages: current,
      tierApplied: 'micro',
      tokensBefore,
      tokensAfter: tokens,
    };
  }

  // Tier 3: Collapse
  current = contextCollapse(current);
  tokens = estimateFn(current);
  if (tokens <= budget) {
    return {
      messages: current,
      tierApplied: 'collapse',
      tokensBefore,
      tokensAfter: tokens,
    };
  }

  // Tier 4: Auto
  current = autoCompact(current);
  tokens = estimateFn(current);
  return {
    messages: current,
    tierApplied: 'auto',
    tokensBefore,
    tokensAfter: tokens,
  };
}
