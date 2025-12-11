/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BaseAgent,
  AgentOutputError,
  isNonEmptyString,
  isArray,
  isOneOf,
} from '../base-agent.js';
import type { ValidationResult } from '../base-agent.js';
import type { AgentRole, AgentLLMConfig } from '../types.js';
import type { LLMClient } from '../../llm/llm-client.js';
import type { LLMCompletion, CompletionOptions } from '../../llm/types.js';

// Test implementation of BaseAgent
interface TestContext {
  input: string;
}

interface TestOutput {
  result: string;
  items: string[];
}

class TestAgent extends BaseAgent<TestContext, TestOutput> {
  readonly role: AgentRole = 'proposer';
  readonly displayName = 'Test Agent';

  protected formatContext(context: TestContext): string {
    return `Input: ${context.input}`;
  }

  protected validateOutput(output: TestOutput): ValidationResult {
    const errors: string[] = [];

    if (!isNonEmptyString(output.result)) {
      errors.push('result must be a non-empty string');
    }

    if (!isArray(output.items)) {
      errors.push('items must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Mock LLM client
function createMockLLMClient(responses: string[]): LLMClient {
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
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        };
      },
    ),
  } as unknown as LLMClient;
}

describe('BaseAgent', () => {
  let config: AgentLLMConfig;

  beforeEach(() => {
    config = {
      llm: 'test',
      temperature: 0.5,
      responseFormat: 'json',
    };
  });

  describe('constructor', () => {
    it('should create agent with config and system prompt', () => {
      const agent = new TestAgent(config, 'Test prompt');
      expect(agent.role).toBe('proposer');
      expect(agent.displayName).toBe('Test Agent');
    });
  });

  describe('setLLMClient', () => {
    it('should set the LLM client', () => {
      const agent = new TestAgent(config, 'Test prompt');
      const client = createMockLLMClient(['{}']);
      agent.setLLMClient(client);
      // No error thrown means success
    });
  });

  describe('generate', () => {
    it('should throw error if LLM client not set', async () => {
      const agent = new TestAgent(config, 'Test prompt');

      await expect(agent.generate({ input: 'test' })).rejects.toThrow(
        'LLM client not set for proposer agent',
      );
    });

    it('should generate output successfully', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const response = JSON.stringify({ result: 'success', items: ['a', 'b'] });
      const client = createMockLLMClient([response]);
      agent.setLLMClient(client);

      const output = await agent.generate({ input: 'test' });

      expect(output.result).toBe('success');
      expect(output.items).toEqual(['a', 'b']);
    });

    it('should extract JSON from response with extra text', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const response =
        'Here is the output:\n{"result": "extracted", "items": ["x"]}';
      const client = createMockLLMClient([response]);
      agent.setLLMClient(client);

      const output = await agent.generate({ input: 'test' });

      expect(output.result).toBe('extracted');
    });

    it('should throw AgentOutputError on empty response', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const client = createMockLLMClient(['']);
      agent.setLLMClient(client);

      await expect(agent.generate({ input: 'test' })).rejects.toThrow(
        AgentOutputError,
      );
    });

    it('should throw AgentOutputError on invalid JSON', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const client = createMockLLMClient(['not json']);
      agent.setLLMClient(client);

      await expect(agent.generate({ input: 'test' })).rejects.toThrow(
        AgentOutputError,
      );
    });

    it('should retry on validation failure', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const responses = [
        '{"result": "", "items": []}', // Invalid - empty result
        '{"result": "valid", "items": ["item"]}', // Valid
      ];
      const client = createMockLLMClient(responses);
      agent.setLLMClient(client);

      const output = await agent.generate({ input: 'test' });

      expect(output.result).toBe('valid');
      expect(client.complete).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exceeded', async () => {
      const agent = new TestAgent(config, 'Test prompt');
      const responses = [
        '{"result": "", "items": []}', // Invalid
        '{"result": "", "items": []}', // Invalid
        '{"result": "", "items": []}', // Invalid - max retries exceeded
      ];
      const client = createMockLLMClient(responses);
      agent.setLLMClient(client);

      await expect(agent.generate({ input: 'test' })).rejects.toThrow(
        AgentOutputError,
      );
      expect(client.complete).toHaveBeenCalledTimes(3);
    });
  });
});

describe('AgentOutputError', () => {
  it('should create error with role and reason', () => {
    const error = new AgentOutputError('proposer', 'Test reason');

    expect(error.name).toBe('AgentOutputError');
    expect(error.role).toBe('proposer');
    expect(error.reason).toBe('Test reason');
    expect(error.message).toContain('proposer');
    expect(error.message).toContain('Test reason');
  });

  it('should include raw output when provided', () => {
    const error = new AgentOutputError('critic', 'Parse failed', 'raw content');

    expect(error.rawOutput).toBe('raw content');
  });
});

describe('Helper functions', () => {
  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  hello  ')).toBe(true);
    });

    it('should return false for empty or whitespace strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray({})).toBe(false);
    });
  });

  describe('isOneOf', () => {
    const allowed = ['a', 'b', 'c'] as const;

    it('should return true for allowed values', () => {
      expect(isOneOf('a', allowed)).toBe(true);
      expect(isOneOf('b', allowed)).toBe(true);
      expect(isOneOf('c', allowed)).toBe(true);
    });

    it('should return false for non-allowed values', () => {
      expect(isOneOf('d', allowed)).toBe(false);
      expect(isOneOf('', allowed)).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isOneOf(123, allowed)).toBe(false);
      expect(isOneOf(null, allowed)).toBe(false);
    });
  });
});
