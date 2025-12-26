# ADR-002: Multi-LLM Provider Support

## Status

Accepted

## Context

Modern AI applications benefit from flexibility in choosing LLM providers. Different providers offer:

- Different pricing models
- Varying capabilities and specializations
- Geographic availability considerations
- Fallback options for reliability

We needed an architecture that supports multiple LLM providers while maintaining a consistent interface for the rest of the application.

## Decision

We implemented a provider abstraction layer with the following components:

### Provider Interface

```typescript
interface LLMProvider {
  generateContent(request: GenerationRequest): Promise<GenerationResponse>;
  streamContent(request: GenerationRequest): AsyncIterable<StreamChunk>;
  getModelInfo(): ModelInfo;
}
```

### Supported Providers

1. **Qwen OAuth** (Default)
   - Free tier with generous quotas
   - OAuth-based authentication
   - Automatic credential management

2. **OpenAI-Compatible**
   - Works with OpenAI API
   - Supports Alibaba Cloud Bailian
   - Supports ModelScope
   - Supports OpenRouter

3. **Gemini**
   - Google's Gemini models
   - OAuth authentication

4. **Anthropic**
   - Claude models
   - API key authentication

5. **Ollama**
   - Local model execution
   - No cloud dependency

### Provider Selection

Providers are selected based on:

1. Explicit configuration (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.)
2. OAuth authentication state
3. Fallback chain for reliability

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Content Generator                      │
├─────────────────────────────────────────────────────────┤
│                    Provider Manager                       │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│   Qwen   │  OpenAI  │  Gemini  │Anthropic │   Ollama    │
│ Provider │ Provider │ Provider │ Provider │  Provider   │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

## Consequences

### Positive

- **Flexibility**: Users can choose providers based on their needs
- **Resilience**: Fallback options when primary provider is unavailable
- **Cost optimization**: Users can select cost-effective options
- **Local development**: Ollama support enables offline development
- **Enterprise compatibility**: Supports custom API endpoints

### Negative

- **Complexity**: More code to maintain for each provider
- **Testing burden**: Need to test each provider integration
- **Feature parity**: Not all providers support all features
- **Configuration complexity**: Users need to understand provider differences

## Alternatives Considered

### Single Provider Only

Rejected because:

- Limits user choice
- Creates vendor lock-in
- No fallback options

### Plugin-based Providers

Considered but deferred because:

- Adds runtime complexity
- Security concerns with dynamic loading
- Current provider set covers most use cases
