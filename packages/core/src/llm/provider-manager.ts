/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from './llm-client.js';
import { isAuthenticatedClient } from './llm-client.js';
import type { ProviderConfig, LLMSystemConfig } from './types.js';
import type { Config } from '../config/config.js';

/**
 * Manages multiple LLM providers and handles provider selection.
 *
 * The ProviderManager is responsible for:
 * - Creating and caching LLM client instances
 * - Selecting the appropriate provider based on configuration
 * - Handling provider fallbacks
 * - Managing OAuth provider initialization
 */
export class ProviderManager {
  private clients: Map<string, LLMClient> = new Map();
  private config: LLMSystemConfig;
  private cliConfig: Config;
  private initialized = false;

  constructor(config: LLMSystemConfig, cliConfig: Config) {
    this.config = config;
    this.cliConfig = cliConfig;
  }

  /**
   * Initialize all enabled providers.
   * For OAuth providers, this loads cached credentials.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    for (const [name, providerConfig] of Object.entries(
      this.config.providers,
    )) {
      if (providerConfig.enabled === false) continue;

      try {
        const client = await this.createClient(name, providerConfig);
        this.clients.set(name, client);

        // Initialize authenticated clients
        if (isAuthenticatedClient(client)) {
          await client.initialize();
        }
      } catch (error) {
        console.warn(`Failed to initialize provider "${name}":`, error);
      }
    }

    this.initialized = true;
  }

  /**
   * Get a specific provider by name.
   */
  getClient(name: string): LLMClient {
    const client = this.clients.get(name);
    if (!client) {
      const available = Array.from(this.clients.keys()).join(', ');
      throw new Error(
        `LLM client '${name}' not found. Available: ${available || 'none'}`,
      );
    }
    return client;
  }

  /**
   * Get the default provider.
   */
  getDefaultClient(): LLMClient {
    return this.getClient(this.config.defaultProvider);
  }

  /**
   * List all available provider names.
   */
  listClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a provider is available and authenticated (if applicable).
   */
  async isProviderAvailable(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) return false;

    if (isAuthenticatedClient(client)) {
      return client.isAuthenticated();
    }

    return true;
  }

  /**
   * Get the first available provider from a list of preferences.
   */
  async getAvailableClient(
    preferences: string[] = [this.config.defaultProvider],
  ): Promise<LLMClient | null> {
    for (const name of preferences) {
      if (await this.isProviderAvailable(name)) {
        return this.getClient(name);
      }
    }
    return null;
  }

  /**
   * Register a new client dynamically.
   */
  registerClient(name: string, client: LLMClient): void {
    this.clients.set(name, client);
  }

  /**
   * Create a client from provider configuration.
   */
  private async createClient(
    name: string,
    config: ProviderConfig,
  ): Promise<LLMClient> {
    const { createLLMClient } = await import('./client-factory.js');
    return createLLMClient(config, this.cliConfig);
  }
}

/**
 * Create a ProviderManager from the CLI configuration.
 */
export function createProviderManager(cliConfig: Config): ProviderManager {
  // Build LLM system config from CLI config
  const llmConfig: LLMSystemConfig = getLLMConfigFromCLIConfig(cliConfig);
  return new ProviderManager(llmConfig, cliConfig);
}

/**
 * Extract LLM configuration from CLI config.
 * This maps the existing auth type settings to the new provider system.
 */
function getLLMConfigFromCLIConfig(_cliConfig: Config): LLMSystemConfig {
  const providers: Record<string, ProviderConfig> = {};

  // Check for Qwen OAuth
  if (process.env['QWEN_OAUTH'] === 'true') {
    providers['qwen'] = {
      type: 'qwen-oauth',
      enabled: true,
    };
  }

  // Check for Gemini API key
  const geminiApiKey =
    process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'];
  if (geminiApiKey) {
    providers['gemini'] = {
      type: 'gemini-oauth',
      apiKey: geminiApiKey,
      enabled: true,
    };
  }

  // Check for OpenAI API key
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  if (openaiApiKey) {
    providers['openai'] = {
      type: 'openai',
      apiKey: openaiApiKey,
      model: process.env['OPENAI_MODEL'] || 'gpt-4o',
      enabled: true,
    };
  }

  // Check for Anthropic API key
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicApiKey) {
    providers['anthropic'] = {
      type: 'anthropic',
      apiKey: anthropicApiKey,
      model: process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-20250514',
      enabled: true,
    };
  }

  // Check for Mistral API key
  const mistralApiKey = process.env['MISTRAL_API_KEY'];
  if (mistralApiKey) {
    providers['mistral'] = {
      type: 'mistral',
      apiKey: mistralApiKey,
      model: process.env['MISTRAL_MODEL'] || 'mistral-large-latest',
      enabled: true,
    };
  }

  // Check for Ollama
  const ollamaBaseUrl = process.env['OLLAMA_BASE_URL'];
  const ollamaModel = process.env['OLLAMA_MODEL'];
  if (ollamaBaseUrl || ollamaModel) {
    providers['ollama'] = {
      type: 'ollama',
      baseURL: ollamaBaseUrl || 'http://localhost:11434',
      model: ollamaModel || 'qwen2.5-coder:32b',
      enabled: true,
    };
  }

  // Determine default provider
  const defaultProvider =
    process.env['DIAL_PROVIDER'] ||
    (providers['qwen'] ? 'qwen' : Object.keys(providers)[0] || 'qwen');

  return {
    defaultProvider,
    providers,
  };
}
