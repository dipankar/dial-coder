/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Content,
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
  type GenerateContentParameters,
  GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
  type Part,
  FinishReason,
} from '@google/genai';
import type { ContentGenerator } from '../../core/contentGenerator.js';
import type { LLMClient } from '../llm-client.js';
import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
} from '../types.js';

/**
 * Adapts an LLMClient to the ContentGenerator interface.
 *
 * This allows providers that implement LLMClient (like OllamaCloudProvider)
 * to be used through the legacy ContentGenerator path.
 */
export class LlmClientContentGeneratorAdapter implements ContentGenerator {
  constructor(private readonly client: LLMClient) {}

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const options = this.toCompletionOptions(request);
    const completion = await this.client.complete(options);
    return this.toGenerateContentResponse(completion);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const options = this.toCompletionOptions(request);
    const stream = this.client.stream(options);
    return this.wrapStream(stream);
  }

  private async *wrapStream(
    stream: AsyncGenerator<LLMChunk>,
  ): AsyncGenerator<GenerateContentResponse> {
    for await (const chunk of stream) {
      yield this.chunkToGenerateContentResponse(chunk);
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const messages = this.contentsToMessages(request.contents);
    const tokens = this.client.estimateTokens(messages);
    return { totalTokens: tokens };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('embedContent is not supported by this provider');
  }

  private toCompletionOptions(
    request: GenerateContentParameters,
  ): CompletionOptions {
    const messages = this.contentsToMessages(request.contents);
    return {
      messages,
      temperature: request.config?.temperature,
      maxTokens: request.config?.maxOutputTokens,
      stop: request.config?.stopSequences,
    };
  }

  private contentsToMessages(contents: unknown): Message[] {
    // String content
    if (typeof contents === 'string') {
      return [{ role: 'user', content: contents }];
    }

    // Array of Content or Part
    if (Array.isArray(contents)) {
      return contents.map((item) => this.itemToMessage(item));
    }

    // Single Content or Part
    return [this.itemToMessage(contents)];
  }

  private itemToMessage(item: unknown): Message {
    if (this.isContent(item)) {
      const role = item.role ?? 'user';
      const parts = item.parts ?? [];
      return {
        role: this.mapRole(role),
        content: this.partsToContent(parts),
      };
    }

    // Treat as Part or string
    return {
      role: 'user',
      content: this.partToString(item),
    };
  }

  private isContent(item: unknown): item is Content {
    return (
      typeof item === 'object' &&
      item !== null &&
      'role' in item &&
      'parts' in item
    );
  }

  private mapRole(role: string): 'system' | 'user' | 'assistant' | 'tool' {
    switch (role) {
      case 'user':
        return 'user';
      case 'model':
        return 'assistant';
      default:
        return 'user';
    }
  }

  private partsToContent(parts: Part[]): string {
    return parts
      .map((part) => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }
        if ('functionResponse' in part && part.functionResponse !== undefined) {
          return JSON.stringify(part.functionResponse);
        }
        return '';
      })
      .join('');
  }

  private partToString(part: unknown): string {
    if (typeof part === 'string') return part;
    if (
      typeof part === 'object' &&
      part !== null &&
      'text' in part &&
      typeof (part as Part).text === 'string'
    ) {
      return (part as Part).text ?? '';
    }
    return '';
  }

  private toGenerateContentResponse(
    completion: LLMCompletion,
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          role: 'model',
          parts: completion.content ? [{ text: completion.content }] : [],
        },
        finishReason: this.mapFinishReason(completion.finishReason),
      },
    ];
    response.modelVersion = completion.model;
    if (completion.usage) {
      response.usageMetadata = {
        promptTokenCount: completion.usage.promptTokens,
        candidatesTokenCount: completion.usage.completionTokens,
        totalTokenCount: completion.usage.totalTokens,
      } as GenerateContentResponseUsageMetadata;
    }
    return response;
  }

  private chunkToGenerateContentResponse(
    chunk: LLMChunk,
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        content: {
          role: 'model',
          parts: chunk.delta?.content ? [{ text: chunk.delta.content }] : [],
        },
        finishReason: chunk.finishReason
          ? this.mapFinishReason(chunk.finishReason)
          : undefined,
      },
    ];
    return response;
  }

  private mapFinishReason(reason: string): FinishReason {
    switch (reason) {
      case 'stop':
      case 'tool_calls':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      case 'content_filter':
        return FinishReason.SAFETY;
      default:
        return FinishReason.FINISH_REASON_UNSPECIFIED;
    }
  }
}
