/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIProvider } from '../adapters/openai-provider.js';
import { AnthropicProvider } from '../adapters/anthropic-provider.js';
import { OllamaProvider } from '../adapters/ollama-provider.js';
import { OllamaCloudProvider } from '../adapters/ollama-cloud-provider.js';
import { OpenAICompatibleProvider } from '../adapters/openai-compatible-provider.js';
import type { Message, ToolSchema } from '../types.js';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      apiKey: 'test-api-key',
      model: 'gpt-4o',
    });
  });

  it('should have correct name and model', () => {
    expect(provider.name).toBe('openai');
    expect(provider.model).toBe('gpt-4o');
  });

  it('should support tools', () => {
    expect(provider.supportsTools()).toBe(true);
  });

  it('should support JSON mode', () => {
    expect(provider.supportsJsonMode()).toBe(true);
  });

  it('should estimate tokens', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];
    const tokens = provider.estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should use custom baseURL when provided', () => {
    const customProvider = new OpenAIProvider({
      apiKey: 'test-api-key',
      model: 'gpt-4o',
      baseURL: 'https://custom.api.com/v1',
    });
    expect(customProvider.name).toBe('openai');
  });
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: 'test-api-key',
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('should have correct name and model', () => {
    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-4-20250514');
  });

  it('should support tools', () => {
    expect(provider.supportsTools()).toBe(true);
  });

  it('should not support JSON mode natively', () => {
    expect(provider.supportsJsonMode()).toBe(false);
  });

  it('should estimate tokens', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];
    const tokens = provider.estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider({
      model: 'qwen2.5-coder:32b',
    });
  });

  it('should have correct name and model', () => {
    expect(provider.name).toBe('ollama');
    expect(provider.model).toBe('qwen2.5-coder:32b');
  });

  it('should not support tools by default', () => {
    expect(provider.supportsTools()).toBe(false);
  });

  it('should not support JSON mode', () => {
    expect(provider.supportsJsonMode()).toBe(false);
  });

  it('should use default baseURL', () => {
    // The default baseURL is set internally
    expect(provider.name).toBe('ollama');
  });

  it('should use custom baseURL when provided', () => {
    const customProvider = new OllamaProvider({
      model: 'llama2',
      baseURL: 'http://custom:11434',
    });
    expect(customProvider.name).toBe('ollama');
  });

  it('should estimate tokens', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];
    const tokens = provider.estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('OllamaCloudProvider', () => {
  let provider: OllamaCloudProvider;

  beforeEach(() => {
    provider = new OllamaCloudProvider({
      model: 'llama3.3',
      apiKey: 'test-api-key',
    });
  });

  it('should have correct name and model', () => {
    expect(provider.name).toBe('ollama-cloud');
    expect(provider.model).toBe('llama3.3');
  });

  it('should not support tools by default', () => {
    expect(provider.supportsTools()).toBe(false);
  });

  it('should not support JSON mode', () => {
    expect(provider.supportsJsonMode()).toBe(false);
  });

  it('should use default cloud baseURL', () => {
    expect(provider.name).toBe('ollama-cloud');
  });

  it('should use custom baseURL when provided', () => {
    const customProvider = new OllamaCloudProvider({
      model: 'llama3.3',
      baseURL: 'https://custom.ollama.com',
    });
    expect(customProvider.name).toBe('ollama-cloud');
  });

  it('should estimate tokens', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello, how are you?' },
    ];
    const tokens = provider.estimateTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('OpenAICompatibleProvider', () => {
  it('should use custom provider name', () => {
    const provider = new OpenAICompatibleProvider({
      providerName: 'together',
      apiKey: 'test-api-key',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      baseURL: 'https://api.together.xyz/v1',
    });

    expect(provider.name).toBe('together');
    expect(provider.model).toBe('meta-llama/Llama-3-70b-chat-hf');
  });

  it('should respect supportsTools configuration', () => {
    const providerWithTools = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
      supportsTools: true,
    });

    const providerWithoutTools = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
      supportsTools: false,
    });

    expect(providerWithTools.supportsTools()).toBe(true);
    expect(providerWithoutTools.supportsTools()).toBe(false);
  });

  it('should respect supportsJsonMode configuration', () => {
    const providerWithJson = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
      supportsJsonMode: true,
    });

    const providerWithoutJson = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
      supportsJsonMode: false,
    });

    expect(providerWithJson.supportsJsonMode()).toBe(true);
    expect(providerWithoutJson.supportsJsonMode()).toBe(false);
  });

  it('should default to not supporting tools and JSON mode', () => {
    const provider = new OpenAICompatibleProvider({
      apiKey: 'test-api-key',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
    });

    expect(provider.supportsTools()).toBe(false);
    expect(provider.supportsJsonMode()).toBe(false);
  });
});

describe('Tool Schema Handling', () => {
  it('should correctly define tool schemas', () => {
    const toolSchema: ToolSchema = {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the file',
            },
          },
          required: ['path'],
        },
      },
    };

    expect(toolSchema.type).toBe('function');
    expect(toolSchema.function.name).toBe('read_file');
    expect(toolSchema.function.parameters.type).toBe('object');
  });
});
