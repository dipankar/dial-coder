/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm/llm-client.js';
import type { Message, CompletionOptions, TokenUsage } from '../llm/types.js';
import type { AgentRole, AgentLLMConfig, LLMAgent } from './types.js';

/**
 * Error thrown when agent output validation fails.
 */
export class AgentOutputError extends Error {
  readonly role: AgentRole;
  readonly reason: string;
  readonly rawOutput?: string;

  constructor(role: AgentRole, reason: string, rawOutput?: string) {
    super(`Agent ${role} output error: ${reason}`);
    this.name = 'AgentOutputError';
    this.role = role;
    this.reason = reason;
    this.rawOutput = rawOutput;
  }
}

/**
 * Base class for dialectic agents.
 *
 * Provides common functionality for:
 * - LLM client management
 * - Message formatting
 * - Output parsing and validation
 * - Retry logic
 */
export abstract class BaseAgent<TContext, TOutput>
  implements LLMAgent<TContext, TOutput>
{
  abstract readonly role: AgentRole;
  abstract readonly displayName: string;

  protected llmClient: LLMClient | null = null;
  protected config: AgentLLMConfig;
  protected systemPrompt: string;
  protected maxRetries: number = 2;

  /** Token usage from the last generation call */
  protected lastTokenUsage: TokenUsage | null = null;

  constructor(config: AgentLLMConfig, systemPrompt: string) {
    this.config = config;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Get token usage from the last generation call.
   */
  getLastTokenUsage(): TokenUsage | null {
    return this.lastTokenUsage;
  }

  /**
   * Reset token usage tracking.
   */
  resetTokenUsage(): void {
    this.lastTokenUsage = null;
  }

  /**
   * Set the LLM client for this agent.
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }

  /**
   * Generate output for the given context.
   */
  async generate(context: TContext): Promise<TOutput> {
    if (!this.llmClient) {
      throw new Error(`LLM client not set for ${this.role} agent`);
    }

    // Reset token usage for this generation
    this.lastTokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    const messages = this.buildMessages(context);
    const options = this.buildCompletionOptions(messages);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const completion = await this.llmClient.complete(options);
        const content = completion.content;

        // Accumulate token usage across retries
        if (completion.usage) {
          this.lastTokenUsage.promptTokens += completion.usage.promptTokens;
          this.lastTokenUsage.completionTokens +=
            completion.usage.completionTokens;
          this.lastTokenUsage.totalTokens += completion.usage.totalTokens;
        }

        if (!content) {
          throw new AgentOutputError(this.role, 'Empty response from LLM');
        }

        const parsed = this.parseOutput(content);
        const validated = this.validateOutput(parsed);

        if (validated.valid) {
          return parsed;
        }

        // If validation failed and we have retries left, try again with error context
        if (attempt < this.maxRetries) {
          options.messages = this.buildRetryMessages(
            messages,
            content,
            validated.errors,
          );
        } else {
          throw new AgentOutputError(
            this.role,
            `Validation failed: ${validated.errors.join(', ')}`,
            content,
          );
        }
      } catch (error) {
        if (error instanceof AgentOutputError) {
          throw error;
        }

        if (attempt >= this.maxRetries) {
          throw new AgentOutputError(
            this.role,
            `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    throw new AgentOutputError(this.role, 'Max retries exceeded');
  }

  /**
   * Build messages for the LLM call.
   */
  protected buildMessages(context: TContext): Message[] {
    return [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: this.formatContext(context) },
    ];
  }

  /**
   * Build retry messages with error context.
   */
  protected buildRetryMessages(
    originalMessages: Message[],
    previousOutput: string,
    errors: string[],
  ): Message[] {
    return [
      ...originalMessages,
      { role: 'assistant', content: previousOutput },
      {
        role: 'user',
        content: `Your previous output had validation errors:\n${errors.map((e) => `- ${e}`).join('\n')}\n\nPlease correct the output and try again. Make sure to output valid JSON in the specified format.`,
      },
    ];
  }

  /**
   * Build completion options for the LLM call.
   */
  protected buildCompletionOptions(messages: Message[]): CompletionOptions {
    const options: CompletionOptions = {
      messages,
      temperature: this.config.temperature,
    };

    if (this.config.maxTokens) {
      options.maxTokens = this.config.maxTokens;
    }

    if (this.config.responseFormat === 'json') {
      options.responseFormat = { type: 'json_object' };
    }

    return options;
  }

  /**
   * Format the context into a user message.
   * Subclasses must implement this.
   */
  protected abstract formatContext(context: TContext): string;

  /**
   * Parse the raw LLM output into the expected format.
   */
  protected parseOutput(content: string): TOutput {
    try {
      // Try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as TOutput;
      }
      return JSON.parse(content) as TOutput;
    } catch {
      throw new AgentOutputError(
        this.role,
        'Failed to parse JSON output',
        content,
      );
    }
  }

  /**
   * Validate the parsed output.
   * Subclasses must implement this.
   */
  protected abstract validateOutput(output: TOutput): ValidationResult;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Helper to check if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Helper to check if a value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Helper to check if a value is one of the allowed values.
 */
export function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}
