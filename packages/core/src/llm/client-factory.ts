/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from './llm-client.js';
import type { ProviderConfig } from './types.js';
import type { Config } from '../config/config.js';

/**
 * Create an LLM client from provider configuration.
 *
 * @param config - Provider-specific configuration
 * @param cliConfig - CLI configuration for shared settings
 * @returns An LLM client instance
 */
export async function createLLMClient(
  config: ProviderConfig,
  cliConfig: Config,
): Promise<LLMClient> {
  switch (config.type) {
    case 'qwen-oauth': {
      const { QwenOAuthProvider } = await import(
        './adapters/qwen-oauth-provider.js'
      );
      return new QwenOAuthProvider(cliConfig);
    }

    case 'gemini-oauth': {
      const { GeminiOAuthProvider } = await import(
        './adapters/gemini-oauth-provider.js'
      );
      return new GeminiOAuthProvider({
        apiKey: resolveApiKey(config),
        model: config.model,
      });
    }

    case 'openai': {
      const { OpenAIProvider } = await import('./adapters/openai-provider.js');
      return new OpenAIProvider({
        apiKey: resolveApiKey(config),
        model: config.model || 'gpt-4o',
        baseURL: config.baseURL,
      });
    }

    case 'anthropic': {
      const { AnthropicProvider } = await import(
        './adapters/anthropic-provider.js'
      );
      return new AnthropicProvider({
        apiKey: resolveApiKey(config),
        model: config.model || 'claude-sonnet-4-20250514',
      });
    }

    case 'ollama': {
      const { OllamaProvider } = await import('./adapters/ollama-provider.js');
      return new OllamaProvider({
        model: config.model || 'qwen2.5-coder:32b',
        baseURL: config.baseURL || 'http://localhost:11434',
      });
    }

    case 'openai-compatible': {
      const { OpenAICompatibleProvider } = await import(
        './adapters/openai-compatible-provider.js'
      );
      return new OpenAICompatibleProvider({
        providerName: config.name,
        apiKey: resolveApiKey(config),
        model: config.model || 'default',
        baseURL: config.baseURL!,
        supportsTools: config.supportsTools,
        supportsJsonMode: config.supportsJsonMode,
      });
    }

    case 'mistral': {
      // Mistral uses OpenAI-compatible API
      const { MistralProvider } = await import(
        './adapters/mistral-provider.js'
      );
      return new MistralProvider({
        apiKey: resolveApiKey(config),
        model: config.model || 'mistral-large-latest',
        baseURL: config.baseURL,
      });
    }

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

/**
 * Resolve API key from config, either directly or from environment variable.
 */
function resolveApiKey(config: ProviderConfig): string {
  if (config.apiKey) {
    return config.apiKey;
  }

  if (config.apiKeyEnv) {
    const value = process.env[config.apiKeyEnv];
    if (!value) {
      throw new Error(`Environment variable ${config.apiKeyEnv} is not set`);
    }
    return value;
  }

  return '';
}
