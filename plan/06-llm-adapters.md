# Provider Layer

This document defines Dial Code's provider abstraction layer, which preserves existing Qwen and Gemini OAuth authentication while enabling configurable API-key-based providers.

## 1. Design Goals

1. **Preserve OAuth Systems**: Keep existing Qwen (DashScope) and Gemini (Google) OAuth flows
2. **Provider Independence**: Core logic uses unified interface regardless of provider
3. **Easy Configuration**: Add new API-key providers via config, not code
4. **Unified Interface**: Same API regardless of provider quirks
5. **Tool Compatibility**: Handle tool-calling differences across providers
6. **Streaming Support**: First-class streaming for all providers
7. **Cost Tracking**: Unified token/cost tracking

## 1.1 Provider Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROVIDER CATEGORIES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OAUTH PROVIDERS (Preserved from Qwen Code)                    │
│  ──────────────────────────────────────────                    │
│  • QwenOAuthProvider - Uses existing QwenOAuthManager          │
│    └── DashScope backend, 2000 free req/day                    │
│    └── Env: QWEN_OAUTH=true                                    │
│                                                                 │
│  • GeminiOAuthProvider - Uses existing Gemini auth             │
│    └── Google account login                                    │
│    └── Env: GEMINI_API_KEY or Google OAuth                     │
│                                                                 │
│  CONFIGURABLE PROVIDERS (New)                                  │
│  ────────────────────────────                                  │
│  • OpenAIProvider - OpenAI API                                 │
│  • AnthropicProvider - Claude API                              │
│  • OllamaProvider - Local models                               │
│  • OpenAICompatibleProvider - Together, Groq, etc.             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Core Interface

### 2.1 LLMClient Interface

```typescript
// packages/core/src/llm/llm-client.ts

export interface LLMClient {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Model identifier
   */
  readonly model: string;

  /**
   * Non-streaming completion
   */
  complete(options: CompletionOptions): Promise<LLMCompletion>;

  /**
   * Streaming completion
   */
  stream(options: CompletionOptions): AsyncGenerator<LLMChunk>;

  /**
   * Check if this client supports tool calling
   */
  supportsTools(): boolean;

  /**
   * Check if this client supports JSON mode
   */
  supportsJsonMode(): boolean;

  /**
   * Get token count estimate for messages
   */
  estimateTokens(messages: Message[]): number;
}
```

### 2.2 Message Types

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string; // For tool messages
  toolCallId?: string; // For tool response messages
  toolCalls?: ToolCall[]; // For assistant messages with tool calls
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}
```

### 2.3 Completion Types

```typescript
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

export interface ResponseFormat {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: JSONSchema;
  };
}

export interface LLMCompletion {
  id: string;
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
  usage: TokenUsage;
  model: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMChunk {
  id: string;
  delta: {
    content?: string;
    toolCalls?: Partial<ToolCall>[];
  };
  finishReason?: 'stop' | 'tool_calls' | 'length';
}
```

### 2.4 Tool Schema

```typescript
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
    strict?: boolean;
  };
}

export type JSONSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: (string | number)[];
  description?: string;
  additionalProperties?: boolean;
};
```

## 3. Provider Implementations

### 3.0 OAuth Providers (Preserved)

These providers wrap the existing Qwen and Gemini authentication systems, adapting them to the unified `LLMClient` interface.

#### 3.0.1 Qwen OAuth Provider

```typescript
// packages/core/src/providers/qwen/qwen-oauth-provider.ts

import { QwenOAuthManager } from './QwenOAuthManager'; // PRESERVED
import { QwenContentGenerator } from './QwenContentGenerator'; // PRESERVED

/**
 * Wraps the existing QwenOAuthManager and QwenContentGenerator
 * to implement the LLMClient interface.
 */
export class QwenOAuthProvider implements LLMClient {
  readonly name = 'qwen-oauth';
  readonly model: string;

  private oauthManager: QwenOAuthManager;
  private contentGenerator: QwenContentGenerator;

  constructor() {
    // Use existing OAuth manager (preserved code)
    this.oauthManager = new QwenOAuthManager();
    this.model = 'qwen-coder'; // Default model
  }

  async initialize(): Promise<void> {
    // Check if already authenticated
    if (!(await this.oauthManager.isAuthenticated())) {
      await this.oauthManager.login();
    }
    this.contentGenerator = new QwenContentGenerator(this.oauthManager);
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    // Delegate to existing content generator
    const response = await this.contentGenerator.generate({
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    // Delegate to existing streaming implementation
    for await (const chunk of this.contentGenerator.streamGenerate({
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
    })) {
      yield this.convertChunk(chunk);
    }
  }

  supportsTools(): boolean {
    return true; // Qwen models support tool calling
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

  // Auth-specific methods
  async login(): Promise<void> {
    await this.oauthManager.login();
  }

  async logout(): Promise<void> {
    await this.oauthManager.logout();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.oauthManager.isAuthenticated();
  }
}
```

#### 3.0.2 Gemini OAuth Provider

```typescript
// packages/core/src/providers/gemini/gemini-oauth-provider.ts

import { GeminiContentGenerator } from './GeminiContentGenerator'; // PRESERVED

/**
 * Wraps the existing Gemini authentication and content generation
 * to implement the LLMClient interface.
 */
export class GeminiOAuthProvider implements LLMClient {
  readonly name = 'gemini-oauth';
  readonly model: string;

  private contentGenerator: GeminiContentGenerator;

  constructor(config?: { model?: string }) {
    this.model = config?.model || 'gemini-pro';
  }

  async initialize(): Promise<void> {
    // Use existing Gemini auth flow (preserved code)
    this.contentGenerator = new GeminiContentGenerator({
      model: this.model,
    });
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await this.contentGenerator.generate({
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    for await (const chunk of this.contentGenerator.streamGenerate({
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
    })) {
      yield this.convertChunk(chunk);
    }
  }

  supportsTools(): boolean {
    return true; // Gemini supports function calling
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

  // Auth-specific methods
  async login(): Promise<void> {
    // Uses existing Gemini OAuth flow
    await this.contentGenerator.authenticate();
  }

  async isAuthenticated(): Promise<boolean> {
    return this.contentGenerator.isAuthenticated();
  }
}
```

### 3.1 OpenAI Adapter (Configurable)

```typescript
// packages/core/src/llm/adapters/openai.ts

import OpenAI from 'openai';

export class OpenAIAdapter implements LLMClient {
  readonly name = 'openai';
  readonly model: string;

  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(options.messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools?.map(this.convertTool),
      tool_choice: options.toolChoice,
      response_format: options.responseFormat,
      stop: options.stop,
      seed: options.seed,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(options.messages),
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      tools: options.tools?.map(this.convertTool),
      tool_choice: options.toolChoice,
      response_format: options.responseFormat,
      stop: options.stop,
      seed: options.seed,
      stream: true,
    });

    for await (const chunk of stream) {
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
    // Use tiktoken or rough estimate
    const text = messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('');
    return Math.ceil(text.length / 4);
  }

  private convertMessages(
    messages: Message[],
  ): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      name: m.name,
      tool_call_id: m.toolCallId,
      tool_calls: m.toolCalls,
    })) as OpenAI.ChatCompletionMessageParam[];
  }

  private convertTool(tool: ToolSchema): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      },
    };
  }

  private convertResponse(response: OpenAI.ChatCompletion): LLMCompletion {
    const choice = response.choices[0];
    return {
      id: response.id,
      content: choice.message.content,
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
    };
  }
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}
```

### 3.2 Anthropic Adapter

```typescript
// packages/core/src/llm/adapters/anthropic.ts

import Anthropic from '@anthropic-ai/sdk';

export class AnthropicAdapter implements LLMClient {
  readonly name = 'anthropic';
  readonly model: string;

  private client: Anthropic;

  constructor(config: AnthropicConfig) {
    this.model = config.model;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    // Extract system message
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages.filter((m) => m.role !== 'system');

    const response = await this.client.messages.create({
      model: this.model,
      system: systemMessage?.content as string,
      messages: this.convertMessages(otherMessages),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      tools: options.tools?.map(this.convertTool),
      stop_sequences: options.stop,
    });

    return this.convertResponse(response);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages.filter((m) => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: this.model,
      system: systemMessage?.content as string,
      messages: this.convertMessages(otherMessages),
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      tools: options.tools?.map(this.convertTool),
      stop_sequences: options.stop,
    });

    for await (const event of stream) {
      const chunk = this.convertStreamEvent(event);
      if (chunk) yield chunk;
    }
  }

  supportsTools(): boolean {
    return true;
  }

  supportsJsonMode(): boolean {
    // Anthropic doesn't have native JSON mode, but we can prompt for it
    return false;
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId!,
              content: m.content as string,
            },
          ],
        };
      }

      if (m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.toolCalls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          })),
        };
      }

      return {
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      };
    });
  }

  private convertTool(tool: ToolSchema): Anthropic.Tool {
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters as Anthropic.Tool.InputSchema,
    };
  }

  private convertResponse(response: Anthropic.Message): LLMCompletion {
    const textContent = response.content.find((c) => c.type === 'text');
    const toolUses = response.content.filter((c) => c.type === 'tool_use');

    return {
      id: response.id,
      content: textContent?.type === 'text' ? textContent.text : null,
      toolCalls: toolUses.map((tu) => ({
        id: tu.type === 'tool_use' ? tu.id : '',
        type: 'function' as const,
        function: {
          name: tu.type === 'tool_use' ? tu.name : '',
          arguments: tu.type === 'tool_use' ? JSON.stringify(tu.input) : '{}',
        },
      })),
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
    };
  }
}

interface AnthropicConfig {
  apiKey: string;
  model: string;
}
```

### 3.3 OpenAI-Compatible Adapter

For providers like Together.ai, Groq, local servers:

```typescript
// packages/core/src/llm/adapters/openai-compatible.ts

export class OpenAICompatibleAdapter extends OpenAIAdapter {
  constructor(config: OpenAICompatibleConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: config.baseURL,
    });

    // Override name based on config
    (this as any).name = config.providerName || 'openai-compatible';
  }

  supportsTools(): boolean {
    // Many OpenAI-compatible providers don't support tools
    return this.config.supportsTools ?? false;
  }

  supportsJsonMode(): boolean {
    return this.config.supportsJsonMode ?? false;
  }
}

interface OpenAICompatibleConfig {
  providerName?: string;
  apiKey: string;
  model: string;
  baseURL: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
}
```

### 3.4 Ollama Adapter

```typescript
// packages/core/src/llm/adapters/ollama.ts

export class OllamaAdapter implements LLMClient {
  readonly name = 'ollama';
  readonly model: string;

  private baseURL: string;

  constructor(config: OllamaConfig) {
    this.model = config.model;
    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(options.messages),
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
          stop: options.stop,
        },
      }),
    });

    const data = await response.json();
    return this.convertResponse(data);
  }

  async *stream(options: CompletionOptions): AsyncGenerator<LLMChunk> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: this.convertMessages(options.messages),
        stream: true,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
          stop: options.stop,
        },
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          const data = JSON.parse(line);
          yield {
            id: 'ollama-' + Date.now(),
            delta: { content: data.message?.content },
            finishReason: data.done ? 'stop' : undefined,
          };
        }
      }
    }
  }

  supportsTools(): boolean {
    // Ollama tool support depends on the model
    return false;
  }

  supportsJsonMode(): boolean {
    return false;
  }

  private convertMessages(
    messages: Message[],
  ): { role: string; content: string }[] {
    return messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));
  }
}

interface OllamaConfig {
  model: string;
  baseURL?: string;
}
```

## 4. Client Factory

```typescript
// packages/core/src/llm/client-factory.ts

export class LLMClientFactory {
  static create(config: ProviderConfig): LLMClient {
    switch (config.provider) {
      case 'openai':
        return new OpenAIAdapter({
          apiKey: this.resolveEnvVar(config.apiKeyEnv),
          model: config.model,
          baseURL: config.baseURL,
        });

      case 'anthropic':
        return new AnthropicAdapter({
          apiKey: this.resolveEnvVar(config.apiKeyEnv),
          model: config.model,
        });

      case 'openai-compatible':
        return new OpenAICompatibleAdapter({
          providerName: config.providerName,
          apiKey: this.resolveEnvVar(config.apiKeyEnv),
          model: config.model,
          baseURL: config.baseURL!,
          supportsTools: config.supportsTools,
          supportsJsonMode: config.supportsJsonMode,
        });

      case 'ollama':
        return new OllamaAdapter({
          model: config.model,
          baseURL: config.baseURL,
        });

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  private static resolveEnvVar(envVar?: string): string {
    if (!envVar) return '';
    const value = process.env[envVar];
    if (!value) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return value;
  }
}

export interface ProviderConfig {
  provider: 'openai' | 'anthropic' | 'openai-compatible' | 'ollama';
  providerName?: string;
  model: string;
  apiKeyEnv?: string;
  baseURL?: string;
  supportsTools?: boolean;
  supportsJsonMode?: boolean;
}
```

## 5. Client Manager

Manages multiple configured clients:

```typescript
// packages/core/src/llm/client-manager.ts

export class LLMClientManager {
  private clients: Map<string, LLMClient> = new Map();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients(): void {
    for (const [name, providerConfig] of Object.entries(this.config.llms)) {
      const client = LLMClientFactory.create(providerConfig);
      this.clients.set(name, client);
    }
  }

  getClient(name: string): LLMClient {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(
        `LLM client '${name}' not found. Available: ${Array.from(this.clients.keys()).join(', ')}`,
      );
    }
    return client;
  }

  getDefaultClient(): LLMClient {
    return this.getClient('default');
  }

  listClients(): string[] {
    return Array.from(this.clients.keys());
  }

  // Get client for specific agent role
  getClientForAgent(role: AgentRole): LLMClient {
    const agentConfig = this.config.agents[role];
    return this.getClient(agentConfig.llm);
  }
}

export interface LLMConfig {
  llms: Record<string, ProviderConfig>;
  agents: Record<AgentRole, { llm: string }>;
}
```

## 6. Configuration Examples

### 6.1 Single Provider (Simple)

```json
{
  "llms": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKeyEnv": "OPENAI_API_KEY"
    }
  },
  "agents": {
    "proposer": { "llm": "default" },
    "critic": { "llm": "default" },
    "synthesizer": { "llm": "default" },
    "reflector": { "llm": "default" }
  }
}
```

### 6.2 Multi-Provider (Mixed)

```json
{
  "llms": {
    "anthropic-main": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    },
    "openai-fast": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "together-cheap": {
      "provider": "openai-compatible",
      "providerName": "together",
      "model": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "apiKeyEnv": "TOGETHER_API_KEY",
      "baseURL": "https://api.together.xyz/v1",
      "supportsTools": true
    }
  },
  "agents": {
    "proposer": { "llm": "anthropic-main" },
    "critic": { "llm": "openai-fast" },
    "synthesizer": { "llm": "anthropic-main" },
    "reflector": { "llm": "together-cheap" }
  }
}
```

### 6.3 Local-First (Ollama)

```json
{
  "llms": {
    "local": {
      "provider": "ollama",
      "model": "qwen2.5-coder:32b",
      "baseURL": "http://localhost:11434"
    },
    "fallback": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    }
  },
  "agents": {
    "proposer": { "llm": "local" },
    "critic": { "llm": "local" },
    "synthesizer": { "llm": "local" },
    "reflector": { "llm": "local" }
  }
}
```

## 7. Tool Compatibility Layer

Handle differences in tool-calling across providers:

````typescript
// packages/core/src/llm/tool-compatibility.ts

export class ToolCompatibilityLayer {
  /**
   * For providers without native tool support, inject tools into system prompt
   */
  static injectToolsIntoPrompt(
    messages: Message[],
    tools: ToolSchema[],
  ): Message[] {
    const toolDescription = this.formatToolsForPrompt(tools);

    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const enhancedSystem: Message = {
      role: 'system',
      content: `${systemMessage?.content || ''}

## Available Tools

You have access to the following tools. To use a tool, respond with a JSON object in this format:
\`\`\`json
{"tool": "tool_name", "arguments": {...}}
\`\`\`

${toolDescription}

When you need to use a tool, output ONLY the JSON object, nothing else.
`,
    };

    return [enhancedSystem, ...otherMessages];
  }

  /**
   * Parse tool calls from text response (for providers without native tool calls)
   */
  static parseToolCallsFromText(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Match JSON tool call patterns
    const pattern = /```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.tool) {
          toolCalls.push({
            id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            type: 'function',
            function: {
              name: parsed.tool,
              arguments: JSON.stringify(parsed.arguments || {}),
            },
          });
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return toolCalls;
  }

  private static formatToolsForPrompt(tools: ToolSchema[]): string {
    return tools
      .map(
        (tool) => `
### ${tool.function.name}
${tool.function.description}

Parameters:
\`\`\`json
${JSON.stringify(tool.function.parameters, null, 2)}
\`\`\`
`,
      )
      .join('\n');
  }
}
````

## 8. JSON Mode Compatibility

Handle JSON response format across providers:

````typescript
// packages/core/src/llm/json-compatibility.ts

export class JSONCompatibilityLayer {
  /**
   * Request JSON output, handling provider differences
   */
  static async requestJSON<T>(
    client: LLMClient,
    options: CompletionOptions,
    schema?: JSONSchema,
  ): Promise<T> {
    if (client.supportsJsonMode()) {
      // Native JSON mode
      const response = await client.complete({
        ...options,
        responseFormat: schema
          ? { type: 'json_schema', json_schema: { name: 'response', schema } }
          : { type: 'json_object' },
      });

      return JSON.parse(response.content!);
    }

    // Prompt-based JSON
    const enhancedMessages = this.addJSONInstructions(options.messages, schema);
    const response = await client.complete({
      ...options,
      messages: enhancedMessages,
    });

    return this.extractJSON(response.content!);
  }

  private static addJSONInstructions(
    messages: Message[],
    schema?: JSONSchema,
  ): Message[] {
    const instruction = schema
      ? `\n\nYou MUST respond with valid JSON matching this schema:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\nRespond with ONLY the JSON object, no other text.`
      : '\n\nYou MUST respond with valid JSON. Respond with ONLY the JSON object, no other text.';

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');
    if (!lastUserMessage) return messages;

    return messages.map((m) =>
      m === lastUserMessage ? { ...m, content: m.content + instruction } : m,
    );
  }

  private static extractJSON<T>(text: string): T {
    // Try direct parse
    try {
      return JSON.parse(text);
    } catch {}

    // Try extracting from code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim());
    }

    // Try finding JSON object in text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not extract JSON from response');
  }
}
````

## 9. Cost Tracking

Track token usage and costs across providers:

```typescript
// packages/core/src/llm/cost-tracker.ts

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'claude-sonnet-4-20250514': {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8 / 1_000_000,
    output: 4.0 / 1_000_000,
  },
};

export class CostTracker {
  private totalTokens = 0;
  private totalCost = 0;
  private byModel: Map<string, { tokens: number; cost: number }> = new Map();

  record(model: string, usage: TokenUsage): void {
    const pricing = PRICING[model] || { input: 0, output: 0 };
    const cost =
      usage.promptTokens * pricing.input +
      usage.completionTokens * pricing.output;

    this.totalTokens += usage.totalTokens;
    this.totalCost += cost;

    const existing = this.byModel.get(model) || { tokens: 0, cost: 0 };
    this.byModel.set(model, {
      tokens: existing.tokens + usage.totalTokens,
      cost: existing.cost + cost,
    });
  }

  getSummary(): CostSummary {
    return {
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      byModel: Object.fromEntries(this.byModel),
    };
  }

  reset(): void {
    this.totalTokens = 0;
    this.totalCost = 0;
    this.byModel.clear();
  }
}

interface CostSummary {
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
}
```

## 10. Retry and Fallback

Handle transient failures and rate limits:

```typescript
// packages/core/src/llm/retry-handler.ts

export class RetryHandler {
  private retryDelays = [1000, 2000, 4000, 8000]; // Exponential backoff

  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay =
            this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      // Rate limits, timeouts, server errors
      const retryablePatterns = [
        /rate limit/i,
        /timeout/i,
        /429/,
        /500/,
        /502/,
        /503/,
        /504/,
      ];
      return retryablePatterns.some((p) => p.test(error.message));
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface RetryOptions {
  maxRetries?: number;
}

// Fallback wrapper
export class FallbackClient implements LLMClient {
  readonly name: string;
  readonly model: string;

  constructor(
    private primary: LLMClient,
    private fallback: LLMClient,
  ) {
    this.name = `${primary.name}+${fallback.name}`;
    this.model = primary.model;
  }

  async complete(options: CompletionOptions): Promise<LLMCompletion> {
    try {
      return await this.primary.complete(options);
    } catch (error) {
      console.warn(`Primary LLM failed, falling back: ${error}`);
      return await this.fallback.complete(options);
    }
  }

  // ... implement other methods similarly
}
```

## 11. Testing Adapters

```typescript
// packages/core/src/llm/__tests__/adapters.test.ts

describe('LLM Adapters', () => {
  describe('OpenAIAdapter', () => {
    test('converts messages correctly', async () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test',
        model: 'gpt-4o',
      });

      const messages: Message[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ];

      // Mock the OpenAI client
      // ... test implementation
    });
  });

  describe('ToolCompatibilityLayer', () => {
    test('parses tool calls from text', () => {
      const text = `I'll use a tool:
\`\`\`json
{"tool": "read_file", "arguments": {"path": "src/index.ts"}}
\`\`\``;

      const calls = ToolCompatibilityLayer.parseToolCallsFromText(text);
      expect(calls).toHaveLength(1);
      expect(calls[0].function.name).toBe('read_file');
    });
  });
});
```
