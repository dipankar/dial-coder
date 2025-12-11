/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  TokenBudget,
  createMemoryLoaders,
  formatDecisionsForPrompt,
  formatInvariantsForPrompt,
  formatModuleForPrompt,
} from '../budget.js';
import type { MemoryLoader } from '../types.js';

describe('TokenBudget', () => {
  describe('constructor', () => {
    it('should create budget with default values', () => {
      const budget = new TokenBudget();
      expect(budget.getRemainingTokens()).toBe(8000);
      expect(budget.getUsedTokens()).toBe(0);
    });

    it('should create budget with custom values', () => {
      const budget = new TokenBudget(4000, 3);
      expect(budget.getRemainingTokens()).toBe(4000);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const budget = new TokenBudget(8000, 4);

      expect(budget.estimateTokens('')).toBe(0);
      expect(budget.estimateTokens('1234')).toBe(1);
      expect(budget.estimateTokens('12345678')).toBe(2);
      expect(budget.estimateTokens('123456789')).toBe(3); // Ceiling
    });
  });

  describe('truncateToTokens', () => {
    it('should not truncate if within budget', () => {
      const budget = new TokenBudget();
      const text = 'Short text';

      const result = budget.truncateToTokens(text, 100);
      expect(result).toBe(text);
    });

    it('should truncate at sentence boundary when possible', () => {
      const budget = new TokenBudget(8000, 4);
      const text = 'First sentence. Second sentence. Third sentence.';

      // 20 tokens = 80 chars
      const result = budget.truncateToTokens(text, 10);

      expect(result).toContain('First sentence.');
      expect(result).toContain('[...truncated]');
    });

    it('should truncate at newline when no sentence boundary', () => {
      const budget = new TokenBudget(8000, 4);
      const text = 'Line one here\nLine two here\nLine three here';

      const result = budget.truncateToTokens(text, 10);
      expect(result).toContain('[...truncated]');
    });
  });

  describe('hasRoom', () => {
    it('should return true when room available', () => {
      const budget = new TokenBudget(1000);
      expect(budget.hasRoom(100)).toBe(true);
    });

    it('should return false when no room', () => {
      const budget = new TokenBudget(100);
      budget.reserve(90);
      expect(budget.hasRoom(20)).toBe(false);
    });
  });

  describe('reserve and release', () => {
    it('should reserve tokens', () => {
      const budget = new TokenBudget(1000);
      const result = budget.reserve(500);

      expect(result).toBe(true);
      expect(budget.getUsedTokens()).toBe(500);
      expect(budget.getRemainingTokens()).toBe(500);
    });

    it('should fail to reserve if not enough room', () => {
      const budget = new TokenBudget(100);
      const result = budget.reserve(200);

      expect(result).toBe(false);
      expect(budget.getUsedTokens()).toBe(0);
    });

    it('should release reserved tokens', () => {
      const budget = new TokenBudget(1000);
      budget.reserve(500);
      budget.release(200);

      expect(budget.getUsedTokens()).toBe(300);
    });

    it('should not go below zero on release', () => {
      const budget = new TokenBudget(1000);
      budget.reserve(100);
      budget.release(500);

      expect(budget.getUsedTokens()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset used tokens to zero', () => {
      const budget = new TokenBudget(1000);
      budget.reserve(500);
      budget.reset();

      expect(budget.getUsedTokens()).toBe(0);
      expect(budget.getRemainingTokens()).toBe(1000);
    });
  });

  describe('createSubBudget', () => {
    it('should create sub-budget with portion of remaining', () => {
      const budget = new TokenBudget(1000);
      budget.reserve(200); // 800 remaining

      const subBudget = budget.createSubBudget(0.5);

      expect(subBudget.getRemainingTokens()).toBe(400);
    });
  });

  describe('loadWithBudget', () => {
    it('should load content in priority order', async () => {
      const budget = new TokenBudget(1000);

      const loaders: MemoryLoader[] = [
        {
          name: 'low',
          load: async () => 'Low priority',
          priority: 10,
          canTruncate: false,
        },
        {
          name: 'high',
          load: async () => 'High priority',
          priority: 100,
          canTruncate: false,
        },
        {
          name: 'medium',
          load: async () => 'Medium priority',
          priority: 50,
          canTruncate: false,
        },
      ];

      const result = await budget.loadWithBudget(loaders);

      expect(result.loadedSources).toEqual(['high', 'medium', 'low']);
    });

    it('should skip content that does not fit and cannot truncate', async () => {
      const budget = new TokenBudget(100, 4); // 100 tokens = 400 chars

      const loaders: MemoryLoader[] = [
        {
          name: 'first',
          load: async () => 'x'.repeat(300),
          priority: 100,
          canTruncate: false,
        },
        {
          name: 'second',
          load: async () => 'x'.repeat(300),
          priority: 90,
          canTruncate: false,
        }, // Won't fit
        {
          name: 'third',
          load: async () => 'y'.repeat(50),
          priority: 80,
          canTruncate: false,
        }, // Will fit
      ];

      const result = await budget.loadWithBudget(loaders);

      expect(result.loadedSources).toContain('first');
      expect(result.loadedSources).toContain('third');
      expect(result.loadedSources).not.toContain('second');
    });

    it('should truncate content when allowed', async () => {
      // Budget: 500 tokens = 2000 chars
      // First loader: 500 chars = 125 tokens
      // Remaining after first: 375 tokens (> 100 threshold)
      // Second loader: 1000 chars = 250 tokens (needs truncation to fit)
      const budget = new TokenBudget(500, 4);

      const loaders: MemoryLoader[] = [
        {
          name: 'first',
          load: async () => 'x'.repeat(500),
          priority: 100,
          canTruncate: false,
        },
        {
          name: 'second',
          load: async () => 'y'.repeat(2000),
          priority: 90,
          canTruncate: true,
        },
      ];

      const result = await budget.loadWithBudget(loaders);

      expect(result.loadedSources).toContain('first');
      expect(result.truncatedSources).toContain('second');
      expect(result.content[1]).toContain('[...truncated]');
    });

    it('should skip failed loaders', async () => {
      const budget = new TokenBudget(1000);

      const loaders: MemoryLoader[] = [
        {
          name: 'success',
          load: async () => 'Success',
          priority: 100,
          canTruncate: false,
        },
        {
          name: 'error',
          load: async () => {
            throw new Error('Failed');
          },
          priority: 90,
          canTruncate: false,
        },
      ];

      const result = await budget.loadWithBudget(loaders);

      expect(result.loadedSources).toContain('success');
      expect(result.loadedSources).not.toContain('error');
    });
  });
});

describe('createMemoryLoaders', () => {
  it('should create loaders with correct priorities', () => {
    const loaders = createMemoryLoaders({
      invariants: async () => 'invariants',
      decisions: async () => 'decisions',
      microSummaries: async () => 'summaries',
      moduleMemory: async () => 'module',
      sessionHistory: async () => 'history',
    });

    expect(loaders).toHaveLength(5);

    const invariantsLoader = loaders.find((l) => l.name === 'invariants');
    const decisionsLoader = loaders.find((l) => l.name === 'decisions');

    expect(invariantsLoader?.priority).toBe(100);
    expect(invariantsLoader?.canTruncate).toBe(false);
    expect(decisionsLoader?.priority).toBe(90);
    expect(decisionsLoader?.canTruncate).toBe(true);
  });

  it('should only include provided loaders', () => {
    const loaders = createMemoryLoaders({
      invariants: async () => 'invariants',
    });

    expect(loaders).toHaveLength(1);
    expect(loaders[0].name).toBe('invariants');
  });
});

describe('formatDecisionsForPrompt', () => {
  it('should format decisions as list', () => {
    const decisions = [
      { scope: 'auth', summary: 'Always validate tokens' },
      { scope: 'api', summary: 'Use REST conventions' },
    ];

    const result = formatDecisionsForPrompt(decisions);

    expect(result).toContain('[auth] Always validate tokens');
    expect(result).toContain('[api] Use REST conventions');
  });

  it('should return message when no decisions', () => {
    const result = formatDecisionsForPrompt([]);
    expect(result).toBe('No relevant decisions recorded.');
  });
});

describe('formatInvariantsForPrompt', () => {
  it('should format invariants as numbered list', () => {
    const invariants = ['First invariant', 'Second invariant'];

    const result = formatInvariantsForPrompt(invariants);

    expect(result).toContain('1. First invariant');
    expect(result).toContain('2. Second invariant');
  });

  it('should return message when no invariants', () => {
    const result = formatInvariantsForPrompt([]);
    expect(result).toBe('No invariants defined.');
  });
});

describe('formatModuleForPrompt', () => {
  it('should format module with all sections', () => {
    const module = {
      module: 'auth',
      description: 'Authentication module',
      invariants: ['Always hash passwords', 'Never store plain tokens'],
      patterns: [{ name: 'Token refresh', description: 'Use refresh tokens' }],
    };

    const result = formatModuleForPrompt(module);

    expect(result).toContain('## Module: auth');
    expect(result).toContain('Authentication module');
    expect(result).toContain('### Invariants');
    expect(result).toContain('Always hash passwords');
    expect(result).toContain('### Patterns');
    expect(result).toContain('**Token refresh**: Use refresh tokens');
  });
});
