/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposerAgent } from '../proposer-agent.js';
import type {
  AgentLLMConfig,
  ProposerContext,
  ThesisOutput,
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

// Valid proposer context
function createValidContext(): ProposerContext {
  return {
    task: {
      id: 'task-1',
      description: 'Implement user authentication',
      originalPrompt: 'Add login functionality',
    },
    sessionId: 'session-1',
    round: 1,
    relevantFiles: [
      {
        path: 'src/auth/login.ts',
        content: 'export function login() {}',
        language: 'typescript',
      },
    ],
    projectDecisions: [
      {
        id: 'decision-1',
        scope: 'auth',
        type: 'invariant',
        summary: 'Use JWT tokens',
        reasoning: 'Industry standard',
        source: { sessionId: 'session-1', date: '2024-01-01' },
        metadata: { confidence: 'high', timesReferenced: 1 },
      },
    ],
    sessionHistory: [],
  };
}

// Valid thesis output
function createValidThesisOutput(): ThesisOutput {
  return {
    analysis:
      'The task requires implementing user authentication with JWT tokens.',
    approach:
      'We will create a login endpoint that validates credentials and returns a JWT.',
    plan: [
      'Create login handler function',
      'Add JWT token generation',
      'Implement password validation',
    ],
    patches: [
      {
        file: 'src/auth/login.ts',
        action: 'edit',
        location: 'function login',
        description: 'Add JWT token generation',
        code: 'export function login(credentials) { return jwt.sign(credentials); }',
      },
    ],
    risks: ['Token expiration needs to be configured'],
  };
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

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const agent = new ProposerAgent(config);
      expect(agent.role).toBe('proposer');
      expect(agent.displayName).toBe('Planner');
    });

    it('should accept custom config overrides', () => {
      const customConfig = { ...config, temperature: 0.5, maxTokens: 4000 };
      const agent = new ProposerAgent(customConfig);
      expect(agent.role).toBe('proposer');
    });
  });

  describe('generate', () => {
    it('should generate valid thesis output with all fields', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());

      expect(result.analysis).toBe(output.analysis);
      expect(result.approach).toBe(output.approach);
      expect(result.plan).toEqual(output.plan);
      expect(result.patches).toHaveLength(1);
      expect(result.risks).toEqual(output.risks);
    });

    it('should handle context with previous failures', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      const context = createValidContext();
      context.previousFailures = [
        {
          round: 1,
          testOutput: 'Test failed: assertion error',
          failingTests: ['test1'],
          analysis: 'Assertion did not match expected value',
        },
      ];
      context.hints = ['Consider edge cases'];

      await agent.generate(context);

      // Verify context was formatted correctly
      const callArgs = client.complete.mock.calls[0][0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Previous Failures');
      expect(userMessage.content).toContain('Hints');
    });

    it('should handle empty relevant files', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.patches = [];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const context = createValidContext();
      context.relevantFiles = [];

      const result = await agent.generate(context);
      expect(result.patches).toHaveLength(0);
    });

    it('should accumulate token usage across retries', async () => {
      const agent = new ProposerAgent(config);
      const invalidOutput = {
        analysis: '',
        approach: 'a',
        plan: [],
        patches: [],
        risks: [],
      };
      const validOutput = createValidThesisOutput();
      agent.setLLMClient(
        createMockLLMClient([
          JSON.stringify(invalidOutput),
          JSON.stringify(validOutput),
        ]),
      );

      await agent.generate(createValidContext());
      const usage = agent.getLastTokenUsage();

      expect(usage).not.toBeNull();
      expect(usage!.totalTokens).toBe(600); // 300 * 2 calls
    });

    it('should reset token usage on new generation', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await agent.generate(createValidContext());
      agent.resetTokenUsage();

      expect(agent.getLastTokenUsage()).toBeNull();
    });
  });

  describe('validation', () => {
    it('should reject empty analysis', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.analysis = '';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /analysis must be a non-empty string/i,
      );
    });

    it('should reject empty approach', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.approach = '   ';
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /approach must be a non-empty string/i,
      );
    });

    it('should reject non-array plan', async () => {
      const agent = new ProposerAgent(config);
      const output = { ...createValidThesisOutput(), plan: 'not an array' };
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /plan must be an array/i,
      );
    });

    it('should reject invalid patch action', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.patches = [
        {
          file: 'test.ts',
          action: 'invalid_action' as 'edit',
          location: 'foo',
          description: 'desc',
          code: 'code',
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /action must be one of/i,
      );
    });

    it('should reject patch with empty file path', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.patches = [
        {
          file: '',
          action: 'edit',
          location: 'foo',
          description: 'desc',
          code: 'code',
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      await expect(agent.generate(createValidContext())).rejects.toThrow(
        /file must be a non-empty string/i,
      );
    });

    it('should accept valid create action without location', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.patches = [
        {
          file: 'src/new-file.ts',
          action: 'create',
          description: 'Create new file',
          code: 'export const x = 1;',
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.patches[0].action).toBe('create');
    });

    it('should accept valid delete action', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      output.patches = [
        {
          file: 'src/deprecated.ts',
          action: 'delete',
          description: 'Remove deprecated file',
        },
      ];
      agent.setLLMClient(createMockLLMClient([JSON.stringify(output)]));

      const result = await agent.generate(createValidContext());
      expect(result.patches[0].action).toBe('delete');
    });
  });

  describe('context formatting', () => {
    it('should include task information in context', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('task-1');
      expect(userMessage.content).toContain('Implement user authentication');
    });

    it('should include relevant files with code blocks', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('src/auth/login.ts');
      expect(userMessage.content).toContain('export function login()');
    });

    it('should include project decisions', async () => {
      const agent = new ProposerAgent(config);
      const output = createValidThesisOutput();
      const client = createMockLLMClient([JSON.stringify(output)]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const userMessage = client.complete.mock.calls[0][0].messages.find(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessage.content).toContain('Use JWT tokens');
    });
  });

  describe('retry behavior', () => {
    it('should retry on validation failure and succeed', async () => {
      const agent = new ProposerAgent(config);
      const invalidOutput = {
        analysis: '',
        approach: '',
        plan: [],
        patches: [],
        risks: [],
      };
      const validOutput = createValidThesisOutput();
      const client = createMockLLMClient([
        JSON.stringify(invalidOutput),
        JSON.stringify(validOutput),
      ]);
      agent.setLLMClient(client);

      const result = await agent.generate(createValidContext());

      expect(client.complete).toHaveBeenCalledTimes(2);
      expect(result.analysis).toBe(validOutput.analysis);
    });

    it('should include error context in retry messages', async () => {
      const agent = new ProposerAgent(config);
      const invalidOutput = {
        analysis: '',
        approach: 'a',
        plan: [],
        patches: [],
        risks: [],
      };
      const validOutput = createValidThesisOutput();
      const client = createMockLLMClient([
        JSON.stringify(invalidOutput),
        JSON.stringify(validOutput),
      ]);
      agent.setLLMClient(client);

      await agent.generate(createValidContext());

      const secondCall = client.complete.mock.calls[1][0];
      const retryMessage = secondCall.messages.find(
        (m: { role: string; content: string }) =>
          m.role === 'user' && m.content.includes('validation errors'),
      );
      expect(retryMessage).toBeDefined();
      expect(retryMessage.content).toContain(
        'analysis must be a non-empty string',
      );
    });

    it('should fail after max retries', async () => {
      const agent = new ProposerAgent(config);
      const invalidOutput = {
        analysis: '',
        approach: '',
        plan: [],
        patches: [],
        risks: [],
      };
      const client = createMockLLMClient([
        JSON.stringify(invalidOutput),
        JSON.stringify(invalidOutput),
        JSON.stringify(invalidOutput),
      ]);
      agent.setLLMClient(client);

      await expect(agent.generate(createValidContext())).rejects.toThrow();
      expect(client.complete).toHaveBeenCalledTimes(3);
    });
  });
});
