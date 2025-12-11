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
  TokenUsage,
} from '../types.js';
import type { ContentGenerator } from '../../core/contentGenerator.js';
import type { Content, Part, GenerateContentResponse } from '@google/genai';

/**
 * Adapter that wraps an existing ContentGenerator to implement LLMClient.
 *
 * This allows the dialectic system to use the existing authentication
 * and content generation infrastructure without needing separate setup.
 */
export class ContentGeneratorAdapter implements LLMClient {
  readonly name: string;
  readonly model: string;

  constructor(
    private readonly contentGenerator: ContentGenerator,
    model: string,
    name: string = 'content-generator',
  ) {
    this.model = model;
    this.name = name;
  }

  /**
   * Non-streaming completion using the ContentGenerator.
   */
  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const contents = this.convertMessagesToContents(options.messages);
    const promptId = `dialectic-${Date.now()}`;

    const response = await this.contentGenerator.generateContent(
      {
        model: this.model,
        contents,
        config: {
          temperature: options.temperature ?? 0,
          maxOutputTokens: options.maxTokens,
          stopSequences: options.stop,
        },
      },
      promptId,
    );

    return this.convertResponse(response);
  }

  /**
   * Streaming completion using the ContentGenerator.
   */
  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const contents = this.convertMessagesToContents(options.messages);
    const promptId = `dialectic-stream-${Date.now()}`;

    const streamGenerator = await this.contentGenerator.generateContentStream(
      {
        model: this.model,
        contents,
        config: {
          temperature: options.temperature ?? 0,
          maxOutputTokens: options.maxTokens,
          stopSequences: options.stop,
        },
      },
      promptId,
    );

    let chunkIndex = 0;
    for await (const chunk of streamGenerator) {
      yield this.convertChunk(chunk, chunkIndex++);
    }
  }

  supportsTools(): boolean {
    return true;
  }

  supportsJsonMode(): boolean {
    return true;
  }

  estimateTokens(messages: Message[]): number {
    // Simple estimation: ~4 chars per token
    const text = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return Math.ceil(text.length / 4);
  }

  /**
   * Convert LLM Message[] to GenAI Content[].
   */
  private convertMessagesToContents(messages: Message[]): Content[] {
    return messages.map((msg) => {
      const parts: Part[] = [];

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text' && part.text) {
            parts.push({ text: part.text });
          }
          // Image handling could be added here if needed
        }
      }

      // Map roles
      let role: 'user' | 'model';
      switch (msg.role) {
        case 'system':
        case 'user':
          role = 'user';
          break;
        case 'assistant':
          role = 'model';
          break;
        case 'tool':
          role = 'user'; // Tool responses are user messages
          break;
        default:
          role = 'user';
      }

      return { role, parts };
    });
  }

  /**
   * Convert GenAI response to LLMCompletion.
   */
  private convertResponse(response: GenerateContentResponse): LLMCompletion {
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const textParts =
      content?.parts
        ?.filter(
          (p): p is Part & { text: string } =>
            'text' in p && typeof p.text === 'string',
        )
        .map((p) => p.text)
        .join('') ?? null;

    // Extract tool calls if any
    const toolCalls: LLMToolCall[] = [];
    const functionCallParts = content?.parts?.filter(
      (
        p,
      ): p is Part & {
        functionCall: { name: string; args: Record<string, unknown> };
      } => 'functionCall' in p && p.functionCall !== undefined,
    );

    if (functionCallParts) {
      for (const part of functionCallParts) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }

    // Map finish reason
    let finishReason: LLMCompletion['finishReason'] = 'stop';
    if (candidate?.finishReason) {
      switch (candidate.finishReason) {
        case 'STOP':
          finishReason = 'stop';
          break;
        case 'MAX_TOKENS':
          finishReason = 'length';
          break;
        case 'SAFETY':
        case 'RECITATION':
        case 'BLOCKLIST':
          finishReason = 'content_filter';
          break;
        default:
          finishReason = 'stop';
      }
    }

    if (toolCalls.length > 0) {
      finishReason = 'tool_calls';
    }

    // Extract usage
    const usage: TokenUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    };

    return {
      id: `gen_${Date.now()}`,
      content: textParts,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage,
      model: this.model,
    };
  }

  /**
   * Convert streaming chunk to LLMChunk.
   */
  private convertChunk(
    response: GenerateContentResponse,
    index: number,
  ): LLMChunk {
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const textParts = content?.parts
      ?.filter(
        (p): p is Part & { text: string } =>
          'text' in p && typeof p.text === 'string',
      )
      .map((p) => p.text)
      .join('');

    let finishReason: LLMChunk['finishReason'];
    if (candidate?.finishReason) {
      switch (candidate.finishReason) {
        case 'STOP':
          finishReason = 'stop';
          break;
        case 'MAX_TOKENS':
          finishReason = 'length';
          break;
        default:
          finishReason = 'stop';
      }
    }

    return {
      id: `chunk_${index}`,
      delta: {
        content: textParts || undefined,
      },
      finishReason,
    };
  }
}

/**
 * Create an LLMClient from a ContentGenerator.
 *
 * This is the primary way to get an LLMClient for use with the dialectic system
 * when using the existing authentication infrastructure.
 */
export function createLLMClientFromContentGenerator(
  contentGenerator: ContentGenerator,
  model: string,
  name?: string,
): LLMClient {
  return new ContentGeneratorAdapter(contentGenerator, model, name);
}
