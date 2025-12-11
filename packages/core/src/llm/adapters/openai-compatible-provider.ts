/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OpenAIProvider,
  type OpenAIProviderConfig,
} from './openai-provider.js';

export interface OpenAICompatibleProviderConfig extends OpenAIProviderConfig {
  providerName?: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
}

/**
 * LLM provider for OpenAI-compatible APIs.
 *
 * This extends the OpenAI provider to support other services that implement
 * the OpenAI API format, such as:
 * - Together.ai
 * - Groq
 * - Fireworks
 * - Local servers (llama.cpp, etc.)
 */
export class OpenAICompatibleProvider extends OpenAIProvider {
  private _supportsTools: boolean;
  private _supportsJsonMode: boolean;

  constructor(config: OpenAICompatibleProviderConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: config.baseURL,
    });
    // Override the name from base class constructor
    (this as { name: string }).name =
      config.providerName || 'openai-compatible';
    this._supportsTools = config.supportsTools ?? false;
    this._supportsJsonMode = config.supportsJsonMode ?? false;
  }

  override supportsTools(): boolean {
    return this._supportsTools;
  }

  override supportsJsonMode(): boolean {
    return this._supportsJsonMode;
  }
}
