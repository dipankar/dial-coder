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
  LLMToolCall,
  FinishReason,
  ToolSchema,
} from '../types.js';

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

/**
 * LLM provider for OpenAI models.
 *
 * This is a configurable provider that uses the OpenAI API.
 * It can be used with any OpenAI-compatible API by specifying a baseURL.
 */
export class OpenAIProvider implements LLMClient {
  readonly name: string;
  readonly model: string;

  protected apiKey: string;
  protected baseURL: string;

  constructor(config: OpenAIProviderConfig) {
    this.name = 'openai';
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await this.makeRequest('/chat/completions', {
      model: this.model,
      messages: this.convertMessages(options.messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools?.map((t) => this.convertTool(t)),
      tool_choice: options.toolChoice,
      response_format: options.responseFormat,
      stop: options.stop,
      seed: options.seed,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(options.messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        tools: options.tools?.map((t) => this.convertTool(t)),
        tool_choice: options.toolChoice,
        response_format: options.responseFormat,
        stop: options.stop,
        seed: options.seed,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const chunk = JSON.parse(data);
            yield this.convertStreamChunk(chunk);
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    }
  }

  supportsTools(): boolean {
    return true;
  }

  supportsJsonMode(): boolean {
    return true;
  }

  estimateTokens(messages: Message[]): number {
    const text = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return Math.ceil(text.length / 4);
  }

  protected async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  protected convertMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map((m) => {
      const msg: OpenAIMessage = {
        role: m.role,
        content:
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };

      if (m.name) msg.name = m.name;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      if (m.toolCalls) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      return msg;
    });
  }

  protected convertTool(tool: ToolSchema): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as Record<string, unknown>,
        strict: tool.function.strict,
      },
    };
  }

  protected convertResponse(response: Record<string, unknown>): LLMCompletion {
    const choices = response['choices'] as Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason: string;
    }>;
    const choice = choices[0];
    const usage = response['usage'] as
      | {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }
      | undefined;

    const toolCalls: LLMToolCall[] | undefined = choice.message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }),
    );

    return {
      id: response['id'] as string,
      content: choice.message.content,
      toolCalls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
      model: response['model'] as string,
    };
  }

  protected convertStreamChunk(chunk: Record<string, unknown>): LLMChunk {
    const choices = chunk['choices'] as Array<{
      delta: {
        content?: string;
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string;
    }>;
    const choice = choices[0];

    return {
      id: chunk['id'] as string,
      delta: {
        content: choice.delta.content,
        toolCalls: choice.delta.tool_calls?.map((tc) => ({
          id: tc.id,
          type: tc.type as 'function' | undefined,
          function: tc.function
            ? {
                name: tc.function.name || '',
                arguments: tc.function.arguments || '',
              }
            : undefined,
        })),
      },
      finishReason: choice.finish_reason
        ? this.mapFinishReason(choice.finish_reason)
        : undefined,
    };
  }

  protected mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
