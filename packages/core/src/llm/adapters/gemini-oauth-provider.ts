/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import type { LLMClient } from '../llm-client.js';
import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
  LLMToolCall,
  FinishReason,
} from '../types.js';

export interface GeminiProviderConfig {
  apiKey?: string;
  model?: string;
}

/**
 * LLM provider for Google Gemini models.
 *
 * This provider uses the Google GenAI SDK to interact with Gemini models.
 * It can use either an API key or OAuth authentication.
 */
export class GeminiOAuthProvider implements LLMClient {
  readonly name = 'gemini';
  readonly model: string;

  private client: GoogleGenAI;

  constructor(config: GeminiProviderConfig) {
    this.model = config.model || 'gemini-pro';
    this.client = new GoogleGenAI({
      apiKey: config.apiKey,
    });
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const request = this.convertToGenAIRequest(options);
    const response = await this.client.models.generateContent(
      request as Parameters<typeof this.client.models.generateContent>[0],
    );
    return this.convertFromGenAIResponse(response as unknown);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const request = this.convertToGenAIRequest(options);
    const streamResponse = await this.client.models.generateContentStream(
      request as Parameters<typeof this.client.models.generateContentStream>[0],
    );

    for await (const chunk of streamResponse) {
      yield this.convertChunk(chunk as unknown);
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

  /**
   * Convert from unified Message format to GenAI format.
   */
  private convertToGenAIRequest(options: CompletionOptions): {
    model: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig?: { temperature?: number; maxOutputTokens?: number };
    tools?: Array<{
      functionDeclarations: Array<{
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      }>;
    }>;
  } {
    const contents = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text: typeof m.content === 'string' ? m.content : String(m.content),
          },
        ],
      }));

    // Handle system message by prepending to first user message
    const systemMessage = options.messages.find((m) => m.role === 'system');
    if (systemMessage && contents.length > 0) {
      const systemText =
        typeof systemMessage.content === 'string' ? systemMessage.content : '';
      contents[0].parts.unshift({ text: `System: ${systemText}\n\n` });
    }

    const request: {
      model: string;
      contents: typeof contents;
      generationConfig?: { temperature?: number; maxOutputTokens?: number };
      tools?: Array<{
        functionDeclarations: Array<{
          name: string;
          description: string;
          parameters: Record<string, unknown>;
        }>;
      }>;
    } = {
      model: this.model,
      contents,
    };

    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      request.generationConfig = {};
      if (options.temperature !== undefined) {
        request.generationConfig.temperature = options.temperature;
      }
      if (options.maxTokens !== undefined) {
        request.generationConfig.maxOutputTokens = options.maxTokens;
      }
    }

    if (options.tools?.length) {
      request.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as Record<string, unknown>,
          })),
        },
      ];
    }

    return request;
  }

  /**
   * Convert from GenAI response to unified format.
   */
  private convertFromGenAIResponse(response: unknown): LLMCompletion {
    const res = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name: string; args: Record<string, unknown> };
          }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const candidate = res.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract text content
    const textParts = parts
      .filter(
        (p): p is { text: string } => 'text' in p && typeof p.text === 'string',
      )
      .map((p) => p.text);
    const content = textParts.length > 0 ? textParts.join('') : null;

    // Extract tool calls
    const toolCalls: LLMToolCall[] = parts
      .filter(
        (
          p,
        ): p is {
          functionCall: { name: string; args: Record<string, unknown> };
        } => 'functionCall' in p,
      )
      .map((p) => ({
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'function' as const,
        function: {
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args),
        },
      }));

    return {
      id: `gemini_${Date.now()}`,
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(candidate?.finishReason),
      usage: {
        promptTokens: res.usageMetadata?.promptTokenCount || 0,
        completionTokens: res.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: res.usageMetadata?.totalTokenCount || 0,
      },
      model: this.model,
    };
  }

  /**
   * Convert streaming chunk.
   */
  private convertChunk(chunk: unknown): LLMChunk {
    const ch = chunk as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const candidate = ch.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const textPart = parts.find((p): p is { text: string } => 'text' in p);

    return {
      id: `gemini_chunk_${Date.now()}`,
      delta: {
        content: textPart?.text,
      },
      finishReason: candidate?.finishReason
        ? this.mapFinishReason(candidate.finishReason)
        : undefined,
    };
  }

  private mapFinishReason(reason: string | undefined): FinishReason {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'FUNCTION_CALL':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }
}
