/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReflectorAgent } from '../reflector-agent.js';
import type {
  AgentLLMConfig,
  ReflectorContext,
  ReflectionOutput,
} from '../types.js';
import type { LLMClient } from '../../llm/llm-client.js';
import type { LLMCompletion, CompletionOptions } from '../../llm/types.js';

// Mock LLM client factory
function createMockLLMClient(
  responses: string[],
): LLMClient & { complete: ReturnType<typeof vi.fn> } {
  let callIndex = 0;
  return {
    complete: vi.fn(
      async (_options: CompletionOptions): Promise<LLMCompletion> => {
        const content = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
          id: 'mock-id',
          content,
          finishReason: 'stop',
          model: 'mock-model',
          usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        };
      },
    ),
  } as unknown as LLMClient & { complete: ReturnType<typeof vi.fn> };
}

// Valid reflector context
function createValidContext(): ReflectorContext {
  return {
    task: {
      id: 'task-1',
      description: 'Implement feature X',
      originalPrompt: 'Add feature X',
    },
    sessionId: 'session-1',
    allRounds: [
      {
        round: 1,
        thesis: {
          analysis: 'Analysis',
          approach: 'Approach',
          plan: ['Step 1'],
          patches: [],
          risks: [],
        },
        antithesis: {
          overallAssessment: 'acceptable',
          strengths: ['Good'],
          issues: [],
          missingConsiderations: [],
          questions: [],
        },
        synthesis: {
          resolutionSummary: 'Resolved',
          decisions: [],
          finalPlan: ['Step 1'],
          patches: [],
          testsToRun: [],
          confidence: 'high',
        },
        outcome: 'success',
      },
    ],
    finalOutcome: 'success',
    existingDecisions: [],
    existingPatterns: [],
  };
}

// Valid reflection output
function createValidReflectionOutput(): ReflectionOutput {
  return {
    roundOutcome: 'success',
    lessonsLearned: [
      {
        type: 'pattern',
        scope: 'project',
        description: 'Always validate input before processing',
        appliesTo: ['api', 'handlers'],
      },
    ],
    decisionsToRecord: [
      {
        scope: 'api',
        type: 'invariant',
        summary: 'All endpoints must validate input',
        reasoning: 'Prevents security issues',
      },
    ],
    improvementsForNextRound: ['Consider more edge cases'],
    memoryUpdates: {
      addToDecisions: true,
      updatePatterns: false,
    },
  };
}

describe('ReflectorAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.5,
      responseFormat: 'json',
    };
  });

  describe('constructor', () => {
    it('should create agent with correct role and display name', () => {
      const agent = new ReflectorAgent(config);
      expect(agent.role).toBe('reflector');
      expect(agent.displayName).toBe('Learner');
    });
  });

  describe('generate', () => {
    it('should generate valid reflection output', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());

      expect(result.roundOutcome).toBe('success');
      expect(result.lessonsLearned).toHaveLength(1);
      expect(result.decisionsToRecord).toHaveLength(1);
      expect(result.memoryUpdates.addToDecisions).toBe(true);
    });

    it('should include all rounds in context', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Round 1');
    });

    it('should include existing decisions in context', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      const context = createValidContext();
      context.existingDecisions = [
        {
          scope: 'global',
          type: 'invariant',
          summary: 'Use TypeScript strict mode',
          reasoning: 'Type safety',
        },
      ];

      await agent.generate(context);

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Existing Decisions');
    });
  });

  describe('validation - round outcome', () => {
    it('should accept success outcome', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.roundOutcome = 'success';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.roundOutcome).toBe('success');
    });

    it('should accept partial outcome', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.roundOutcome = 'partial';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.roundOutcome).toBe('partial');
    });

    it('should accept failed outcome', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.roundOutcome = 'failed';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.roundOutcome).toBe('failed');
    });

    it('should reject invalid outcome', async () => {
      const agent = new ReflectorAgent(config);
      const output = {
        ...createValidReflectionOutput(),
        roundOutcome: 'unknown',
      };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /roundOutcome must be one of/i,
      );
    });
  });

  describe('validation - lessons learned', () => {
    it('should accept all valid lesson types', async () => {
      const types = [
        'pattern',
        'anti-pattern',
        'invariant',
        'heuristic',
      ] as const;

      for (const type of types) {
        const agent = new ReflectorAgent(config);
        const output = createValidReflectionOutput();
        output.lessonsLearned[0].type = type;
        agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

        const result = await agent.generate(createValidContext());
        expect(result.lessonsLearned[0].type).toBe(type);
      }
    });

    it('should reject invalid lesson type', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.lessonsLearned[0].type = 'invalid' as 'pattern';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /type must be one of/i,
      );
    });

    it('should accept all valid lesson scopes', async () => {
      const scopes = ['local', 'module', 'project', 'global'] as const;

      for (const scope of scopes) {
        const agent = new ReflectorAgent(config);
        const output = createValidReflectionOutput();
        output.lessonsLearned[0].scope = scope;
        agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

        const result = await agent.generate(createValidContext());
        expect(result.lessonsLearned[0].scope).toBe(scope);
      }
    });

    it('should reject empty lesson description', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.lessonsLearned[0].description = '';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /description must be a non-empty string/i,
      );
    });

    it('should handle multiple lessons', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.lessonsLearned = [
        {
          type: 'pattern',
          scope: 'project',
          description: 'Pattern 1',
          appliesTo: ['api'],
        },
        {
          type: 'anti-pattern',
          scope: 'global',
          description: 'Anti-pattern 1',
          appliesTo: ['all'],
        },
        {
          type: 'heuristic',
          scope: 'module',
          description: 'Heuristic 1',
          appliesTo: ['utils'],
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.lessonsLearned).toHaveLength(3);
    });
  });

  describe('validation - decisions to record', () => {
    it('should accept all valid decision types', async () => {
      const types = [
        'invariant',
        'convention',
        'constraint',
        'preference',
      ] as const;

      for (const type of types) {
        const agent = new ReflectorAgent(config);
        const output = createValidReflectionOutput();
        output.decisionsToRecord[0].type = type;
        agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

        const result = await agent.generate(createValidContext());
        expect(result.decisionsToRecord[0].type).toBe(type);
      }
    });

    it('should reject invalid decision type', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.decisionsToRecord[0].type = 'invalid' as 'invariant';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /type must be one of/i,
      );
    });

    it('should reject empty decision summary', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.decisionsToRecord[0].summary = '';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /summary must be a non-empty string/i,
      );
    });
  });

  describe('validation - memory updates', () => {
    it('should accept valid memory updates', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.memoryUpdates = {
        addToDecisions: true,
        updatePatterns: true,
        clearOldPatterns: false,
      };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.memoryUpdates.addToDecisions).toBe(true);
      expect(result.memoryUpdates.updatePatterns).toBe(true);
    });
  });

  describe('validation - empty arrays', () => {
    it('should accept empty lessons learned', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.lessonsLearned = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.lessonsLearned).toHaveLength(0);
    });

    it('should accept empty decisions to record', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.decisionsToRecord = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.decisionsToRecord).toHaveLength(0);
    });

    it('should accept empty improvements', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      output.improvementsForNextRound = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.improvementsForNextRound).toHaveLength(0);
    });
  });

  describe('token usage', () => {
    it('should track token usage correctly', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await agent.generate(createValidContext());
      const usage = agent.getLastTokenUsage();

      expect(usage!.totalTokens).toBe(300);
    });

    it('should reset token usage', async () => {
      const agent = new ReflectorAgent(config);
      const output = createValidReflectionOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await agent.generate(createValidContext());
      agent.resetTokenUsage();

      expect(agent.getLastTokenUsage()).toBeNull();
    });
  });
});
