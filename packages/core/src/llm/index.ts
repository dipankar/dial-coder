/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Core interfaces
export type { LLMClient, AuthenticatedLLMClient } from './llm-client.js';
export { isAuthenticatedClient } from './llm-client.js';

// Types
export type {
  Message,
  MessageRole,
  ContentPart,
  LLMToolCall,
  ToolSchema,
  JSONSchema,
  ResponseFormat,
  CompletionOptions,
  TokenUsage,
  FinishReason,
  LLMCompletion,
  LLMChunk,
  ProviderConfig,
  LLMSystemConfig,
} from './types.js';

// Provider management
export { ProviderManager, createProviderManager } from './provider-manager.js';
export { createLLMClient } from './client-factory.js';

// Provider implementations
export {
  QwenOAuthProvider,
  GeminiOAuthProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  OllamaCloudProvider,
  OpenAICompatibleProvider,
} from './adapters/index.js';

export type {
  GeminiProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  OllamaProviderConfig,
  OllamaCloudProviderConfig,
  OpenAICompatibleProviderConfig,
} from './adapters/index.js';
