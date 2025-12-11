/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RoundMemory } from '../round-memory.js';
import type {
  ProblemContext,
  ThesisData,
  AntithesisData,
  SynthesisData,
  VerificationData,
} from '../types.js';

describe('RoundMemory', () => {
  let tempDir: string;
  let roundMemory: RoundMemory;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'round-memory-test-'));
    roundMemory = new RoundMemory('test-session', tempDir);
    await roundMemory.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createRound', () => {
    it('should create a new round with problem context', () => {
      const problem: ProblemContext = {
        description: 'Fix pagination bug',
        constraints: ['Must not break existing tests'],
        filesInvolved: ['src/pagination.ts'],
      };

      const round = roundMemory.createRound('task-001', 1, problem);

      expect(round.taskId).toBe('task-001');
      expect(round.round).toBe(1);
      expect(round.problem).toEqual(problem);
      expect(round.outcome).toBe('partial');
    });

    it('should allow creating multiple rounds', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.createRound('task-001', 2, problem);
      roundMemory.createRound('task-001', 3, problem);

      expect(roundMemory.getRoundCount()).toBe(3);
    });
  });

  describe('getRound', () => {
    it('should return round by number', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.createRound('task-001', 2, problem);

      const round1 = roundMemory.getRound(1);
      const round2 = roundMemory.getRound(2);

      expect(round1?.round).toBe(1);
      expect(round2?.round).toBe(2);
    });

    it('should return undefined for non-existent round', () => {
      expect(roundMemory.getRound(99)).toBeUndefined();
    });
  });

  describe('updateThesis', () => {
    it('should update thesis data for a round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);

      const thesis: ThesisData = {
        summary: 'Fix the offset calculation',
        approach: 'Modify calculateOffset function',
        patches: [
          {
            file: 'src/pagination.ts',
            description: 'Fix offset',
            type: 'modify',
          },
        ],
        risks: ['May affect performance'],
        tokenUsage: 500,
      };

      roundMemory.updateThesis(1, thesis);

      const round = roundMemory.getRound(1);
      expect(round?.thesis.summary).toBe('Fix the offset calculation');
      expect(round?.thesis.patches).toHaveLength(1);
    });
  });

  describe('updateAntithesis', () => {
    it('should update antithesis data for a round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);

      const antithesis: AntithesisData = {
        overallAssessment: 'acceptable',
        strengths: ['Good approach'],
        issues: [
          {
            severity: 'medium',
            category: 'edge_case',
            description: 'Missing page=0 handling',
            location: 'calculateOffset',
            suggestion: 'Add boundary check',
          },
        ],
        missingConsiderations: ['What about negative pages?'],
        tokenUsage: 300,
      };

      roundMemory.updateAntithesis(1, antithesis);

      const round = roundMemory.getRound(1);
      expect(round?.antithesis.overallAssessment).toBe('acceptable');
      expect(round?.antithesis.issues).toHaveLength(1);
    });
  });

  describe('updateSynthesis', () => {
    it('should update synthesis data for a round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);

      const synthesis: SynthesisData = {
        resolutionSummary: 'Added boundary validation',
        decisions: [
          {
            issue: 'Missing boundary check',
            resolution: 'accepted',
            reasoning: 'Prevents negative page values',
          },
        ],
        finalPatches: [
          {
            file: 'src/pagination.ts',
            description: 'Add validation',
            type: 'modify',
            appliedAt: new Date().toISOString(),
            success: true,
          },
        ],
        confidence: 'high',
        tokenUsage: 400,
      };

      roundMemory.updateSynthesis(1, synthesis);

      const round = roundMemory.getRound(1);
      expect(round?.synthesis.confidence).toBe('high');
      expect(round?.synthesis.decisions).toHaveLength(1);
    });
  });

  describe('updateVerification', () => {
    it('should update verification data for a round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);

      const verification: VerificationData = {
        testsRun: ['pagination.test.ts'],
        passed: true,
        failures: [],
        output: 'All tests passed',
      };

      roundMemory.updateVerification(1, verification);

      const round = roundMemory.getRound(1);
      expect(round?.verification.passed).toBe(true);
      expect(round?.verification.testsRun).toContain('pagination.test.ts');
    });
  });

  describe('setOutcome', () => {
    it('should set the outcome for a round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.setOutcome(1, 'success');

      const round = roundMemory.getRound(1);
      expect(round?.outcome).toBe('success');
    });
  });

  describe('saveRound and loadRound', () => {
    it('should save and load round from disk', async () => {
      const problem: ProblemContext = {
        description: 'Test save/load',
        constraints: ['Test constraint'],
        filesInvolved: ['test.ts'],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.setOutcome(1, 'success');
      await roundMemory.saveRound(1);

      // Create new instance to verify persistence
      const newRoundMemory = new RoundMemory('test-session', tempDir);
      const loaded = await newRoundMemory.loadRound(1);

      expect(loaded).not.toBeNull();
      expect(loaded?.problem.description).toBe('Test save/load');
      expect(loaded?.outcome).toBe('success');
    });

    it('should return null for non-existent round file', async () => {
      const loaded = await roundMemory.loadRound(999);
      expect(loaded).toBeNull();
    });
  });

  describe('loadAllRounds', () => {
    it('should load all rounds from disk', async () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.createRound('task-001', 2, problem);
      roundMemory.createRound('task-001', 3, problem);

      await roundMemory.saveRound(1);
      await roundMemory.saveRound(2);
      await roundMemory.saveRound(3);

      // Create new instance
      const newRoundMemory = new RoundMemory('test-session', tempDir);
      const rounds = await newRoundMemory.loadAllRounds();

      expect(rounds).toHaveLength(3);
      expect(rounds[0].round).toBe(1);
      expect(rounds[2].round).toBe(3);
    });
  });

  describe('extractMicroSummary', () => {
    it('should extract micro summary from round', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      const round = roundMemory.createRound('task-001', 1, problem);

      round.synthesis.resolutionSummary = 'Fixed the pagination issue';
      round.synthesis.decisions = [
        {
          issue: 'Offset calculation',
          resolution: 'accepted',
          reasoning: 'Added boundary validation',
        },
      ];
      round.outcome = 'success';

      const micro = roundMemory.extractMicroSummary(round);

      expect(micro.round).toBe(1);
      expect(micro.taskId).toBe('task-001');
      expect(micro.keyDecision).toBe('Added boundary validation');
      expect(micro.outcome).toBe('success');
    });

    it('should include failure info when round failed', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      const round = roundMemory.createRound('task-001', 1, problem);
      round.verification.failures = [
        {
          testName: 'pagination.test.ts',
          file: 'test/pagination.test.ts',
          error: 'Expected 10 but got 11',
        },
      ];
      round.outcome = 'failed';

      const micro = roundMemory.extractMicroSummary(round);

      expect(micro.keyFailure).toBe('Expected 10 but got 11');
      expect(micro.outcome).toBe('failed');
    });
  });

  describe('getTotalTokenUsage', () => {
    it('should sum token usage across all rounds', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      const round1 = roundMemory.createRound('task-001', 1, problem);
      round1.thesis.tokenUsage = 100;
      round1.antithesis.tokenUsage = 50;
      round1.synthesis.tokenUsage = 75;

      const round2 = roundMemory.createRound('task-001', 2, problem);
      round2.thesis.tokenUsage = 150;
      round2.antithesis.tokenUsage = 60;
      round2.synthesis.tokenUsage = 80;

      expect(roundMemory.getTotalTokenUsage()).toBe(515);
    });
  });

  describe('hasFailures', () => {
    it('should return true if any round failed', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.setOutcome(1, 'success');
      roundMemory.createRound('task-001', 2, problem);
      roundMemory.setOutcome(2, 'failed');

      expect(roundMemory.hasFailures()).toBe(true);
    });

    it('should return false if all rounds succeeded', () => {
      const problem: ProblemContext = {
        description: 'Test',
        constraints: [],
        filesInvolved: [],
      };

      roundMemory.createRound('task-001', 1, problem);
      roundMemory.setOutcome(1, 'success');
      roundMemory.createRound('task-001', 2, problem);
      roundMemory.setOutcome(2, 'success');

      expect(roundMemory.hasFailures()).toBe(false);
    });
  });
});
