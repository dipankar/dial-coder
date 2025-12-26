/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OpenAIProvider,
  type OpenAIProviderConfig,
} from './openai-provider.js';

export interface MistralProviderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

/**
 * LLM provider for Mistral AI models.
 *
 * Mistral uses an OpenAI-compatible API, so this extends OpenAIProvider
 * with Mistral-specific defaults.
 */
export class MistralProvider extends OpenAIProvider {
  constructor(config: MistralProviderConfig) {
    const openaiConfig: OpenAIProviderConfig = {
      apiKey: config.apiKey,
      model: config.model || 'mistral-large-latest',
      baseURL: config.baseURL || 'https://api.mistral.ai/v1',
    };
    super(openaiConfig);
    // Override the name to identify as Mistral
    (this as { name: string }).name = 'mistral';
  }
}
