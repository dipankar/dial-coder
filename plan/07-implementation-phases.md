# Implementation Phases

This document outlines the phased implementation plan for transforming Qwen Code into Dial Code with the dialectic agent system, while preserving existing Qwen and Gemini OAuth systems.

## Overview

The implementation is divided into 6 phases:

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ROADMAP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: RENAMING                                              │
│  └── Qwen Code → Dial Code (names, files, config)              │
│  └── PRESERVE: Qwen OAuth, Gemini OAuth                        │
│                                                                 │
│  Phase 2: PROVIDER LAYER                                        │
│  └── Unified provider interface                                 │
│  └── Wrap OAuth providers + add configurable providers          │
│                                                                 │
│  Phase 3: MEMORY SYSTEM                                         │
│  └── Round/Session/Project memory, compaction                   │
│                                                                 │
│  Phase 4: DIALECTIC ORCHESTRATOR                                │
│  └── Agent roles, protocol, round execution                     │
│                                                                 │
│  Phase 5: MODE SELECTOR                                         │
│  └── Auto-detection, escalation, CLI integration                │
│                                                                 │
│  Phase 6: POLISH & RELEASE                                      │
│  └── Documentation, testing, migration tools                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Renaming (Foundation)

**Goal**: Rebrand from Qwen Code to Dial Code while preserving Qwen and Gemini OAuth systems.

### 1.1 File Renames

| Priority | Current                                   | New                                     | Notes           |
| -------- | ----------------------------------------- | --------------------------------------- | --------------- |
| HIGH     | `packages/cli/src/gemini.tsx`             | `packages/cli/src/dial.tsx`             | Main entry      |
| HIGH     | `packages/core/src/core/geminiChat.ts`    | `packages/core/src/core/dialChat.ts`    | Core class      |
| HIGH     | `packages/core/src/core/geminiRequest.ts` | `packages/core/src/core/dialRequest.ts` | Request wrapper |

### 1.1.1 Files to PRESERVE (OAuth)

| Directory                 | Status       | Notes                       |
| ------------------------- | ------------ | --------------------------- |
| `packages/core/src/qwen/` | **PRESERVE** | Move to `providers/qwen/`   |
| `QwenOAuthManager.ts`     | **PRESERVE** | Keep class name             |
| `QwenContentGenerator.ts` | **PRESERVE** | Keep class name             |
| Gemini auth code          | **PRESERVE** | Move to `providers/gemini/` |

### 1.2 Package Names

```json
// packages/cli/package.json
{
  "name": "@dial-code/dial",
  "bin": {
    "dial": "./dist/index.js"
  }
}

// packages/core/package.json
{
  "name": "@dial-code/dial-core"
}

// packages/test-utils/package.json
{
  "name": "@dial-code/dial-test-utils"
}
```

### 1.3 Configuration Directory

```typescript
// packages/core/src/config/storage.ts
- export const QWEN_DIR = '.qwen'
+ export const DIAL_DIR = '.dial'
```

### 1.4 Environment Variables

#### Variables to Rename

| Old                           | New                         |
| ----------------------------- | --------------------------- |
| `GEMINI_SANDBOX`              | `DIAL_SANDBOX`              |
| `GEMINI_CLI_NO_RELAUNCH`      | `DIAL_CLI_NO_RELAUNCH`      |
| `GEMINI_CLI_INTEGRATION_TEST` | `DIAL_CLI_INTEGRATION_TEST` |

#### Variables to KEEP (OAuth)

| Variable         | Status   | Notes                   |
| ---------------- | -------- | ----------------------- |
| `QWEN_OAUTH`     | **KEEP** | Enables Qwen OAuth flow |
| `QWEN_API_KEY`   | **KEEP** | DashScope API key       |
| `GEMINI_API_KEY` | **KEEP** | Gemini API key          |
| `GOOGLE_API_KEY` | **KEEP** | Google/Gemini API key   |

#### New Variables

| Variable            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `DIAL_PROVIDER`     | Default provider (qwen/gemini/openai/etc.) |
| `DIAL_MODE`         | Override mode selection                    |
| `OPENAI_API_KEY`    | OpenAI API key                             |
| `ANTHROPIC_API_KEY` | Anthropic API key                          |

### 1.5 Tasks

- [ ] Create rename script for automated replacement (exclude OAuth code)
- [ ] Reorganize provider directories:
  - [ ] Move `src/qwen/` → `src/providers/qwen/` (preserve code)
  - [ ] Move Gemini auth → `src/providers/gemini/` (preserve code)
  - [ ] Create `src/providers/configurable/` for new providers
- [ ] Update all import statements (preserve OAuth imports)
- [ ] Update documentation (README, CHANGELOG)
- [ ] Update GitHub workflows
- [ ] Update Dockerfile
- [ ] Create migration script for existing ~/.qwen/ users
- [ ] Test Qwen OAuth login still works
- [ ] Test Gemini OAuth login still works
- [ ] Test full build and run

### 1.6 Validation

```bash
# All tests pass
npm test

# CLI runs with new name
dial --version

# Config in correct location
ls ~/.dial/

# OAuth still works
QWEN_OAUTH=true dial auth login --provider qwen
dial auth login --provider gemini

# Check preserved code
ls packages/core/src/providers/qwen/  # Should have QwenOAuthManager.ts
ls packages/core/src/providers/gemini/  # Should have Gemini auth code
```

---

## Phase 2: Provider Layer

**Goal**: Create unified provider interface that wraps existing OAuth systems and enables configurable API-key providers.

### 2.1 Directory Structure

```
packages/core/src/providers/
├── index.ts
├── provider-interface.ts    # Unified LLMClient interface
├── provider-manager.ts      # Provider selection & management
│
├── qwen/                    # PRESERVED: Qwen OAuth
│   ├── QwenOAuthManager.ts  # Existing (preserved)
│   ├── QwenContentGenerator.ts  # Existing (preserved)
│   ├── dashscope-provider.ts    # Existing (preserved)
│   └── qwen-oauth-provider.ts   # NEW: Wrapper implementing LLMClient
│
├── gemini/                  # PRESERVED: Gemini OAuth
│   ├── GeminiContentGenerator.ts  # Existing (preserved)
│   └── gemini-oauth-provider.ts   # NEW: Wrapper implementing LLMClient
│
└── configurable/            # NEW: API-key providers
    ├── openai.ts
    ├── anthropic.ts
    ├── ollama.ts
    └── openai-compatible.ts
```

### 2.2 Tasks

- [ ] Define unified `LLMClient` interface
- [ ] Create `QwenOAuthProvider` wrapper around existing code
- [ ] Create `GeminiOAuthProvider` wrapper around existing code
- [ ] Implement `OpenAIProvider` (configurable)
- [ ] Implement `AnthropicProvider` (configurable)
- [ ] Implement `OllamaProvider` (configurable)
- [ ] Implement `OpenAICompatibleProvider` (configurable)
- [ ] Create `ProviderManager` for selection
- [ ] Implement `ToolCompatibilityLayer`
- [ ] Implement `JSONCompatibilityLayer`
- [ ] Create `CostTracker`
- [ ] Implement retry and fallback logic
- [ ] Write tests for all providers
- [ ] Test Qwen OAuth through new wrapper
- [ ] Test Gemini OAuth through new wrapper

### 2.3 Integration Points

Existing code uses `ContentGenerator` classes. We need to:

1. Create wrapper providers around existing OAuth generators (preserve functionality)
2. New configurable providers implement `LLMClient` directly
3. Update `DialChat` to use `ProviderManager` for provider selection

### 2.4 Configuration Format

```json
// ~/.dial/config.json
{
  "defaultProvider": "qwen",

  "providers": {
    "qwen": {
      "type": "qwen-oauth",
      "enabled": true
    },
    "gemini": {
      "type": "gemini-oauth",
      "enabled": true
    },
    "openai": {
      "type": "openai",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-4o",
      "enabled": true
    },
    "anthropic": {
      "type": "anthropic",
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "model": "claude-sonnet-4-20250514",
      "enabled": true
    }
  }
}
```

### 2.5 Validation

```bash
# Test with different providers
OPENAI_API_KEY=... dial "Hello"
ANTHROPIC_API_KEY=... dial --llm anthropic "Hello"
dial --llm ollama "Hello"  # Local model

# Verify tool calling works
dial "Create a file called test.txt"

# Verify JSON mode works
dial "List 3 fruits as JSON"
```

---

## Phase 3: Memory System

**Goal**: Implement hierarchical memory for rounds, sessions, and projects.

### 3.1 Directory Structure

```
packages/core/src/memory/
├── index.ts
├── types.ts                # Memory data types
├── memory-system.ts        # Main memory interface
├── round-memory.ts         # Per-round storage
├── session-memory.ts       # Per-session storage
├── project-memory.ts       # Per-project storage
├── compaction.ts           # Memory compaction logic
├── search.ts               # Memory search/retrieval
└── budget.ts               # Token budget management
```

### 3.2 Data Files

```
.dial/
├── project/
│   ├── ARCHITECTURE.md
│   ├── decisions.jsonl
│   └── modules/
│       └── {module}.json
└── sessions/
    └── {session_id}/
        ├── round_001.json
        ├── micro_summaries.jsonl
        └── session_summary.json
```

### 3.3 Tasks

- [ ] Define memory type interfaces
- [ ] Implement `RoundMemory` read/write
- [ ] Implement `SessionMemory` management
- [ ] Implement `ProjectMemory` (decisions.jsonl)
- [ ] Implement micro-summary generation
- [ ] Implement session summary generation
- [ ] Implement memory compaction
- [ ] Implement memory search
- [ ] Implement token budget manager
- [ ] Create initialization script for new projects
- [ ] Write tests for memory operations

### 3.4 Integration

1. Update task execution to save round data
2. Add session start/end hooks
3. Create CLI command for memory inspection
4. Add memory context to agent prompts

### 3.5 Validation

```bash
# Memory files created
ls .dial/project/
ls .dial/sessions/

# Decisions recorded
cat .dial/project/decisions.jsonl

# Memory search works
dial memory search "authentication"

# Memory inspection
dial memory show --session latest
```

---

## Phase 4: Dialectic Orchestrator

**Goal**: Implement the multi-agent dialectic loop (Proposer → Critic → Synthesizer → Reflector).

### 4.1 Directory Structure

```
packages/core/src/orchestrator/
├── index.ts
├── dialectic-controller.ts  # Main orchestration
├── round-manager.ts         # Round lifecycle
├── agent-runner.ts          # Agent execution
└── verification.ts          # Test/verification

packages/core/src/agents/
├── index.ts
├── agent-config.ts          # Agent configuration
├── proposer.ts              # Proposer agent
├── critic.ts                # Critic agent
├── synthesizer.ts           # Synthesizer agent
├── reflector.ts             # Reflector agent
└── prompts/
    ├── proposer-system.md
    ├── critic-system.md
    ├── synthesizer-system.md
    └── reflector-system.md
```

### 4.2 Tasks

- [ ] Define `AgentConfig` types
- [ ] Create agent system prompts
- [ ] Implement `AgentRunner` for single agent execution
- [ ] Implement `ProposerAgent`
- [ ] Implement `CriticAgent`
- [ ] Implement `SynthesizerAgent`
- [ ] Implement `ReflectorAgent`
- [ ] Implement `RoundManager`
- [ ] Implement `DialecticController`
- [ ] Implement verification (test runner integration)
- [ ] Create streaming output for CLI
- [ ] Integrate with memory system
- [ ] Write tests for orchestration

### 4.3 Agent Integration

Each agent needs:

- System prompt with role instructions
- Context assembly (memory, files, previous outputs)
- Output parsing and validation
- Error handling and retries

### 4.4 CLI Output

```
── Review Cycle 1 ────────────────────────────────
▶ Planning changes...
  Plan: 3 steps
  Patches: 2 files

▶ Reviewing proposal...
  Assessment: acceptable
  Issues: 2 (1 medium, 1 low)

▶ Resolving approach...
  Accepted: 1 suggestion
  Rejected: 1 suggestion
  Confidence: high

▶ Applying & testing...
  ✓ 15 passed

── Complete ──────────────────────────────────────
```

### 4.5 Validation

```bash
# Review mode works
dial --mode review "Fix the pagination bug"

# Safe mode shows multiple cycles
dial --mode safe "Refactor auth module"

# Learning updates memory
cat .dial/project/decisions.jsonl | tail -5
```

---

## Phase 5: Mode Selector

**Goal**: Implement automatic mode selection based on task analysis.

### 5.1 Directory Structure

```
packages/core/src/orchestrator/
├── mode-selector.ts         # Mode selection logic
├── task-analyzer.ts         # Task analysis
├── mode-escalation.ts       # Runtime mode changes
└── mode-config.ts           # Mode configuration
```

### 5.2 Tasks

- [ ] Implement `RuleBasedModeSelector`
- [ ] Implement `TaskAnalyzer`
- [ ] Implement `LLMEnhancedModeSelector` (optional)
- [ ] Implement mode escalation logic
- [ ] Add critical path detection
- [ ] Create mode configuration schema
- [ ] Add CLI mode override flags
- [ ] Add mode display in UI
- [ ] Write tests for mode selection

### 5.3 Configuration

```json
// .dial/config.json
{
  "modes": {
    "default": "auto",
    "critical_paths": ["src/auth/", "migrations/"],
    "always_simple": ["*.md"]
  }
}
```

### 5.4 CLI Integration

```bash
# Auto mode (default)
dial "Fix the bug"
# Output: [Auto-selected: review]

# Override mode
dial --mode quick "Fix typo"
dial --mode safe "Refactor auth"

# Check mode selection
dial analyze "What mode would be used for: Migrate to PostgreSQL"
```

### 5.5 Validation

```bash
# Ask mode detection
dial "Explain how auth works"  # Should be ask (read-only)

# Quick mode detection
dial "Fix typo in README"  # Should be quick (simple)

# Critical path escalation
dial "Update login logic"  # Should escalate to safe (full)
```

---

## Phase 6: Polish & Release

**Goal**: Documentation, testing, migration tools, and release preparation.

### 6.1 Documentation

- [ ] Rewrite README.md with Dial branding
- [ ] Write user guide (docs/)
- [ ] Write configuration reference
- [ ] Write migration guide (from qwen-code)
- [ ] Create example configurations
- [ ] Add inline code comments
- [ ] Generate API documentation

### 6.2 Testing

- [ ] Unit tests for all new code (>80% coverage)
- [ ] Integration tests for dialectic loop
- [ ] Integration tests for memory system
- [ ] Integration tests for mode selection
- [ ] End-to-end tests for CLI
- [ ] Performance benchmarks
- [ ] Test with multiple LLM providers

### 6.3 Migration Tools

```bash
# Migration command
dial migrate --from-qwen

# What it does:
# 1. Detects ~/.qwen/ directory
# 2. Copies settings to ~/.dial/
# 3. Converts config format if needed
# 4. Warns about breaking changes
```

- [ ] Implement migration script
- [ ] Handle config format changes
- [ ] Preserve user commands and agents
- [ ] Add deprecation warnings

### 6.4 Build & Release

- [ ] Update build scripts
- [ ] Update GitHub Actions workflows
- [ ] Update Dockerfile
- [ ] Create release checklist
- [ ] Update CHANGELOG.md
- [ ] Create release announcement

### 6.5 CLI Enhancements

- [ ] Add `dial init` for new projects
- [ ] Add `dial memory` for memory inspection
- [ ] Add `dial config` for configuration management
- [ ] Add `dial analyze` for task analysis
- [ ] Update help text and examples

### 6.6 UX & Terminology

**Critical**: All user-facing output must use external terminology. See `08-terminology-mapping.md`.

#### Tasks

- [ ] Audit all CLI output strings for internal terminology
- [ ] Replace dialectic terms with review pipeline terms
- [ ] Update mode names in CLI (`--mode safe` not `--mode dialectic_full`)
- [ ] Update config file keys to user-facing names
- [ ] Update error messages
- [ ] Update progress indicators

#### User-Facing Mode Names

| Internal          | External (CLI) |
| ----------------- | -------------- |
| `read_only`       | `ask`          |
| `simple`          | `quick`        |
| `dialectic_light` | `review`       |
| `dialectic_full`  | `safe`         |

#### CLI Output Examples (Correct)

```
[Mode: safe] Starting multi-stage review...

── Review Cycle 1 ─────────────────────────────────────────────

▶ Planning changes...
  Approach: Extract token validation
  Files: 3

▶ Reviewing proposal...
  Status: Acceptable
  Notes: 2 suggestions

▶ Resolving approach...
  Accepted: 1 suggestion

▶ Applying & testing...
  ✓ 24 tests passed

── Complete ───────────────────────────────────────────────────
```

#### CLI Output Examples (WRONG - Don't Do This)

```
[Mode: dialectic_full] Starting dialectic loop...

── Dialectic Round 1 ──────────────────────────────────────────

▶ Proposer (thesis)...
▶ Critic (antithesis)...
▶ Synthesizer (synthesis)...
```

#### Validation

- [ ] No user-visible string contains "dialectic"
- [ ] No user-visible string contains "thesis/antithesis/synthesis"
- [ ] No user-visible string contains "proposer/critic/synthesizer"
- [ ] Config file uses `review.maxCycles` not `dialectic.maxRounds`
- [ ] Help text describes "review cycles" not "dialectic rounds"

---

## Implementation Order

### Recommended Order (Minimize Risk)

```
Week 1-2: Phase 1 (Renaming)
├── Complete rename with working build
├── All tests passing
└── Migration script works

Week 3-4: Phase 2 (LLM Adapters)
├── OpenAI adapter working
├── At least one other provider
└── Existing functionality preserved

Week 5-6: Phase 3 (Memory)
├── Round/session memory working
├── Project memory working
└── Compaction working

Week 7-9: Phase 4 (Dialectic Orchestrator)
├── Single-round dialectic working
├── Multi-round working
├── Verification integrated

Week 10-11: Phase 5 (Mode Selector)
├── Rule-based selection working
├── Escalation working
├── CLI integration complete

Week 12: Phase 6 (Polish)
├── Documentation complete
├── All tests passing
├── Release ready
```

### Dependencies

```
Phase 1 (Rename) ─────────────────────────────────┐
                                                  │
Phase 2 (LLM Adapters) ───────────────────────────┼──┐
                                                  │  │
Phase 3 (Memory) ─────────────────────────────────┤  │
                                                  │  │
                  ┌───────────────────────────────┘  │
                  │                                  │
                  ▼                                  │
Phase 4 (Orchestrator) ◀─────────────────────────────┘
                  │
                  ▼
Phase 5 (Mode Selector)
                  │
                  ▼
Phase 6 (Polish)
```

---

## Risk Mitigation

### High-Risk Areas

| Risk                            | Mitigation                                    |
| ------------------------------- | --------------------------------------------- |
| Breaking existing functionality | Comprehensive test suite, gradual migration   |
| Multi-provider compatibility    | Abstraction layer, provider-specific adapters |
| Performance regression          | Benchmarks, caching, lazy loading             |
| Complex state management        | Immutable state, clear ownership              |
| Token budget overruns           | Budget manager, mode downgrade                |

### Rollback Strategy

Each phase should be independently deployable:

1. **Phase 1**: Can roll back to qwen-code naming
2. **Phase 2**: Can fall back to original ContentGenerator
3. **Phase 3**: Memory is additive, can disable
4. **Phase 4**: Can run in "simple" mode only
5. **Phase 5**: Can force specific mode

### Testing Strategy

```
Unit Tests
├── Each new class/function
├── Edge cases
└── Error handling

Integration Tests
├── LLM adapter + real APIs (mocked)
├── Memory + filesystem
├── Orchestrator + agents

E2E Tests
├── Full CLI workflow
├── Real LLM calls (integration env)
└── Performance benchmarks
```

---

## Success Criteria

### Phase 1 Complete When:

- [ ] CLI runs as `dial`
- [ ] Config in `~/.dial/`
- [ ] No "qwen" or "gemini" in user-facing strings
- [ ] All tests pass
- [ ] Migration from qwen-code works

### Phase 2 Complete When:

- [ ] OpenAI, Anthropic, and Ollama adapters work
- [ ] Tool calling works across providers
- [ ] JSON mode works across providers
- [ ] Cost tracking implemented
- [ ] Existing functionality unchanged

### Phase 3 Complete When:

- [ ] Round memory persists
- [ ] Session summaries generated
- [ ] Project decisions recordable
- [ ] Memory searchable
- [ ] Compaction works

### Phase 4 Complete When:

- [ ] All 4 agents implemented
- [ ] Single-round dialectic works
- [ ] Multi-round dialectic works
- [ ] Verification integrated
- [ ] Memory updated by reflector

### Phase 5 Complete When:

- [ ] Auto mode selection works
- [ ] Manual override works
- [ ] Escalation triggers correctly
- [ ] Critical path detection works
- [ ] CLI shows mode selection

### Phase 6 Complete When:

- [ ] Documentation complete
- [ ] > 80% test coverage
- [ ] Migration tested
- [ ] Performance acceptable
- [ ] Release published

---

## Appendix: File Change Summary

### New Files to Create

```
packages/core/src/
├── llm/
│   ├── index.ts
│   ├── llm-client.ts
│   ├── client-factory.ts
│   ├── client-manager.ts
│   ├── adapters/*.ts
│   ├── tool-compatibility.ts
│   ├── json-compatibility.ts
│   ├── cost-tracker.ts
│   └── retry-handler.ts
├── memory/
│   ├── index.ts
│   ├── types.ts
│   ├── memory-system.ts
│   ├── round-memory.ts
│   ├── session-memory.ts
│   ├── project-memory.ts
│   ├── compaction.ts
│   ├── search.ts
│   └── budget.ts
├── orchestrator/
│   ├── index.ts
│   ├── dialectic-controller.ts
│   ├── round-manager.ts
│   ├── mode-selector.ts
│   ├── task-analyzer.ts
│   ├── agent-runner.ts
│   └── verification.ts
└── agents/
    ├── index.ts
    ├── agent-config.ts
    ├── proposer.ts
    ├── critic.ts
    ├── synthesizer.ts
    ├── reflector.ts
    └── prompts/*.md
```

### Files to Rename

```
packages/cli/src/gemini.tsx → dial.tsx
packages/core/src/core/geminiChat.ts → dialChat.ts
packages/core/src/core/geminiRequest.ts → dialRequest.ts
packages/core/src/qwen/ → dial/
```

### Files to Modify

```
packages/*/package.json (names)
packages/core/src/config/storage.ts (DIAL_DIR)
packages/core/src/index.ts (exports)
All import statements referencing renamed files
README.md, CHANGELOG.md
.github/workflows/*.yml
Dockerfile
```
