# Agent Development Guide

This guide explains how to develop and extend the multi-agent system in Dial Code.

## Overview

Dial Code uses a Dialectic multi-agent architecture where specialized agents collaborate in a structured pipeline:

```
Proposer → Critic → Synthesizer → [Verification] → Reflector
 (Thesis)  (Antithesis)  (Synthesis)               (Learning)
```

Each agent has a specific role:

- **Proposer**: Generates initial plans and code patches
- **Critic**: Reviews proposals for issues and risks
- **Synthesizer**: Reconciles feedback into final implementation
- **Reflector**: Extracts learnings for future improvements

## Architecture

### Package Structure

```
packages/core/src/agents/
├── types.ts           # Type definitions
├── base-agent.ts      # Abstract base class
├── prompts.ts         # System prompts
├── proposer-agent.ts  # Thesis generation
├── critic-agent.ts    # Antithesis generation
├── synthesizer-agent.ts  # Synthesis generation
├── reflector-agent.ts    # Learning extraction
└── index.ts           # Barrel exports
```

### Type Hierarchy

```typescript
// Base interface
interface Agent<TContext, TOutput> {
  role: AgentRole;
  displayName: string;
  generate(context: TContext): Promise<TOutput>;
}

// LLM-enabled agents
interface LLMAgent<TContext, TOutput> extends Agent<TContext, TOutput> {
  setLLMClient(client: LLMClient): void;
}
```

### Agent Roles

```typescript
type AgentRole = 'proposer' | 'critic' | 'synthesizer' | 'reflector';

const AGENT_DISPLAY_NAMES: Record<AgentRole, string> = {
  proposer: 'Planner',
  critic: 'Reviewer',
  synthesizer: 'Resolver',
  reflector: 'Learner',
};
```

## Creating a New Agent

### Step 1: Define Types

Create input context and output types in `types.ts`:

```typescript
// Input context
export interface MyAgentContext extends TaskContext {
  task: TaskDescription;
  sessionId: string;
  // Agent-specific inputs
  customInput: CustomInputType;
  relevantData: DataType[];
}

// Output type
export interface MyAgentOutput {
  summary: string;
  results: ResultItem[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ResultItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}
```

### Step 2: Create System Prompt

Add the system prompt in `prompts.ts`:

```typescript
export const MY_AGENT_SYSTEM_PROMPT = `You are MyAgent, a specialized assistant for [specific purpose].

## Your Role
[Describe the agent's purpose and responsibilities]

## Input Format
You will receive context in the following format:
- Task: The current task description
- Custom Input: [Description of custom input]
- Relevant Data: [Description of data]

## Output Format
Respond with a JSON object:
{
  "summary": "Brief summary of your analysis",
  "results": [
    {
      "id": "unique-id",
      "description": "What this result means",
      "priority": "low|medium|high"
    }
  ],
  "confidence": "low|medium|high"
}

## Guidelines
1. [Guideline 1]
2. [Guideline 2]
3. [Guideline 3]

## Important Constraints
- [Constraint 1]
- [Constraint 2]
`;
```

### Step 3: Implement the Agent

Create the agent class extending `BaseAgent`:

```typescript
// my-agent.ts
import { BaseAgent, AgentOutputError } from './base-agent.js';
import { MyAgentContext, MyAgentOutput, ValidationResult } from './types.js';
import { MY_AGENT_SYSTEM_PROMPT } from './prompts.js';
import { isNonEmptyString, isArray, isOneOf } from './base-agent.js';

const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;
const VALID_CONFIDENCE = ['low', 'medium', 'high'] as const;

export class MyAgent extends BaseAgent<MyAgentContext, MyAgentOutput> {
  constructor(config?: Partial<AgentLLMConfig>) {
    super(
      'my-agent' as AgentRole, // Or add to AgentRole type
      'My Agent',
      MY_AGENT_SYSTEM_PROMPT,
      {
        llm: config?.llm ?? 'default',
        temperature: config?.temperature ?? 0.5,
        responseFormat: 'json',
        ...config,
      },
    );
  }

  /**
   * Format the context for the LLM prompt
   */
  protected formatContext(context: MyAgentContext): string {
    const sections: string[] = [];

    // Task section
    sections.push('## Task');
    sections.push(`ID: ${context.task.id}`);
    sections.push(`Description: ${context.task.description}`);

    // Custom input section
    sections.push('\n## Custom Input');
    sections.push(JSON.stringify(context.customInput, null, 2));

    // Relevant data section
    sections.push('\n## Relevant Data');
    for (const item of context.relevantData) {
      sections.push(`- ${item.name}: ${item.value}`);
    }

    return sections.join('\n');
  }

  /**
   * Validate the LLM output
   */
  protected validateOutput(output: MyAgentOutput): ValidationResult {
    const errors: string[] = [];

    // Validate summary
    if (!isNonEmptyString(output.summary)) {
      errors.push('summary must be a non-empty string');
    }

    // Validate results array
    if (!isArray(output.results)) {
      errors.push('results must be an array');
    } else {
      for (let i = 0; i < output.results.length; i++) {
        const result = output.results[i];
        const itemErrors = this.validateResultItem(result, i);
        errors.push(...itemErrors);
      }
    }

    // Validate confidence
    if (!isOneOf(output.confidence, VALID_CONFIDENCE)) {
      errors.push(`confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateResultItem(item: unknown, index: number): string[] {
    const errors: string[] = [];
    const result = item as ResultItem;

    if (!isNonEmptyString(result.id)) {
      errors.push(`results[${index}].id must be a non-empty string`);
    }
    if (!isNonEmptyString(result.description)) {
      errors.push(`results[${index}].description must be a non-empty string`);
    }
    if (!isOneOf(result.priority, VALID_PRIORITIES)) {
      errors.push(
        `results[${index}].priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      );
    }

    return errors;
  }
}
```

### Step 4: Export the Agent

Add exports to `index.ts`:

```typescript
// Types
export type { MyAgentContext, MyAgentOutput, ResultItem } from './types.js';

// Prompts
export { MY_AGENT_SYSTEM_PROMPT } from './prompts.js';

// Implementation
export { MyAgent } from './my-agent.js';
```

### Step 5: Add Configuration

Add default configuration in `types.ts`:

```typescript
export const DEFAULT_AGENT_CONFIGS: AgentsConfig = {
  proposer: { llm: 'default', temperature: 0.7, responseFormat: 'json' },
  critic: { llm: 'default', temperature: 0.3, responseFormat: 'json' },
  synthesizer: { llm: 'default', temperature: 0.2, responseFormat: 'json' },
  reflector: { llm: 'fast', temperature: 0.5, responseFormat: 'json' },
  // Add your agent
  'my-agent': { llm: 'default', temperature: 0.5, responseFormat: 'json' },
};
```

## Key Patterns

### Context Formatting

Format context as a structured document for the LLM:

````typescript
protected formatContext(context: MyContext): string {
  const sections: string[] = [];

  // Use markdown headers for structure
  sections.push('## Section Name');
  sections.push('Content here...');

  // Format code blocks properly
  sections.push('```typescript');
  sections.push(context.code);
  sections.push('```');

  // Format lists
  for (const item of context.items) {
    sections.push(`- ${item.name}: ${item.value}`);
  }

  return sections.join('\n');
}
````

### Validation Pattern

Use helper functions for type-safe validation:

```typescript
import { isNonEmptyString, isArray, isOneOf } from './base-agent.js';

protected validateOutput(output: MyOutput): ValidationResult {
  const errors: string[] = [];

  // String validation
  if (!isNonEmptyString(output.name)) {
    errors.push('name must be a non-empty string');
  }

  // Array validation
  if (!isArray(output.items)) {
    errors.push('items must be an array');
  }

  // Enum validation
  if (!isOneOf(output.status, ['pending', 'done'])) {
    errors.push('status must be pending or done');
  }

  // Nested validation
  for (let i = 0; i < output.items.length; i++) {
    const itemErrors = this.validateItem(output.items[i], i);
    errors.push(...itemErrors);
  }

  return { valid: errors.length === 0, errors };
}
```

### Retry Mechanism

The `BaseAgent` automatically retries on validation failure:

```typescript
// Built-in retry logic (up to 2 retries)
async generate(context: TContext): Promise<TOutput> {
  for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
    const completion = await this.llmClient.complete(options);
    const parsed = this.parseOutput(completion.content);
    const validated = this.validateOutput(parsed);

    if (validated.valid) {
      return parsed;
    }

    // Rebuild messages with error context for retry
    if (attempt < this.maxRetries) {
      options.messages = this.buildRetryMessages(
        messages, completion.content, validated.errors
      );
    }
  }
  throw new AgentOutputError(...);
}
```

### Token Usage Tracking

Track token usage for monitoring and optimization:

```typescript
// Get token usage after execution
const output = await myAgent.generate(context);
const usage = myAgent.getLastTokenUsage();

console.log(`Tokens used: ${usage?.totalTokens}`);

// Reset for next run
myAgent.resetTokenUsage();
```

## Testing Agents

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { MyAgent } from './my-agent.js';
import { createMockLLMClient } from '@dial-code/test-utils';

describe('MyAgent', () => {
  it('should generate valid output', async () => {
    const agent = new MyAgent();
    const mockClient = createMockLLMClient({
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          summary: 'Test summary',
          results: [{ id: '1', description: 'Test result', priority: 'high' }],
          confidence: 'high',
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    });

    agent.setLLMClient(mockClient);

    const result = await agent.generate({
      task: { id: '1', description: 'Test task' },
      sessionId: 'test-session',
      customInput: { data: 'test' },
      relevantData: [],
    });

    expect(result.summary).toBe('Test summary');
    expect(result.results).toHaveLength(1);
    expect(result.confidence).toBe('high');
  });

  it('should retry on validation failure', async () => {
    const agent = new MyAgent();
    const mockClient = createMockLLMClient({
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({ summary: '', results: [] }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            summary: 'Valid summary',
            results: [],
            confidence: 'medium',
          }),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        }),
    });

    agent.setLLMClient(mockClient);

    const result = await agent.generate({
      task: { id: '1', description: 'Test task' },
      sessionId: 'test-session',
      customInput: {},
      relevantData: [],
    });

    expect(mockClient.complete).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe('Valid summary');
  });
});
```

### Validation Tests

```typescript
describe('MyAgent validation', () => {
  it('should reject empty summary', () => {
    const agent = new MyAgent();
    const result = agent['validateOutput']({
      summary: '',
      results: [],
      confidence: 'high',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('summary must be a non-empty string');
  });

  it('should reject invalid priority', () => {
    const agent = new MyAgent();
    const result = agent['validateOutput']({
      summary: 'Test',
      results: [{ id: '1', description: 'test', priority: 'invalid' }],
      confidence: 'high',
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('priority must be one of');
  });
});
```

## Best Practices

### 1. Temperature Selection

Choose temperature based on agent role:

| Role              | Temperature | Rationale            |
| ----------------- | ----------- | -------------------- |
| Creative/Proposer | 0.7-0.9     | Diverse ideas        |
| Analytical/Critic | 0.2-0.4     | Precise analysis     |
| Synthesizer       | 0.1-0.3     | Consistent decisions |
| Reflector         | 0.4-0.6     | Balanced learning    |

### 2. Context Size Management

Keep contexts focused to avoid token bloat:

```typescript
protected formatContext(context: MyContext): string {
  // Only include relevant information
  const relevantFiles = context.files.filter(f => f.isRelevant);

  // Truncate large content
  const maxFileSize = 5000;
  const truncatedFiles = relevantFiles.map(f => ({
    ...f,
    content: f.content.slice(0, maxFileSize),
  }));

  // Format concisely
  return this.formatFiles(truncatedFiles);
}
```

### 3. Error Messages

Provide actionable validation error messages:

```typescript
// Good
errors.push(`results[${i}].priority must be one of: low, medium, high`);

// Bad
errors.push('Invalid priority');
```

### 4. Idempotency

Agents should be stateless between calls:

```typescript
// Good - no mutable state
async generate(context: MyContext): Promise<MyOutput> {
  const result = await this.processContext(context);
  return result;
}

// Bad - mutable state affects subsequent calls
private cache = new Map();
async generate(context: MyContext): Promise<MyOutput> {
  this.cache.set(context.id, ...); // State leaks between calls
}
```

### 5. Logging and Observability

Use the event system for monitoring:

```typescript
// In round-manager or orchestrator
roundManager.onEvent((event) => {
  switch (event.type) {
    case 'thesis_complete':
      logger.info('Proposer completed', {
        tokenUsage: event.tokenUsage,
        outputSize: JSON.stringify(event.output).length,
      });
      break;
    case 'error':
      logger.error('Agent error', { error: event.error });
      break;
  }
});
```

## Related Documentation

- [ADR-003: Multi-Agent Architecture](../adr/003-multi-agent-architecture.md)
- [Architecture Overview](./architecture.md)
- [Testing Guide](./testing.md)
