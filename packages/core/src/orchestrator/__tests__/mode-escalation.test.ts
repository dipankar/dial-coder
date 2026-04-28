/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModeEscalationManager,
  createEscalationManager,
  canEscalate,
  getNextEscalationLevel,
} from '../mode-escalation.js';
import type { RoundResult } from '../../agents/types.js';

// Helper to create mock round results
function createMockRoundResult(
  overrides: Partial<RoundResult> = {},
): RoundResult {
  return {
    round: 1,
    thesis: {
      analysis: 'Test analysis',
      approach: 'Test approach',
      plan: ['Step 1'],
      patches: [],
      risks: [],
    },
    antithesis: {
      overallAssessment: 'acceptable',
      strengths: [],
      issues: [],
      missingConsiderations: [],
      questions: [],
    },
    synthesis: {
      resolutionSummary: 'Test resolution',
      decisions: [],
      finalPlan: ['Step 1'],
      patches: [],
      testsToRun: [],
      confidence: 'high',
    },
    verification: {
      success: true,
      testsRun: 10,
      testsPassed: 10,
      testsFailed: 0,
      failingTests: [],
      output: 'All tests passed',
      duration: 1000,
    },
    outcome: 'success',
    ...overrides,
  };
}

describe('ModeEscalationManager', () => {
  let manager: ModeEscalationManager;

  beforeEach(() => {
    manager = new ModeEscalationManager('simple');
  });

  describe('getCurrentMode', () => {
    it('should return initial mode', () => {
      expect(manager.getCurrentMode()).toBe('simple');
    });
  });

  describe('checkEscalation', () => {
    it('should not escalate for successful rounds', () => {
      const result = createMockRoundResult();
      const check = manager.checkEscalation(result);

      expect(check.shouldEscalate).toBe(false);
    });

    it('should escalate for critical issues', () => {
      const result = createMockRoundResult({
        antithesis: {
          overallAssessment: 'critical',
          strengths: [],
          issues: [
            {
              severity: 'critical',
              category: 'security',
              description: 'SQL injection vulnerability',
              location: 'auth.ts',
              suggestion: 'Use parameterized queries',
            },
          ],
          missingConsiderations: [],
          questions: [],
        },
      });

      const check = manager.checkEscalation(result);

      expect(check.shouldEscalate).toBe(true);
      expect(check.trigger).toBe('critical_issue');
      expect(check.newMode).toBe('dialectic_full');
    });

    it('should escalate after multiple test failures', () => {
      // Record first failure
      const failedRound1 = createMockRoundResult({
        verification: {
          success: false,
          testsRun: 10,
          testsPassed: 5,
          testsFailed: 5,
          failingTests: ['test1', 'test2'],
          output: 'Tests failed',
          duration: 1000,
        },
        outcome: 'failed',
      });
      manager.recordRound(failedRound1);

      // Check after second failure
      const failedRound2 = createMockRoundResult({
        verification: {
          success: false,
          testsRun: 10,
          testsPassed: 3,
          testsFailed: 7,
          failingTests: ['test1', 'test2', 'test3'],
          output: 'Tests failed',
          duration: 1000,
        },
        outcome: 'failed',
      });

      const check = manager.checkEscalation(failedRound2);

      expect(check.shouldEscalate).toBe(true);
      expect(check.trigger).toBe('test_failure');
    });

    it('should escalate for low confidence', () => {
      // Record a low confidence round
      const lowConfidenceRound = createMockRoundResult({
        synthesis: {
          resolutionSummary: 'Uncertain resolution',
          decisions: [],
          finalPlan: ['Step 1'],
          patches: [],
          testsToRun: [],
          confidence: 'low',
        },
      });
      manager.recordRound(lowConfidenceRound);

      // Check with another low confidence round
      const check = manager.checkEscalation(lowConfidenceRound);

      expect(check.shouldEscalate).toBe(true);
      expect(check.trigger).toBe('low_confidence');
    });

    it('should not escalate when already at max mode', () => {
      const fullManager = new ModeEscalationManager('dialectic_full');
      const result = createMockRoundResult({
        antithesis: {
          overallAssessment: 'critical',
          strengths: [],
          issues: [
            {
              severity: 'critical',
              category: 'security',
              description: 'Critical issue',
              location: 'file.ts',
              suggestion: 'Fix it',
            },
          ],
          missingConsiderations: [],
          questions: [],
        },
      });

      const check = fullManager.checkEscalation(result);

      expect(check.shouldEscalate).toBe(false);
    });

    it('should not escalate when disabled', () => {
      const disabledManager = new ModeEscalationManager('simple', {
        enabled: false,
      });
      const result = createMockRoundResult({
        antithesis: {
          overallAssessment: 'critical',
          strengths: [],
          issues: [
            {
              severity: 'critical',
              category: 'security',
              description: 'Critical issue',
              location: 'file.ts',
              suggestion: 'Fix it',
            },
          ],
          missingConsiderations: [],
          questions: [],
        },
      });

      const check = disabledManager.checkEscalation(result);

      expect(check.shouldEscalate).toBe(false);
    });

    it('should escalate for low proposer confidence', () => {
      const lowConfidenceRound = createMockRoundResult({
        thesis: {
          analysis: 'Test',
          approach: 'Test',
          plan: ['Step 1'],
          patches: [],
          risks: [],
          confidence: 0.5,
        },
      });
      manager.recordRound(lowConfidenceRound);

      const check = manager.checkEscalation(lowConfidenceRound);

      expect(check.shouldEscalate).toBe(true);
      expect(check.trigger).toBe('low_confidence');
    });

    it('should escalate for high issue count', () => {
      const result = createMockRoundResult({
        antithesis: {
          overallAssessment: 'concerning',
          strengths: [],
          issues: [
            { severity: 'high', category: 'correctness', description: 'Bug 1', location: 'a.ts', suggestion: 'Fix 1' },
            { severity: 'high', category: 'correctness', description: 'Bug 2', location: 'b.ts', suggestion: 'Fix 2' },
            { severity: 'medium', category: 'maintainability', description: 'Bug 3', location: 'c.ts', suggestion: 'Fix 3' },
          ],
          missingConsiderations: [],
          questions: [],
        },
      });

      const check = manager.checkEscalation(result);

      expect(check.shouldEscalate).toBe(true);
      expect(check.trigger).toBe('critical_issue');
    });
  });

  describe('escalate', () => {
    it('should update current mode', () => {
      manager.escalate('dialectic_light', 'Test reason', 'test_failure');

      expect(manager.getCurrentMode()).toBe('dialectic_light');
    });

    it('should record escalation event', () => {
      manager.escalate(
        'dialectic_full',
        'Critical issue found',
        'critical_issue',
      );

      const history = manager.getEscalationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].fromMode).toBe('simple');
      expect(history[0].toMode).toBe('dialectic_full');
      expect(history[0].reason).toBe('Critical issue found');
      expect(history[0].trigger).toBe('critical_issue');
    });
  });

  describe('forceEscalate', () => {
    it('should allow escalation to stricter mode', () => {
      const event = manager.forceEscalate('dialectic_full');

      expect(event).not.toBeNull();
      expect(event?.toMode).toBe('dialectic_full');
      expect(event?.trigger).toBe('user_request');
    });

    it('should not allow downgrade', () => {
      const fullManager = new ModeEscalationManager('dialectic_full');
      const event = fullManager.forceEscalate('simple');

      expect(event).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset to new initial mode', () => {
      manager.escalate('dialectic_full', 'Test', 'test_failure');
      manager.reset('simple');

      expect(manager.getCurrentMode()).toBe('simple');
      expect(manager.getEscalationHistory()).toHaveLength(0);
    });
  });

  describe('getEscalationSummary', () => {
    it('should return summary without escalations', () => {
      const summary = manager.getEscalationSummary();

      expect(summary).toContain('quick');
      expect(summary).toContain('no escalations');
    });

    it('should return summary with escalations', () => {
      manager.escalate('dialectic_light', 'Test reason', 'test_failure');

      const summary = manager.getEscalationSummary();

      expect(summary).toContain('review');
      expect(summary).toContain('escalated');
    });
  });
});

describe('helper functions', () => {
  describe('createEscalationManager', () => {
    it('should create manager with initial mode', () => {
      const manager = createEscalationManager('dialectic_light');

      expect(manager.getCurrentMode()).toBe('dialectic_light');
    });

    it('should accept custom config', () => {
      const manager = createEscalationManager('simple', {
        testFailureThreshold: 5,
      });

      expect(manager.getCurrentMode()).toBe('simple');
    });
  });

  describe('canEscalate', () => {
    it('should return true when escalation possible', () => {
      expect(canEscalate('simple')).toBe(true);
      expect(canEscalate('dialectic_light')).toBe(true);
    });

    it('should return false at max mode', () => {
      expect(canEscalate('dialectic_full')).toBe(false);
    });

    it('should respect custom max mode', () => {
      expect(canEscalate('simple', 'dialectic_light')).toBe(true);
      expect(canEscalate('dialectic_light', 'dialectic_light')).toBe(false);
    });
  });

  describe('getNextEscalationLevel', () => {
    it('should return next level', () => {
      expect(getNextEscalationLevel('read_only')).toBe('simple');
      expect(getNextEscalationLevel('simple')).toBe('dialectic_light');
      expect(getNextEscalationLevel('dialectic_light')).toBe('dialectic_full');
    });

    it('should return null at max level', () => {
      expect(getNextEscalationLevel('dialectic_full')).toBeNull();
    });
  });
});
