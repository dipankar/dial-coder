/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { isAuthenticatedClient } from '../llm-client.js';
import type { LLMClient, AuthenticatedLLMClient } from '../llm-client.js';
import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
} from '../types.js';

describe('LLMClient Interface', () => {
  describe('isAuthenticatedClient', () => {
    it('returns true for authenticated clients', () => {
      const authenticatedClient: AuthenticatedLLMClient = {
        name: 'test',
        model: 'test-model',
        complete: async () => ({}) as LLMCompletion,
        async *stream() {
          /* empty */
        },
        supportsTools: () => true,
        supportsJsonMode: () => true,
        estimateTokens: () => 0,
        initialize: async () => {},
        login: async () => {},
        logout: async () => {},
        isAuthenticated: async () => true,
      };

      expect(isAuthenticatedClient(authenticatedClient)).toBe(true);
    });

    it('returns false for non-authenticated clients', () => {
      const basicClient: LLMClient = {
        name: 'test',
        model: 'test-model',
        complete: async () => ({}) as LLMCompletion,
        async *stream() {
          /* empty */
        },
        supportsTools: () => true,
        supportsJsonMode: () => true,
        estimateTokens: () => 0,
      };

      expect(isAuthenticatedClient(basicClient)).toBe(false);
    });
  });
});

describe('Types', () => {
  it('Message types are correctly defined', () => {
    const systemMessage: Message = {
      role: 'system',
      content: 'You are a helpful assistant.',
    };

    const userMessage: Message = {
      role: 'user',
      content: 'Hello!',
    };

    const assistantMessage: Message = {
      role: 'assistant',
      content: 'Hi there!',
      toolCalls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'test_function',
            arguments: '{"arg": "value"}',
          },
        },
      ],
    };

    const toolMessage: Message = {
      role: 'tool',
      content: 'Tool result',
      toolCallId: 'call_123',
    };

    expect(systemMessage.role).toBe('system');
    expect(userMessage.role).toBe('user');
    expect(assistantMessage.role).toBe('assistant');
    expect(toolMessage.role).toBe('tool');
    expect(assistantMessage.toolCalls).toHaveLength(1);
    expect(toolMessage.toolCallId).toBe('call_123');
  });

  it('CompletionOptions types are correctly defined', () => {
    const options: CompletionOptions = {
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
      maxTokens: 1000,
      tools: [
        {
          type: 'function',
          function: {
            name: 'test',
            description: 'Test function',
            parameters: {
              type: 'object',
              properties: {
                arg: { type: 'string' },
              },
            },
          },
        },
      ],
      toolChoice: 'auto',
      responseFormat: { type: 'json_object' },
      stop: ['\n'],
      seed: 42,
    };

    expect(options.messages).toHaveLength(1);
    expect(options.temperature).toBe(0.7);
    expect(options.maxTokens).toBe(1000);
    expect(options.tools).toHaveLength(1);
    expect(options.toolChoice).toBe('auto');
    expect(options.responseFormat?.type).toBe('json_object');
    expect(options.stop).toEqual(['\n']);
    expect(options.seed).toBe(42);
  });

  it('LLMCompletion types are correctly defined', () => {
    const completion: LLMCompletion = {
      id: 'completion_123',
      content: 'Hello!',
      toolCalls: undefined,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      model: 'test-model',
    };

    expect(completion.id).toBe('completion_123');
    expect(completion.content).toBe('Hello!');
    expect(completion.finishReason).toBe('stop');
    expect(completion.usage.totalTokens).toBe(15);
  });

  it('LLMChunk types are correctly defined', () => {
    const chunk: LLMChunk = {
      id: 'chunk_123',
      delta: {
        content: 'Hello',
        toolCalls: undefined,
      },
      finishReason: undefined,
    };

    expect(chunk.id).toBe('chunk_123');
    expect(chunk.delta.content).toBe('Hello');
  });
});
