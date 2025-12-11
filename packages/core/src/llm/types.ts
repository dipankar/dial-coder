/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Message roles supported by the LLM client interface.
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content part for multimodal messages.
 */
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * A message in a conversation.
 */
export interface Message {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string; // For tool messages
  toolCallId?: string; // For tool response messages
  toolCalls?: LLMToolCall[]; // For assistant messages with tool calls
}

/**
 * A tool call made by the assistant.
 * Named LLMToolCall to avoid conflict with existing LLMToolCall type.
 */
export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Schema definition for a tool/function.
 */
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
    strict?: boolean;
  };
}

/**
 * JSON Schema type definition.
 */
export interface JSONSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: Array<string | number>;
  description?: string;
  additionalProperties?: boolean;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
}

/**
 * Response format specification.
 */
export interface ResponseFormat {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: JSONSchema;
  };
}

/**
 * Options for generating a completion.
 */
export interface CompletionOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSchema[];
  toolChoice?:
    | 'auto'
    | 'none'
    | 'required'
    | { type: 'function'; function: { name: string } };
  responseFormat?: ResponseFormat;
  stop?: string[];
  seed?: number;
}

/**
 * Token usage statistics.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Reason why a completion finished.
 */
export type FinishReason =
  | 'stop'
  | 'tool_calls'
  | 'length'
  | 'content_filter'
  | 'error';

/**
 * A complete LLM response.
 */
export interface LLMCompletion {
  id: string;
  content: string | null;
  toolCalls?: LLMToolCall[];
  finishReason: FinishReason;
  usage: TokenUsage;
  model: string;
}

/**
 * A streaming chunk from an LLM.
 */
export interface LLMChunk {
  id: string;
  delta: {
    content?: string;
    toolCalls?: Array<Partial<LLMToolCall>>;
  };
  finishReason?: FinishReason;
}

/**
 * Provider configuration for creating LLM clients.
 */
export interface ProviderConfig {
  type:
    | 'qwen-oauth'
    | 'gemini-oauth'
    | 'openai'
    | 'anthropic'
    | 'ollama'
    | 'openai-compatible';
  name?: string; // Custom name for this provider instance
  model?: string;
  apiKeyEnv?: string;
  apiKey?: string;
  baseURL?: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
  enabled?: boolean;
}

/**
 * Configuration for the LLM system.
 */
export interface LLMSystemConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
}
