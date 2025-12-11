/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm-client.js';
import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
  FinishReason,
} from '../types.js';

export interface OllamaProviderConfig {
  model: string;
  baseURL?: string;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM provider for local Ollama models.
 *
 * This provider connects to a local Ollama server and supports
 * both streaming and non-streaming completions.
 */
export class OllamaProvider implements LLMClient {
  readonly name = 'ollama';
  readonly model: string;

  private baseURL: string;

  constructor(config: OllamaProviderConfig) {
    this.model = config.model;
    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(options.messages),
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
          stop: options.stop,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return this.convertResponse(data);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(options.messages),
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
          stop: options.stop,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            yield {
              id: `ollama_${Date.now()}`,
              delta: { content: data.message?.content },
              finishReason: data.done ? 'stop' : undefined,
            };
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    }
  }

  supportsTools(): boolean {
    // Most Ollama models don't support native tool calling
    return false;
  }

  supportsJsonMode(): boolean {
    return false;
  }

  estimateTokens(messages: Message[]): number {
    const text = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return Math.ceil(text.length / 4);
  }

  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content:
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  }

  private convertResponse(data: {
    message?: { content?: string };
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  }): LLMCompletion {
    return {
      id: `ollama_${Date.now()}`,
      content: data.message?.content ?? null,
      finishReason: this.mapFinishReason(data.done_reason),
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      model: this.model,
    };
  }

  private mapFinishReason(reason: string | undefined): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }
}
