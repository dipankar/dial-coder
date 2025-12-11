/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoundManager } from '../round-manager.js';
import type { RoundOptions, RoundEvent } from '../round-manager.js';
import type {
  AgentsConfig,
  ThesisOutput,
  AntithesisOutput,
  SynthesisOutput,
  VerificationResult,
} from '../../agents/types.js';
import type { LLMClient } from '../../llm/llm-client.js';
import type { LLMCompletion, CompletionOptions } from '../../llm/types.js';

// Mock LLM client factory
function createMockLLMClient(response: string | object): LLMClient {
  const content =
    typeof response === 'string' ? response : JSON.stringify(response);
  return {
    complete: vi.fn(
      async (_options: CompletionOptions): Promise<LLMCompletion> => ({
        id: 'mock-id',
        content,
        finishReason: 'stop',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      }),
    ),
  } as unknown as LLMClient;
}

// Sample valid outputs
const validThesis: ThesisOutput = {
  analysis: 'Problem analysis',
  approach: 'Solution approach',
  plan: ['Step 1', 'Step 2'],
  patches: [
    {
      file: 'src/test.ts',
      action: 'edit',
      location: 'function foo',
      description: 'Edit foo',
      code: 'function foo() { return true; }',
    },
  ],
  risks: ['Risk 1'],
};

const validAntithesis: AntithesisOutput = {
  overallAssessment: 'acceptable',
  strengths: ['Good approach'],
  issues: [
    {
      severity: 'medium',
      category: 'correctness',
      description: 'Potential issue',
      location: 'function foo',
      suggestion: 'Add validation',
    },
  ],
  missingConsiderations: [],
  questions: [],
};

const validSynthesis: SynthesisOutput = {
  resolutionSummary: 'Applied suggestions',
  decisions: [
    {
      issue: 'Potential issue',
      resolution: 'accepted',
      reasoning: 'Good suggestion',
    },
  ],
  finalPlan: ['Step 1', 'Step 2'],
  patches: [
    {
      file: 'src/test.ts',
      action: 'edit',
      search: 'function foo() {}',
      replace: 'function foo() { return true; }',
      description: 'Fix foo',
    },
  ],
  testsToRun: ['npm test'],
  confidence: 'high',
};

const successVerification: VerificationResult = {
  success: true,
  testsRun: 10,
  testsPassed: 10,
  testsFailed: 0,
  failingTests: [],
  output: 'All tests passed',
  duration: 1000,
};

describe('RoundManager', () => {
  let config: AgentsConfig;
  let verifyFn: ReturnType<typeof vi.fn>;
  let applyPatchFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      proposer: {
        llm: 'test',
        temperature: 0.7,
        responseFormat: 'json',
      },
      critic: {
        llm: 'test',
        temperature: 0.3,
        responseFormat: 'json',
      },
      synthesizer: {
        llm: 'test',
        temperature: 0.2,
        responseFormat: 'json',
      },
      reflector: {
        llm: 'test',
        temperature: 0.5,
        responseFormat: 'json',
      },
    };

    verifyFn = vi.fn().mockResolvedValue(successVerification);
    applyPatchFn = vi.fn().mockResolvedValue(true);
  });

  it('should create round manager with agents', () => {
    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    expect(manager).toBeDefined();
  });

  it('should execute a full dialectic round', async () => {
    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    const result = await manager.execute(options);

    expect(result.round).toBe(1);
    expect(result.thesis.analysis).toBe('Problem analysis');
    expect(result.antithesis.overallAssessment).toBe('acceptable');
    expect(result.synthesis.confidence).toBe('high');
    expect(result.verification.success).toBe(true);
    expect(result.outcome).toBe('success');
  });

  it('should emit events during execution', async () => {
    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const events: RoundEvent[] = [];
    manager.onEvent((event) => events.push(event));

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    await manager.execute(options);

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('thesis_start');
    expect(eventTypes).toContain('thesis_complete');
    expect(eventTypes).toContain('antithesis_start');
    expect(eventTypes).toContain('antithesis_complete');
    expect(eventTypes).toContain('synthesis_start');
    expect(eventTypes).toContain('synthesis_complete');
    expect(eventTypes).toContain('verification_start');
    expect(eventTypes).toContain('verification_complete');
    expect(eventTypes).toContain('round_complete');
  });

  it('should remove event handler with offEvent', async () => {
    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const events: RoundEvent[] = [];
    const handler = (event: RoundEvent) => events.push(event);
    manager.onEvent(handler);
    manager.offEvent(handler);

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    await manager.execute(options);

    expect(events).toHaveLength(0);
  });

  it('should return failed outcome when verification fails', async () => {
    const failedVerification: VerificationResult = {
      success: false,
      testsRun: 10,
      testsPassed: 5,
      testsFailed: 5,
      failingTests: ['test1', 'test2'],
      output: 'Some tests failed',
      duration: 1000,
    };

    verifyFn.mockResolvedValue(failedVerification);

    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    const result = await manager.execute(options);

    expect(result.outcome).toBe('partial');
  });

  it('should return failed outcome when patch application fails', async () => {
    applyPatchFn.mockResolvedValue(false);

    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    const result = await manager.execute(options);

    expect(result.outcome).toBe('failed');
    expect(result.verification.success).toBe(false);
  });

  it('should execute simple mode without critic and synthesizer', async () => {
    const manager = new RoundManager(
      config,
      {
        proposer: createMockLLMClient(validThesis),
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    const result = await manager.executeSimple(options);

    expect(result.round).toBe(1);
    expect(result.thesis.analysis).toBe('Problem analysis');
    expect(result.antithesis.overallAssessment).toBe('brief');
    expect(result.synthesis.resolutionSummary).toContain('simple mode');
    expect(result.outcome).toBe('success');
  });

  it('should emit error event on failure', async () => {
    const errorClient = {
      complete: vi.fn().mockRejectedValue(new Error('LLM error')),
    } as unknown as LLMClient;

    const manager = new RoundManager(
      config,
      {
        proposer: errorClient,
        critic: createMockLLMClient(validAntithesis),
        synthesizer: createMockLLMClient(validSynthesis),
      },
      verifyFn,
      applyPatchFn,
    );

    const events: RoundEvent[] = [];
    manager.onEvent((event) => events.push(event));

    const options: RoundOptions = {
      task: {
        id: 'task-1',
        description: 'Test task',
        originalPrompt: 'Do something',
      },
      sessionId: 'session-1',
      round: 1,
      relevantFiles: [],
      projectDecisions: [],
      projectInvariants: [],
      codePatterns: [],
    };

    await expect(manager.execute(options)).rejects.toThrow();

    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
  });
});
