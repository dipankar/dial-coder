# Architecture Overview: Dial Code

This document describes the target architecture for Dial Code, transforming from a single-agent ReAct loop to a dialectic multi-agent system while preserving existing Qwen and Gemini OAuth authentication.

## 1. Current Architecture (Inherited from Qwen Code)

### Request Flow

```
CLI Entry (gemini.tsx)
       ↓
Authentication (OAuth or API Key)
       ↓
Content Generator Selection
       ↓
Single-Agent Chat Loop (GeminiChat)
  ├── System Prompt
  ├── User Message
  ├── LLM Response
  └── Tool Calls → Execute → Continue
       ↓
Tool Execution (CoreToolScheduler)
       ↓
Response to User
```

### Current Packages

```
packages/
├── cli/         # CLI frontend (React/Ink)
├── core/        # Agent engine, tools, config
├── test-utils/  # Testing utilities
└── vscode-ide-companion/  # VS Code extension
```

### Limitations

1. **Single-agent loop** - No built-in critique or review
2. **Gemini-centric naming** - Mixed Gemini/Qwen terminology
3. **No dialectic memory** - Basic conversation history only
4. **Fixed mode** - No adaptive mode switching
5. **Tight LLM coupling** - Provider logic mixed with orchestration

## 2. Target Architecture

### High-Level View

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dial CLI                                │
│  (React/Ink UI, Commands, I18n)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mode Selector                                │
│  (Analyzes task → selects: simple | light | full)              │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Simple     │      │  Dialectic  │      │  Dialectic  │
│  (ReAct)    │      │  Light      │      │  Full       │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Dialectic Orchestrator                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ Proposer │ → │  Critic  │ → │Synthesizer│ → │ Reflector│    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Layer                               │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ PRESERVED AUTH (OAuth)                                     ││
│  │  ┌──────────────┐  ┌──────────────┐                       ││
│  │  │ Qwen OAuth   │  │ Gemini OAuth │                       ││
│  │  │ (DashScope)  │  │ (Google)     │                       ││
│  │  └──────────────┘  └──────────────┘                       ││
│  └────────────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────────────┐│
│  │ CONFIGURABLE (API Key)                                     ││
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐            ││
│  │  │ OpenAI │ │ Anthropic│ │ Ollama │ │ Custom │            ││
│  │  └────────┘ └──────────┘ └────────┘ └────────┘            ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Layer                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ File   │ │ Search │ │ Shell  │ │ Git    │ │ Tests  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Layer                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │   Round    │ │  Session   │ │  Project   │                  │
│  │  Memory    │ │  Memory    │ │  Memory    │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### New Package Structure

```
packages/
├── cli/              # CLI frontend (@dial-coder/cli)
│   ├── src/
│   │   ├── dial.tsx           # Main entry (renamed from gemini.tsx)
│   │   ├── ui/                # UI components
│   │   ├── commands/          # Slash commands
│   │   └── i18n/              # Internationalization
│   └── package.json
│
├── core/             # Core agent engine (@dial-coder/core)
│   ├── src/
│   │   ├── orchestrator/      # NEW: Dialectic orchestration
│   │   │   ├── index.ts
│   │   │   ├── dialectic-controller.ts
│   │   │   ├── mode-selector.ts
│   │   │   └── round-manager.ts
│   │   │
│   │   ├── agents/            # NEW: Agent role definitions
│   │   │   ├── index.ts
│   │   │   ├── proposer.ts
│   │   │   ├── critic.ts
│   │   │   ├── synthesizer.ts
│   │   │   └── reflector.ts
│   │   │
│   │   ├── providers/         # Provider implementations
│   │   │   ├── index.ts
│   │   │   ├── provider-interface.ts  # Common interface
│   │   │   ├── provider-manager.ts    # Provider selection
│   │   │   │
│   │   │   ├── qwen/          # PRESERVED: Qwen OAuth
│   │   │   │   ├── QwenOAuthManager.ts
│   │   │   │   ├── QwenContentGenerator.ts
│   │   │   │   └── dashscope-provider.ts
│   │   │   │
│   │   │   ├── gemini/        # PRESERVED: Gemini OAuth
│   │   │   │   └── GeminiContentGenerator.ts
│   │   │   │
│   │   │   └── configurable/  # NEW: API-key providers
│   │   │       ├── openai.ts
│   │   │       ├── anthropic.ts
│   │   │       ├── ollama.ts
│   │   │       └── openai-compatible.ts
│   │   │
│   │   ├── memory/            # NEW: Dialectic memory
│   │   │   ├── index.ts
│   │   │   ├── round-memory.ts
│   │   │   ├── session-memory.ts
│   │   │   ├── project-memory.ts
│   │   │   └── compaction.ts
│   │   │
│   │   ├── core/              # Existing (renamed)
│   │   │   ├── dialChat.ts    # Renamed from geminiChat
│   │   │   ├── dialRequest.ts # Renamed from geminiRequest
│   │   │   └── ...
│   │   │
│   │   ├── tools/             # Existing tools (unchanged)
│   │   ├── config/            # Configuration
│   │   └── telemetry/         # Event logging
│   └── package.json
│
├── test-utils/       # Testing utilities
└── vscode-ide-companion/  # VS Code extension
```

## 3. Core Components

### 3.1 Mode Selector

Determines which execution mode to use based on task analysis.

```typescript
// packages/core/src/orchestrator/mode-selector.ts

export type ExecutionMode =
  | 'simple'
  | 'dialectic_light'
  | 'dialectic_full'
  | 'read_only';

export interface ModeSelector {
  selectMode(context: TaskContext): Promise<ExecutionMode>;
}

export interface TaskContext {
  prompt: string;
  repoContext: RepoContext;
  filesToTouch?: string[];
  previousFailures?: TestFailure[];
}

// Mode selection criteria
const MODE_RULES = {
  read_only: {
    patterns: [/explain/i, /what does/i, /summarize?/i, /how does/i],
    description: 'Information retrieval only',
  },
  simple: {
    patterns: [/fix typo/i, /add comment/i, /rename/i, /small edit/i],
    maxFiles: 2,
    description: 'Single-pass, fast execution',
  },
  dialectic_light: {
    patterns: [/fix bug/i, /failing test/i, /update/i],
    maxFiles: 5,
    description: 'Single dialectic round with review',
  },
  dialectic_full: {
    patterns: [/refactor/i, /migration/i, /rewrite/i, /feature/i, /security/i],
    criticalPaths: ['auth', 'billing', 'migrations', 'db'],
    description: 'Full multi-round dialectic with tests',
  },
};
```

### 3.2 Dialectic Orchestrator

Manages the thesis-antithesis-synthesis loop.

```typescript
// packages/core/src/orchestrator/dialectic-controller.ts

export interface DialecticController {
  runTask(
    task: TaskContext,
    mode: ExecutionMode,
  ): AsyncGenerator<DialecticEvent>;
}

export interface DialecticEvent {
  type:
    | 'thesis'
    | 'antithesis'
    | 'synthesis'
    | 'verification'
    | 'reflection'
    | 'complete';
  round: number;
  data:
    | ThesisData
    | AntithesisData
    | SynthesisData
    | VerificationData
    | ReflectionData;
}

export interface RoundResult {
  round: number;
  thesis: ThesisData;
  antithesis: AntithesisData;
  synthesis: SynthesisData;
  verification: VerificationData;
  outcome: 'success' | 'partial' | 'failed';
}
```

### 3.3 LLM Client Interface

Provider-agnostic interface for LLM calls.

```typescript
// packages/core/src/llm/llm-client.ts

export interface LLMClient {
  name: string;
  complete(opts: CompletionOptions): Promise<LLMCompletion>;
  stream(opts: CompletionOptions): AsyncGenerator<LLMChunk>;
}

export interface CompletionOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSchema[];
  responseFormat?: 'text' | 'json';
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface LLMCompletion {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}
```

### 3.4 Agent Definitions

Each agent role has its own configuration and system prompt.

```typescript
// packages/core/src/agents/index.ts

export type AgentRole = 'proposer' | 'critic' | 'synthesizer' | 'reflector';

export interface AgentConfig {
  id: string;
  role: AgentRole;
  llm: string; // References LLMClient by name
  systemPrompt: string;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AgentRegistry {
  getAgent(role: AgentRole): AgentConfig;
  setAgent(role: AgentRole, config: AgentConfig): void;
}
```

### 3.5 Memory System

Hierarchical memory for dialectic context.

```typescript
// packages/core/src/memory/index.ts

export interface MemorySystem {
  // Round level
  saveRound(sessionId: string, round: RoundMemory): Promise<void>;
  getRounds(sessionId: string): Promise<RoundMemory[]>;

  // Session level
  saveSession(session: SessionMemory): Promise<void>;
  getSession(sessionId: string): Promise<SessionMemory | null>;

  // Project level
  getProjectDecisions(scope?: string): Promise<Decision[]>;
  addProjectDecision(decision: Decision): Promise<void>;
  getArchitecture(): Promise<string>;

  // Compaction
  compactSession(sessionId: string): Promise<SessionSummary>;
  compactProject(): Promise<void>;
}
```

## 4. Configuration System

### User Configuration (`~/.dial/config.json`)

```json
{
  "llms": {
    "default": {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "fast": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "anthropic": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    }
  },
  "agents": {
    "proposer": { "llm": "default" },
    "critic": { "llm": "default" },
    "synthesizer": { "llm": "default" },
    "reflector": { "llm": "fast" }
  },
  "modes": {
    "default": "auto",
    "dialectic": {
      "maxRounds": 3,
      "runTestsAfterSynthesis": true
    }
  }
}
```

### Project Configuration (`.dial/config.json`)

```json
{
  "extends": "~/.dial/config.json",
  "testCommand": "npm test",
  "buildCommand": "npm run build",
  "criticalPaths": ["src/auth/", "src/db/", "migrations/"],
  "agents": {
    "critic": {
      "systemPromptExtras": "Pay special attention to SQL injection in this codebase."
    }
  }
}
```

## 5. Data Flow Examples

### Example 1: Simple Mode (Single-Agent)

```
User: "Fix the typo in README.md"
          ↓
Mode Selector → 'simple'
          ↓
Single Agent Loop:
  1. Read README.md
  2. Identify typo
  3. Edit file
  4. Respond to user
```

### Example 2: Dialectic Light (One Round)

```
User: "Fix the failing test in auth.test.ts"
          ↓
Mode Selector → 'dialectic_light'
          ↓
Round 1:
  ┌─────────────────────────────────────┐
  │ Proposer                            │
  │ - Analyze test failure              │
  │ - Propose fix                       │
  │ - Output: patch for auth.ts         │
  └─────────────────────────────────────┘
          ↓
  ┌─────────────────────────────────────┐
  │ Critic                              │
  │ - Review proposed patch             │
  │ - Check for edge cases              │
  │ - Output: concerns & suggestions    │
  └─────────────────────────────────────┘
          ↓
  ┌─────────────────────────────────────┐
  │ Synthesizer                         │
  │ - Reconcile proposal + critique     │
  │ - Output: final patch (JSON)        │
  └─────────────────────────────────────┘
          ↓
  Apply patches → Run tests → Report
```

### Example 3: Dialectic Full (Multi-Round)

```
User: "Refactor the authentication module to use JWT"
          ↓
Mode Selector → 'dialectic_full'
          ↓
Round 1:
  Proposer → Critic → Synthesizer → Tests
  [Tests fail on 3 cases]
          ↓
Round 2:
  Proposer (with failure context) → Critic → Synthesizer → Tests
  [Tests fail on 1 case]
          ↓
Round 3:
  Proposer (with failure context) → Critic → Synthesizer → Tests
  [Tests pass]
          ↓
Reflector:
  - Document what worked
  - Note anti-patterns encountered
  - Update project memory
          ↓
Report to user
```

## 6. Integration Points

### With Existing Codebase

The new components integrate with existing Qwen Code infrastructure:

| Component     | Integration Strategy                      |
| ------------- | ----------------------------------------- |
| Tool Layer    | Reuse existing tools unchanged            |
| Config System | Extend existing storage.ts                |
| CLI UI        | Reuse Ink components, add dialectic views |
| Telemetry     | Extend existing with dialectic events     |
| Subagents     | Evolve into agent role system             |

### Migration Path

1. **Phase 1**: Rename only (no architecture changes)
2. **Phase 2**: Add LLM adapter layer alongside existing
3. **Phase 3**: Add orchestrator layer
4. **Phase 4**: Add memory system
5. **Phase 5**: Add mode selector
6. **Phase 6**: Deprecate old single-agent loop

## 7. Open Questions

### To Decide

1. **OAuth removal** - Remove Qwen OAuth or make generic?
2. **Backward compatibility** - How long to support old config format?
3. **VS Code extension** - Update or deprecate?
4. **Telemetry** - Keep Clearcut protocol or replace?

### Technical Debt

1. Gemini naming throughout codebase
2. Mixed provider logic in orchestration
3. No structured memory beyond chat history
4. Hard-coded mode (always single-agent)

## 8. Success Criteria

The architecture is complete when:

1. [ ] Any OpenAI-compatible LLM works out of the box
2. [ ] Mode auto-selection works for 80%+ of tasks
3. [ ] Dialectic mode produces better results than single-agent on refactoring tasks
4. [ ] Memory persists across sessions and improves suggestions
5. [ ] Test suite passes with >90% coverage on new code
6. [ ] Migration from qwen-code works without data loss
