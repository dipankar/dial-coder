/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthenticatedLLMClient } from '../llm-client.js';
import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
  LLMToolCall,
} from '../types.js';
import type { Config } from '../../config/config.js';
import { DEFAULT_DIAL_MODEL } from '../../config/models.js';

/**
 * LLM provider that wraps the existing Qwen OAuth authentication system.
 *
 * This provider preserves the existing Qwen OAuth flow while implementing
 * the unified LLMClient interface. It delegates to the existing
 * QwenContentGenerator for actual API calls.
 */
export class QwenOAuthProvider implements AuthenticatedLLMClient {
  readonly name = 'qwen-oauth';
  readonly model: string;

  private cliConfig: Config;
  private qwenClient: unknown | null = null;
  private contentGenerator: unknown | null = null;

  constructor(cliConfig: Config, model?: string) {
    this.cliConfig = cliConfig;
    this.model = model || DEFAULT_DIAL_MODEL;
  }

  /**
   * Initialize the provider by loading cached credentials.
   */
  async initialize(): Promise<void> {
    const { getQwenOAuthClient } = await import('../../qwen/qwenOAuth2.js');

    try {
      this.qwenClient = await getQwenOAuthClient(this.cliConfig, {
        requireCachedCredentials: true,
      });
      await this.createContentGenerator();
    } catch {
      // No cached credentials, will need to login
      this.qwenClient = null;
      this.contentGenerator = null;
    }
  }

  /**
   * Perform the Qwen OAuth login flow.
   */
  async login(): Promise<void> {
    const { getQwenOAuthClient } = await import('../../qwen/qwenOAuth2.js');
    this.qwenClient = await getQwenOAuthClient(this.cliConfig);
    await this.createContentGenerator();
  }

  /**
   * Logout and clear credentials.
   */
  async logout(): Promise<void> {
    // Clear internal references
    this.qwenClient = null;
    this.contentGenerator = null;
  }

  /**
   * Check if authenticated.
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.qwenClient) return false;
    try {
      const client = this.qwenClient as {
        getAccessToken(): Promise<{ token?: string }>;
      };
      const result = await client.getAccessToken();
      return !!result.token;
    } catch {
      return false;
    }
  }

  /**
   * Non-streaming completion.
   */
  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    this.ensureInitialized();

    const generator = this.contentGenerator as {
      generateContent(request: unknown, userPromptId: string): Promise<unknown>;
    };
    const request = this.convertToGenAIRequest(options);
    const response = await generator.generateContent(
      request,
      `completion-${Date.now()}`,
    );

    return this.convertFromGenAIResponse(response);
  }

  /**
   * Streaming completion.
   */
  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    this.ensureInitialized();

    const generator = this.contentGenerator as {
      generateContentStream(
        request: unknown,
        userPromptId: string,
      ): Promise<AsyncGenerator<unknown>>;
    };
    const request = this.convertToGenAIRequest(options);
    const streamGenerator = await generator.generateContentStream(
      request,
      `stream-${Date.now()}`,
    );

    for await (const chunk of streamGenerator) {
      yield this.convertChunk(chunk);
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

  private ensureInitialized(): void {
    if (!this.contentGenerator) {
      throw new Error(
        'QwenOAuthProvider not initialized. Call initialize() or login() first.',
      );
    }
  }

  private async createContentGenerator(): Promise<void> {
    if (!this.qwenClient) return;

    const { QwenContentGenerator } = await import(
      '../../qwen/qwenContentGenerator.js'
    );
    type QwenContentGeneratorCtor = ConstructorParameters<
      typeof QwenContentGenerator
    >;

    // Type assertion to match the expected interface
    this.contentGenerator = new QwenContentGenerator(
      this.qwenClient as QwenContentGeneratorCtor[0],
      { model: this.model },
      this.cliConfig,
    );
  }

  /**
   * Convert from unified Message format to GenAI format.
   */
  private convertToGenAIRequest(options: CompletionOptions): {
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

    // Handle system message
    const systemMessage = options.messages.find((m) => m.role === 'system');
    if (systemMessage && contents.length > 0) {
      const systemText =
        typeof systemMessage.content === 'string' ? systemMessage.content : '';
      contents[0].parts.unshift({ text: `System: ${systemText}\n\n` });
    }

    const request: {
      contents: typeof contents;
      generationConfig?: { temperature?: number; maxOutputTokens?: number };
      tools?: Array<{
        functionDeclarations: Array<{
          name: string;
          description: string;
          parameters: Record<string, unknown>;
        }>;
      }>;
    } = { contents };

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
      id: `qwen_${Date.now()}`,
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
      id: `qwen_chunk_${Date.now()}`,
      delta: {
        content: textPart?.text,
      },
      finishReason: candidate?.finishReason
        ? this.mapFinishReason(candidate.finishReason)
        : undefined,
    };
  }

  private mapFinishReason(
    reason: string | undefined,
  ): 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error' {
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
