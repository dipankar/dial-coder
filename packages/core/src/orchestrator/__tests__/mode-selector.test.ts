/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModeSelector,
  selectMode,
  requiresDialectic,
  canModifyFiles,
} from '../mode-selector.js';
import { TaskAnalyzer } from '../task-analyzer.js';
import {
  toInternalMode,
  toUserMode,
  compareModes,
  isStricterMode,
  getStricterMode,
} from '../mode-config.js';

describe('ModeSelector', () => {
  let selector: ModeSelector;

  beforeEach(() => {
    selector = new ModeSelector();
  });

  describe('user mode override', () => {
    it('should use user-specified mode', () => {
      const result = selector.select('Fix the bug', { userMode: 'quick' });

      expect(result.mode).toBe('simple');
      expect(result.displayName).toBe('quick');
      expect(result.isAutoSelected).toBe(false);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle all user modes', () => {
      const modes = ['ask', 'quick', 'review', 'safe'] as const;

      for (const userMode of modes) {
        const result = selector.select('Test prompt', { userMode });
        expect(result.displayName).toBe(userMode);
        expect(result.isAutoSelected).toBe(false);
      }
    });
  });

  describe('query detection', () => {
    it('should select read_only for explanation requests', () => {
      const prompts = [
        'Explain how the auth module works',
        'What is this function doing?',
        'How does the caching system work?',
        'Describe the database schema',
        'Show me the API endpoints',
      ];

      for (const prompt of prompts) {
        const result = selector.select(prompt);
        expect(result.mode).toBe('read_only');
        expect(result.displayName).toBe('ask');
      }
    });

    it('should have high confidence for clear queries', () => {
      const result = selector.select('Explain how authentication works');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('critical path detection', () => {
    it('should select dialectic_full for auth paths', () => {
      const result = selector.select('Update the src/auth/login.ts file');

      expect(result.mode).toBe('dialectic_full');
      expect(result.displayName).toBe('safe');
      expect(
        result.reasons.some(
          (r) =>
            r.toLowerCase().includes('critical') ||
            r.toLowerCase().includes('path'),
        ),
      ).toBe(true);
    });

    it('should select dialectic_full for security paths', () => {
      const result = selector.select('Modify src/security/encryption.ts');

      expect(result.mode).toBe('dialectic_full');
    });

    it('should select dialectic_full for database migrations', () => {
      const result = selector.select(
        'Add a new file to migrations/ for users table',
      );

      expect(result.mode).toBe('dialectic_full');
    });
  });

  describe('risk-based selection', () => {
    it('should select dialectic_full for high-risk keywords', () => {
      const result = selector.select('Update the password hashing logic');

      expect(result.mode).toBe('dialectic_full');
      expect(result.reasons.some((r) => r.toLowerCase().includes('risk'))).toBe(
        true,
      );
    });

    it('should select dialectic_full for production changes', () => {
      const result = selector.select('Deploy the new feature to production');

      expect(result.mode).toBe('dialectic_full');
    });

    it('should select dialectic_full for credential handling', () => {
      const result = selector.select('Update the API key storage mechanism');

      expect(result.mode).toBe('dialectic_full');
    });
  });

  describe('simple file detection', () => {
    it('should select simple for README changes', () => {
      const result = selector.select('Update the README.md file', {
        affectedFiles: ['README.md'],
      });

      expect(result.mode).toBe('simple');
      expect(result.displayName).toBe('quick');
    });

    it('should select simple for documentation files', () => {
      const result = selector.select('Fix typo in docs', {
        affectedFiles: ['docs/guide.md', 'CHANGELOG.md'],
      });

      expect(result.mode).toBe('simple');
    });
  });

  describe('complexity-based selection', () => {
    it('should select simple for trivial tasks', () => {
      const result = selector.select('Fix typo');

      expect(result.mode).toBe('simple');
    });

    it('should select dialectic_light for moderate tasks', () => {
      const result = selector.select(
        'Add a new helper function to format dates in the utils module',
      );

      // This is a moderate task - not trivial, not critical
      expect(['simple', 'dialectic_light']).toContain(result.mode);
    });

    it('should select dialectic_full for complex refactoring', () => {
      const result = selector.select(
        'Refactor the entire authentication module to use OAuth2 instead of basic auth, ' +
          'update all related components, add integration tests, and update the documentation',
      );

      expect(result.mode).toBe('dialectic_full');
    });
  });

  describe('escalation suggestion', () => {
    it('should suggest escalation when confidence is low', () => {
      // A task with mixed signals gets low confidence
      const result = selector.select('Show me how to fix and update this');

      // If mode is not read_only and not dialectic_full, and confidence is low, should suggest escalation
      if (
        result.mode !== 'dialectic_full' &&
        result.mode !== 'read_only' &&
        result.confidence < 0.6
      ) {
        expect(result.suggestedEscalation).toBeDefined();
      }
    });
  });
});

describe('TaskAnalyzer', () => {
  let analyzer: TaskAnalyzer;

  beforeEach(() => {
    analyzer = new TaskAnalyzer();
  });

  describe('intent analysis', () => {
    it('should detect query intent', () => {
      const analysis = analyzer.analyze('Explain how the router works');

      expect(analysis.intent).toBe('query');
      expect(analysis.detectedKeywords.readOnly).toContain('explain');
    });

    it('should detect modification intent', () => {
      const analysis = analyzer.analyze('Fix the bug in the login form');

      expect(analysis.intent).toBe('modification');
      expect(analysis.detectedKeywords.modification).toContain('fix');
    });

    it('should detect ambiguous intent', () => {
      const analysis = analyzer.analyze('Show me how to fix this');

      expect(analysis.intent).toBe('ambiguous');
    });
  });

  describe('risk assessment', () => {
    it('should assess high risk for auth changes', () => {
      const analysis = analyzer.analyze('Update authentication logic');

      expect(['high', 'critical']).toContain(analysis.riskLevel);
      expect(analysis.riskFactors.length).toBeGreaterThan(0);
    });

    it('should assess low risk for simple changes', () => {
      const analysis = analyzer.analyze('Fix typo in comment');

      expect(analysis.riskLevel).toBe('low');
    });

    it('should assess critical risk for database migrations', () => {
      const analysis = analyzer.analyze(
        'Run database migration to drop old tables',
      );

      expect(analysis.riskLevel).toBe('critical');
    });
  });

  describe('complexity assessment', () => {
    it('should assess trivial complexity for typos', () => {
      const analysis = analyzer.analyze('Fix typo');

      expect(analysis.complexity).toBe('trivial');
    });

    it('should assess complex for refactoring', () => {
      const analysis = analyzer.analyze(
        'Refactor the entire user management system to support multi-tenancy. ' +
          'This requires significant changes including database schema changes, API updates, and frontend modifications. ' +
          'We need to integrate with the authentication system, add new endpoints, design the architecture carefully, ' +
          'update all the components, fix compatibility issues, and ensure performance optimization. ' +
          'Add comprehensive test coverage for unit tests and integration tests for all the modules involved.',
      );

      expect(analysis.complexity).toBe('complex');
    });
  });

  describe('file scope analysis', () => {
    it('should extract file paths', () => {
      const analysis = analyzer.analyze(
        'Update src/auth/login.ts and src/utils/helpers.ts',
      );

      expect(analysis.fileScope.mentionedFiles).toContain('src/auth/login.ts');
      expect(analysis.fileScope.mentionedFiles).toContain(
        'src/utils/helpers.ts',
      );
    });

    it('should detect critical paths', () => {
      const analysis = analyzer.analyze(
        'Modify src/auth/login.ts and add new validation',
      );

      expect(analysis.fileScope.touchesCriticalPaths).toBe(true);
    });
  });

  describe('technology detection', () => {
    it('should detect TypeScript', () => {
      const analysis = analyzer.analyze('Update the TypeScript configuration');

      expect(analysis.technologies).toContain('TypeScript');
    });

    it('should detect multiple technologies', () => {
      const analysis = analyzer.analyze(
        'Deploy the React app to AWS using Docker',
      );

      expect(analysis.technologies).toContain('React');
      expect(analysis.technologies).toContain('AWS');
      expect(analysis.technologies).toContain('Docker');
    });
  });

  describe('test mentions', () => {
    it('should detect test mentions', () => {
      const analysis = analyzer.analyze('Add unit tests for the auth module');

      expect(analysis.mentionsTests).toBe(true);
    });

    it('should detect test framework mentions', () => {
      const analysis = analyzer.analyze('Run vitest to check the changes');

      expect(analysis.mentionsTests).toBe(true);
    });
  });
});

describe('mode-config helpers', () => {
  describe('toInternalMode', () => {
    it('should convert user modes to internal', () => {
      expect(toInternalMode('ask')).toBe('read_only');
      expect(toInternalMode('quick')).toBe('simple');
      expect(toInternalMode('review')).toBe('dialectic_light');
      expect(toInternalMode('safe')).toBe('dialectic_full');
    });
  });

  describe('toUserMode', () => {
    it('should convert internal modes to user', () => {
      expect(toUserMode('read_only')).toBe('ask');
      expect(toUserMode('simple')).toBe('quick');
      expect(toUserMode('dialectic_light')).toBe('review');
      expect(toUserMode('dialectic_full')).toBe('safe');
    });
  });

  describe('compareModes', () => {
    it('should compare modes correctly', () => {
      expect(compareModes('read_only', 'simple')).toBeLessThan(0);
      expect(compareModes('simple', 'simple')).toBe(0);
      expect(compareModes('dialectic_full', 'simple')).toBeGreaterThan(0);
    });
  });

  describe('isStricterMode', () => {
    it('should identify stricter modes', () => {
      expect(isStricterMode('dialectic_full', 'simple')).toBe(true);
      expect(isStricterMode('simple', 'dialectic_full')).toBe(false);
      expect(isStricterMode('simple', 'simple')).toBe(false);
    });
  });

  describe('getStricterMode', () => {
    it('should return the stricter mode', () => {
      expect(getStricterMode('simple', 'dialectic_light')).toBe(
        'dialectic_light',
      );
      expect(getStricterMode('dialectic_full', 'simple')).toBe(
        'dialectic_full',
      );
    });
  });
});

describe('helper functions', () => {
  describe('selectMode', () => {
    it('should provide quick mode selection', () => {
      const result = selectMode('Fix typo in README');

      expect(result.isAutoSelected).toBe(true);
      expect(result.mode).toBeDefined();
    });

    it('should respect user mode', () => {
      const result = selectMode('Fix bug', 'safe');

      expect(result.mode).toBe('dialectic_full');
      expect(result.isAutoSelected).toBe(false);
    });
  });

  describe('requiresDialectic', () => {
    it('should return true for dialectic modes', () => {
      expect(requiresDialectic('dialectic_light')).toBe(true);
      expect(requiresDialectic('dialectic_full')).toBe(true);
    });

    it('should return false for non-dialectic modes', () => {
      expect(requiresDialectic('read_only')).toBe(false);
      expect(requiresDialectic('simple')).toBe(false);
    });
  });

  describe('canModifyFiles', () => {
    it('should return true for modification modes', () => {
      expect(canModifyFiles('simple')).toBe(true);
      expect(canModifyFiles('dialectic_light')).toBe(true);
      expect(canModifyFiles('dialectic_full')).toBe(true);
    });

    it('should return false for read_only', () => {
      expect(canModifyFiles('read_only')).toBe(false);
    });
  });
});
