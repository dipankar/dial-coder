/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CompletionOptions,
  LLMCompletion,
  LLMChunk,
  Message,
} from './types.js';

/**
 * Unified interface for interacting with any LLM provider.
 *
 * This interface abstracts away provider-specific differences and provides
 * a consistent API for:
 * - Generating completions (streaming and non-streaming)
 * - Tool/function calling
 * - JSON mode responses
 * - Token estimation
 *
 * Implementations:
 * - QwenOAuthProvider: Wraps existing Qwen OAuth authentication
 * - GeminiOAuthProvider: Wraps existing Gemini OAuth authentication
 * - OpenAIProvider: Configurable OpenAI API client
 * - AnthropicProvider: Configurable Anthropic API client
 * - OllamaProvider: Local Ollama models
 * - OpenAICompatibleProvider: Any OpenAI-compatible API
 */
export interface LLMClient {
  /**
   * Provider name for logging/debugging.
   */
  readonly name: string;

  /**
   * Model identifier being used.
   */
  readonly model: string;

  /**
   * Non-streaming completion.
   *
   * @param options - Completion parameters including messages, tools, etc.
   * @returns Complete LLM response with content and metadata
   */
  complete(options: CompletionOptions): Promise<LLMCompletion>;

  /**
   * Streaming completion.
   *
   * @param options - Completion parameters including messages, tools, etc.
   * @yields Chunks of the response as they become available
   */
  stream(options: CompletionOptions): AsyncGenerator<LLMChunk>;

  /**
   * Check if this client supports tool/function calling.
   */
  supportsTools(): boolean;

  /**
   * Check if this client supports native JSON mode responses.
   */
  supportsJsonMode(): boolean;

  /**
   * Estimate token count for a set of messages.
   *
   * @param messages - Messages to count tokens for
   * @returns Estimated token count
   */
  estimateTokens(messages: Message[]): number;
}

/**
 * Extended interface for providers that require authentication.
 */
export interface AuthenticatedLLMClient extends LLMClient {
  /**
   * Initialize the client (e.g., load cached credentials).
   */
  initialize(): Promise<void>;

  /**
   * Perform login flow.
   */
  login(): Promise<void>;

  /**
   * Logout and clear credentials.
   */
  logout(): Promise<void>;

  /**
   * Check if the client is authenticated.
   */
  isAuthenticated(): Promise<boolean>;
}

/**
 * Type guard to check if an LLMClient requires authentication.
 */
export function isAuthenticatedClient(
  client: LLMClient,
): client is AuthenticatedLLMClient {
  return (
    'initialize' in client &&
    'login' in client &&
    'logout' in client &&
    'isAuthenticated' in client
  );
}
