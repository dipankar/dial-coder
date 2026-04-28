/**
 * @license
 * Copyright 2025 Neul Labs
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

export interface OllamaCloudProviderConfig {
  model: string;
  baseURL?: string;
  apiKey?: string;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaModelInfo {
  name: string;
  model?: string;
  details?: {
    parameter_size?: string;
    family?: string;
    format?: string;
  };
  size?: number;
}

interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

/**
 * LLM provider for Ollama Cloud.
 *
 * This provider connects to Ollama Cloud (https://ollama.com) and supports
 * both streaming and non-streaming completions with API key authentication.
 */
export class OllamaCloudProvider implements LLMClient {
  readonly name = 'ollama-cloud';
  readonly model: string;

  private baseURL: string;
  private apiKey?: string;

  constructor(config: OllamaCloudProviderConfig) {
    this.model = config.model;
    this.baseURL = (config.baseURL || 'https://ollama.com').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
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
      throw new Error(`Ollama Cloud API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return this.convertResponse(data);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: this.getHeaders(),
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
      throw new Error(`Ollama Cloud API error: ${response.status} ${error}`);
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
              id: `ollama_cloud_${Date.now()}`,
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

  /**
   * List available models from Ollama Cloud.
   * Requires apiKey for authenticated cloud endpoints.
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const response = await fetch(`${this.baseURL}/api/tags`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'Ollama Cloud authentication failed. Please set OLLAMA_CLOUD_API_KEY.',
        );
      }
      throw new Error(
        `Ollama Cloud model list error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return data.models || [];
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
      id: `ollama_cloud_${Date.now()}`,
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
