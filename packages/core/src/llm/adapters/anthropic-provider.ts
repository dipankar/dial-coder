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

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * LLM provider for Anthropic Claude models.
 *
 * This provider implements the Anthropic Messages API, handling the
 * differences between Anthropic's format and the unified interface.
 */
export class AnthropicProvider implements LLMClient {
  readonly name = 'anthropic';
  readonly model: string;

  private apiKey: string;
  private baseURL = 'https://api.anthropic.com/v1';

  constructor(config: AnthropicProviderConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages.filter((m) => m.role !== 'system');

    const response = await this.makeRequest('/messages', {
      model: this.model,
      system:
        typeof systemMessage?.content === 'string'
          ? systemMessage.content
          : undefined,
      messages: this.convertMessages(otherMessages),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      tools: options.tools?.map((t) => this.convertTool(t)),
      stop_sequences: options.stop,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages.filter((m) => m.role !== 'system');

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        system:
          typeof systemMessage?.content === 'string'
            ? systemMessage.content
            : undefined,
        messages: this.convertMessages(otherMessages),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature,
        tools: options.tools?.map((t) => this.convertTool(t)),
        stop_sequences: options.stop,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentId = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            const chunk = this.convertStreamEvent(event, currentId);
            if (chunk) {
              if (event.type === 'message_start') {
                currentId = event.message?.id || '';
              }
              yield chunk;
            }
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
    // Anthropic doesn't have native JSON mode
    return false;
  }

  estimateTokens(messages: Message[]): number {
    const text = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return Math.ceil(text.length / 4);
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  private convertMessages(messages: Message[]): AnthropicMessage[] {
    return messages.map((m) => {
      // Handle tool response messages
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId!,
              content:
                typeof m.content === 'string'
                  ? m.content
                  : JSON.stringify(m.content),
            },
          ],
        };
      }

      // Handle assistant messages with tool calls
      if (m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.toolCalls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          })),
        };
      }

      // Regular messages
      return {
        role: m.role as 'user' | 'assistant',
        content:
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      };
    });
  }

  private convertTool(tool: ToolSchema): AnthropicTool {
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters as Record<string, unknown>,
    };
  }

  private convertResponse(response: Record<string, unknown>): LLMCompletion {
    const content = response['content'] as AnthropicContentBlock[];
    const textContent = content.find((c) => c.type === 'text');
    const toolUses = content.filter((c) => c.type === 'tool_use');

    const toolCalls: LLMToolCall[] = toolUses.map((tu) => ({
      id: tu.id!,
      type: 'function' as const,
      function: {
        name: tu.name!,
        arguments: JSON.stringify(tu.input),
      },
    }));

    const usage = response['usage'] as
      | {
          input_tokens: number;
          output_tokens: number;
        }
      | undefined;

    return {
      id: response['id'] as string,
      content: textContent?.text ?? null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(
        response['stop_reason'] as string | undefined,
      ),
      usage: {
        promptTokens: usage?.input_tokens ?? 0,
        completionTokens: usage?.output_tokens ?? 0,
        totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
      },
      model: response['model'] as string,
    };
  }

  private convertStreamEvent(
    event: Record<string, unknown>,
    currentId: string,
  ): LLMChunk | null {
    switch (event['type']) {
      case 'content_block_delta': {
        const delta = event['delta'] as { type: string; text?: string };
        if (delta.type === 'text_delta') {
          return {
            id: currentId,
            delta: {
              content: delta.text,
            },
          };
        }
        break;
      }
      case 'message_delta': {
        const delta = event['delta'] as { stop_reason?: string };
        if (delta.stop_reason) {
          return {
            id: currentId,
            delta: {},
            finishReason: this.mapFinishReason(delta.stop_reason),
          };
        }
        break;
      }
      default:
        // Ignore other event types
        break;
    }
    return null;
  }

  private mapFinishReason(reason: string | undefined): FinishReason {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
