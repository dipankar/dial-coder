/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposerAgent } from '../proposer-agent.js';
import { CriticAgent } from '../critic-agent.js';
import { SynthesizerAgent } from '../synthesizer-agent.js';
import { ReflectorAgent } from '../reflector-agent.js';
import type { AgentLLMConfig } from '../types.js';
import type { LLMClient } from '../../llm/llm-client.js';
import type { LLMCompletion, CompletionOptions } from '../../llm/types.js';

// Mock LLM client
function createMockLLMClient(response: string): LLMClient {
  return {
    complete: vi.fn(
      async (_options: CompletionOptions): Promise<LLMCompletion> => ({
        id: 'mock-id',
        content: response,
        finishReason: 'stop',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    ),
  } as unknown as LLMClient;
}

describe('ProposerAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.7,
      responseFormat: 'json',
    };
  });

  it('should have correct role and display name', () => {
    const agent = new ProposerAgent(config);
    expect(agent.role).toBe('proposer');
    expect(agent.displayName).toBe('Planner');
  });

  it('should generate valid thesis output', async () => {
    const agent = new ProposerAgent(config);
    const response = JSON.stringify({
      analysis: 'Problem analysis',
      approach: 'Solution approach',
      plan: ['Step 1', 'Step 2'],
      patches: [
        {
          file: 'src/test.ts',
          action: 'edit',
          location: 'function foo',
          description: 'Edit foo function',
          code: 'function foo() {}',
        },
      ],
      risks: ['Risk 1'],
    });
    agent.setLLMClient(createMockLLMClient(response));

    const output = await agent.generate({
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      sessionHistory: [],
    });

    expect(output.analysis).toBe('Problem analysis');
    expect(output.approach).toBe('Solution approach');
    expect(output.plan).toHaveLength(2);
    expect(output.patches).toHaveLength(1);
    expect(output.risks).toHaveLength(1);
  });

  it('should validate required fields', async () => {
    const agent = new ProposerAgent(config);
    const response = JSON.stringify({
      analysis: '',
      approach: 'Valid approach',
      plan: [],
      patches: [],
      risks: [],
    });
    agent.setLLMClient(createMockLLMClient(response));

    await expect(
      agent.generate({
        task: {
          id: 'task-1',
          description: 'Test task',
          originalPrompt: 'Do something',
        },
        sessionId: 'session-1',
        round: 1,
        relevantFiles: [],
        projectDecisions: [],
        sessionHistory: [],
      }),
    ).rejects.toThrow();
  });
});

describe('CriticAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.3,
      responseFormat: 'json',
    };
  });

  it('should have correct role and display name', () => {
    const agent = new CriticAgent(config);
    expect(agent.role).toBe('critic');
    expect(agent.displayName).toBe('Reviewer');
  });

  it('should generate valid antithesis output', async () => {
    const agent = new CriticAgent(config);
    const response = JSON.stringify({
      overallAssessment: 'acceptable',
      strengths: ['Good approach'],
      issues: [
        {
          severity: 'medium',
          category: 'correctness',
          description: 'Potential bug',
          location: 'function foo',
          suggestion: 'Add null check',
        },
      ],
      missingConsiderations: ['Edge case'],
      questions: ['What about X?'],
    });
    agent.setLLMClient(createMockLLMClient(response));

    const output = await agent.generate({
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      thesis: {
        analysis: 'Analysis',
        approach: 'Approach',
        plan: ['Step 1'],
        patches: [],
        risks: [],
      },
      projectDecisions: [],
      failurePatterns: [],
    });

    expect(output.overallAssessment).toBe('acceptable');
    expect(output.strengths).toHaveLength(1);
    expect(output.issues).toHaveLength(1);
    expect(output.issues[0].severity).toBe('medium');
  });

  it('should validate issue severity', async () => {
    const agent = new CriticAgent(config);
    const response = JSON.stringify({
      overallAssessment: 'acceptable',
      strengths: [],
      issues: [
        {
          severity: 'invalid',
          category: 'correctness',
          description: 'Bug',
          location: 'foo',
          suggestion: 'Fix',
        },
      ],
      missingConsiderations: [],
      questions: [],
    });
    agent.setLLMClient(createMockLLMClient(response));

    await expect(
      agent.generate({
        task: {
          id: 'task-1',
          description: 'Test task',
          originalPrompt: 'Do something',
        },
        sessionId: 'session-1',
        round: 1,
        relevantFiles: [],
        thesis: {
          analysis: 'Analysis',
          approach: 'Approach',
          plan: ['Step 1'],
          patches: [],
          risks: [],
        },
        projectDecisions: [],
        failurePatterns: [],
      }),
    ).rejects.toThrow();
  });
});

describe('SynthesizerAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.2,
      responseFormat: 'json',
    };
  });

  it('should have correct role and display name', () => {
    const agent = new SynthesizerAgent(config);
    expect(agent.role).toBe('synthesizer');
    expect(agent.displayName).toBe('Resolver');
  });

  it('should generate valid synthesis output', async () => {
    const agent = new SynthesizerAgent(config);
    const response = JSON.stringify({
      resolutionSummary: 'Resolved issues',
      decisions: [
        {
          issue: 'Issue 1',
          resolution: 'accepted',
          reasoning: 'Good suggestion',
        },
      ],
      finalPlan: ['Step 1', 'Step 2'],
      patches: [
        {
          file: 'src/test.ts',
          action: 'edit',
          search: 'old code',
          replace: 'new code',
          description: 'Fix issue',
        },
      ],
      testsToRun: ['npm test'],
      confidence: 'high',
    });
    agent.setLLMClient(createMockLLMClient(response));

    const output = await agent.generate({
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      thesis: {
        analysis: 'Analysis',
        approach: 'Approach',
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
      projectInvariants: [],
      codePatterns: [],
    });

    expect(output.resolutionSummary).toBe('Resolved issues');
    expect(output.decisions).toHaveLength(1);
    expect(output.decisions[0].resolution).toBe('accepted');
    expect(output.confidence).toBe('high');
  });

  it('should validate patch requirements for edit action', async () => {
    const agent = new SynthesizerAgent(config);
    const response = JSON.stringify({
      resolutionSummary: 'Summary',
      decisions: [],
      finalPlan: ['Step 1'],
      patches: [
        {
          file: 'src/test.ts',
          action: 'edit',
          // Missing search and replace
          description: 'Edit file',
        },
      ],
      testsToRun: [],
      confidence: 'high',
    });
    agent.setLLMClient(createMockLLMClient(response));

    await expect(
      agent.generate({
        task: {
          id: 'task-1',
          description: 'Test task',
          originalPrompt: 'Do something',
        },
        sessionId: 'session-1',
        round: 1,
        relevantFiles: [],
        thesis: {
          analysis: 'Analysis',
          approach: 'Approach',
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
        projectInvariants: [],
        codePatterns: [],
      }),
    ).rejects.toThrow();
  });
});

describe('ReflectorAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.5,
      responseFormat: 'json',
    };
  });

  it('should have correct role and display name', () => {
    const agent = new ReflectorAgent(config);
    expect(agent.role).toBe('reflector');
    expect(agent.displayName).toBe('Learner');
  });

  it('should generate valid reflection output', async () => {
    const agent = new ReflectorAgent(config);
    const response = JSON.stringify({
      roundOutcome: 'success',
      lessonsLearned: [
        {
          type: 'pattern',
          scope: 'project',
          description: 'Always validate input',
          appliesTo: ['api'],
        },
      ],
      decisionsToRecord: [
        {
          scope: 'api',
          type: 'invariant',
          summary: 'Validate all inputs',
          reasoning: 'Security requirement',
        },
      ],
      improvementsForNextRound: ['Be more thorough'],
      memoryUpdates: {
        addToDecisions: true,
      },
    });
    agent.setLLMClient(createMockLLMClient(response));

    const output = await agent.generate({
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      allRounds: [],
      finalOutcome: 'success',
      existingDecisions: [],
      existingPatterns: [],
    });

    expect(output.roundOutcome).toBe('success');
    expect(output.lessonsLearned).toHaveLength(1);
    expect(output.decisionsToRecord).toHaveLength(1);
    expect(output.memoryUpdates.addToDecisions).toBe(true);
  });

  it('should validate lesson type', async () => {
    const agent = new ReflectorAgent(config);
    const response = JSON.stringify({
      roundOutcome: 'success',
      lessonsLearned: [
        {
          type: 'invalid_type',
          scope: 'project',
          description: 'Something',
          appliesTo: [],
        },
      ],
      decisionsToRecord: [],
      improvementsForNextRound: [],
      memoryUpdates: {
        addToDecisions: false,
      },
    });
    agent.setLLMClient(createMockLLMClient(response));

    await expect(
      agent.generate({
        task: {
          id: 'task-1',
          description: 'Test task',
          originalPrompt: 'Do something',
        },
        sessionId: 'session-1',
        allRounds: [],
        finalOutcome: 'success',
        existingDecisions: [],
        existingPatterns: [],
      }),
    ).rejects.toThrow();
  });
});
