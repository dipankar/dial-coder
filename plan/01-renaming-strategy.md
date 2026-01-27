# Renaming Strategy: Qwen Code → Dial Code

This document outlines the complete renaming strategy from "qwen-code" to "dial-code", while preserving the existing Qwen and Gemini OAuth/login systems.

## 1. Naming Conventions

### Primary Names

| Context        | Old Name                       | New Name                 |
| -------------- | ------------------------------ | ------------------------ |
| Project Name   | Qwen Code                      | Dial Code                |
| CLI Command    | `qwen`                         | `dial`                   |
| NPM Scope      | `@qwen-code/*`                 | `@dial-code/*`           |
| User Directory | `~/.qwen/`                     | `~/.dial/`               |
| GitHub Org     | QwenLM                         | (TBD - your org)         |
| Docker Image   | `ghcr.io/neul-labs/dial-coder` | `ghcr.io/dial-code/dial` |

### Package Names

| Package           | Old NPM Name                      | New NPM Name                 |
| ----------------- | --------------------------------- | ---------------------------- |
| CLI               | `@qwen-code/qwen-code`            | `@dial-coder/cli`            |
| Core              | `@qwen-code/qwen-code-core`       | `@dial-coder/core`           |
| Test Utils        | `@qwen-code/qwen-code-test-utils` | `@dial-coder/test-utils`     |
| VS Code Extension | `qwen-code-vscode-ide-companion`  | `dial-code-vscode-companion` |

## 2. File Renames

### Critical File Renames (High Priority)

These files are named after Gemini and should be renamed:

```
packages/cli/src/gemini.tsx → packages/cli/src/dial.tsx
packages/core/src/core/geminiChat.ts → packages/core/src/core/dialChat.ts
packages/core/src/core/geminiRequest.ts → packages/core/src/core/dialRequest.ts
```

### Directory Structure (Preserved)

The `packages/core/src/qwen/` directory contains Qwen OAuth logic and should be **preserved but reorganized**:

```
packages/core/src/
├── providers/              # NEW: Reorganized provider directory
│   ├── qwen/              # Qwen OAuth (preserved from src/qwen/)
│   │   ├── QwenOAuthManager.ts
│   │   ├── QwenContentGenerator.ts
│   │   └── dashscope-provider.ts
│   ├── gemini/            # Gemini OAuth (preserved)
│   │   └── GeminiContentGenerator.ts
│   └── configurable/      # NEW: Generic configurable providers
│       └── OpenAICompatibleProvider.ts
```

### Configuration Files to Update

```
packages/cli/package.json
packages/core/package.json
packages/test-utils/package.json
packages/vscode-ide-companion/package.json
/package.json (root)
```

## 3. Environment Variables

### Variables to Rename

| Old Variable                  | New Variable                | Notes |
| ----------------------------- | --------------------------- | ----- |
| `GEMINI_SANDBOX`              | `DIAL_SANDBOX`              |       |
| `GEMINI_CLI_NO_RELAUNCH`      | `DIAL_CLI_NO_RELAUNCH`      |       |
| `GEMINI_CLI_INTEGRATION_TEST` | `DIAL_CLI_INTEGRATION_TEST` |       |

### Variables to KEEP (OAuth Systems)

| Variable         | Purpose                 | Status   |
| ---------------- | ----------------------- | -------- |
| `QWEN_OAUTH`     | Enable Qwen OAuth login | **KEEP** |
| `QWEN_API_KEY`   | Qwen/DashScope API key  | **KEEP** |
| `GEMINI_API_KEY` | Gemini API key          | **KEEP** |
| `GOOGLE_API_KEY` | Google/Gemini API key   | **KEEP** |

### New Variables to Add

| Variable            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `DIAL_MODE`         | Override auto-mode selection (simple/light/full)       |
| `DIAL_PROVIDER`     | Default provider (qwen/gemini/openai/anthropic/ollama) |
| `DIAL_DEBUG`        | Debug logging                                          |
| `OPENAI_API_KEY`    | OpenAI API key (configurable provider)                 |
| `ANTHROPIC_API_KEY` | Anthropic API key (configurable provider)              |

## 4. Configuration Paths

### User Home Directory

Old structure (`~/.qwen/`):

```
.qwen/
├── settings.json
├── oauth_creds.json
├── mcp-oauth-tokens.json
├── installation_id
├── commands/
├── agents/
├── memory.md
├── tmp/
└── bin/
```

New structure (`~/.dial/`):

```
.dial/
├── settings.json
├── credentials/           # Reorganized auth
│   ├── qwen_oauth.json   # Qwen OAuth creds (preserved)
│   ├── gemini_oauth.json # Gemini OAuth creds (preserved)
│   └── api_keys.json     # Configurable provider API keys
├── mcp-oauth-tokens.json
├── installation_id
├── commands/
├── agents/
├── config.json            # NEW: Provider configuration
├── project/               # NEW: Project memory
│   ├── ARCHITECTURE.md
│   ├── decisions.jsonl
│   └── modules/
├── sessions/              # NEW: Session memory
├── global/                # NEW: Global preferences
│   ├── preferences.json
│   └── heuristics.json
├── tmp/
└── bin/
```

### Project-level Directory

New project-level config (`.dial/`):

```
.dial/
├── config.json            # Project-specific LLM config
├── DIAL.md               # Project context (like QWEN.md)
├── sessions/             # Session logs for this project
└── memory/               # Project-specific memory
```

## 5. Code References to Update

### Core Storage Constant

**File:** `packages/core/src/config/storage.ts`

```typescript
// Old
export const QWEN_DIR = '.qwen';

// New
export const DIAL_DIR = '.dial';
```

### Class Names to Rename

| Old Class       | New Class     | Notes              |
| --------------- | ------------- | ------------------ |
| `GeminiChat`    | `DialChat`    | Core orchestration |
| `GeminiRequest` | `DialRequest` | Request wrapper    |

### Classes to KEEP (OAuth)

| Class                               | Location                | Status   |
| ----------------------------------- | ----------------------- | -------- |
| `QwenOAuthManager`                  | `src/providers/qwen/`   | **KEEP** |
| `QwenContentGenerator`              | `src/providers/qwen/`   | **KEEP** |
| `GeminiContentGenerator`            | `src/providers/gemini/` | **KEEP** |
| `DashScopeOpenAICompatibleProvider` | `src/providers/qwen/`   | **KEEP** |

### Import Updates

All files importing the renamed classes/files need updates. Estimated ~200+ import statements.
OAuth-related imports should be updated to new paths but functionality preserved.

## 6. Authentication System

### Overview

Dial Code supports three authentication methods:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION METHODS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. QWEN OAUTH (Preserved)                                      │
│     └── Free tier via DashScope (2000 req/day)                  │
│     └── Uses existing QwenOAuthManager                          │
│     └── Env: QWEN_OAUTH=true                                    │
│                                                                  │
│  2. GEMINI OAUTH (Preserved)                                    │
│     └── Google account login                                    │
│     └── Uses existing Gemini auth flow                          │
│     └── Env: GEMINI_API_KEY or Google OAuth                     │
│                                                                  │
│  3. CONFIGURABLE PROVIDERS (New)                                │
│     └── OpenAI, Anthropic, Ollama, any OpenAI-compatible        │
│     └── API key based                                           │
│     └── Configured via ~/.dial/config.json                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Provider Selection Priority

```typescript
// Default provider selection order:
1. Explicit --provider flag
2. DIAL_PROVIDER env var
3. Project config (.dial/config.json)
4. User config (~/.dial/config.json)
5. Auto-detect based on available credentials:
   - If QWEN_OAUTH=true and qwen_oauth.json exists → Qwen
   - If GEMINI_API_KEY exists → Gemini
   - If OPENAI_API_KEY exists → OpenAI
   - If ANTHROPIC_API_KEY exists → Anthropic
   - Fallback: prompt user to configure
```

### Auth Commands

```bash
# Qwen OAuth login (preserved)
dial auth login --provider qwen

# Gemini OAuth login (preserved)
dial auth login --provider gemini

# Configure API key provider
dial auth configure --provider openai
dial auth configure --provider anthropic

# Check auth status
dial auth status
```

## 7. Provider Configuration

### Config File Format (`~/.dial/config.json`)

```json
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
    },
    "ollama": {
      "type": "ollama",
      "baseURL": "http://localhost:11434",
      "model": "qwen2.5-coder:32b",
      "enabled": false
    },
    "custom": {
      "type": "openai-compatible",
      "baseURL": "https://api.together.xyz/v1",
      "apiKeyEnv": "TOGETHER_API_KEY",
      "model": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      "enabled": false
    }
  },

  "dialectic": {
    "agents": {
      "proposer": { "provider": "default" },
      "critic": { "provider": "default" },
      "synthesizer": { "provider": "default" },
      "reflector": { "provider": "default" }
    }
  }
}
```

## 8. Documentation Updates

### Files to Rewrite

- `README.md` - Complete rewrite with Dial Code branding
- `CHANGELOG.md` - Add entry for rename
- `docs/` - Update all documentation
- `CONTRIBUTING.md` - Update contributing guide

### Branding Elements

- Update project name to "Dial Code"
- Keep references to Qwen/Gemini as supported providers
- Add documentation for configurable providers
- Update screenshots and examples

## 9. Build System Updates

### Scripts to Update

- `scripts/build.js` - Update references
- `scripts/telemetry_utils.js` - Update GEMINI_DIR references
- `esbuild.config.js` - Update entry points
- `Dockerfile` - Update image names and labels

### GitHub Actions

Files in `.github/workflows/`:

- `qwen-code-cd.yml` → `dial-code-cd.yml`
- `qwen-code-ci.yml` → `dial-code-ci.yml`
- Update all internal references

## 10. Telemetry Updates

### Event Names

Update telemetry event naming:

```typescript
// Old
console_type: 'GEMINI_CLI';
event_name: 'qwen-code.*';

// New
console_type: 'DIAL_CLI';
event_name: 'dial-code.*';
```

### Telemetry Constants

**File:** `packages/core/src/telemetry/clearcut-logger/clearcut-logger.ts`

- Update all GEMINI_CLI references
- Update application identifiers

## 11. Migration Support

### Backward Compatibility

For users migrating from qwen-code:

1. **Auto-migration script**
   - Detect `~/.qwen/` and offer to migrate to `~/.dial/`
   - **Preserve OAuth credentials** (copy oauth_creds.json → credentials/)
   - Copy settings, commands, agents
   - Convert config format if needed

2. **Deprecation warnings**
   - If old env vars detected, warn and suggest new ones
   - If old directory detected, warn and offer migration

### Migration Command

```bash
dial migrate --from-qwen
```

This will:

1. Copy `~/.qwen/oauth_creds.json` → `~/.dial/credentials/qwen_oauth.json`
2. Copy `~/.qwen/settings.json` → `~/.dial/settings.json`
3. Copy `~/.qwen/commands/` → `~/.dial/commands/`
4. Copy `~/.qwen/agents/` → `~/.dial/agents/`
5. Generate initial `~/.dial/config.json` based on detected auth

## 12. CLI Changes

### Command Updates

```bash
# Old
qwen "Hello"
qwen --help

# New
dial "Hello"
dial --help

# Provider selection
dial --provider qwen "Hello"
dial --provider gemini "Hello"
dial --provider openai "Hello"
dial --provider anthropic "Hello"
dial --provider ollama "Hello"
```

### New Commands

```bash
# Auth management
dial auth login --provider qwen
dial auth login --provider gemini
dial auth configure --provider openai
dial auth status
dial auth logout --provider qwen

# Provider management
dial provider list
dial provider test openai
dial provider set-default anthropic
```

## 13. Execution Order

### Phase 1: Configuration (Day 1-2)

1. Update `storage.ts` with new DIAL_DIR constant
2. Update package.json files with new names (@dial-code/\*)
3. Rename critical files (gemini.tsx → dial.tsx, etc.)
4. Reorganize provider directories (preserve OAuth code)
5. Update non-OAuth environment variable names

### Phase 2: Code Updates (Day 3-5)

1. Rename classes (GeminiChat → DialChat, etc.)
2. Update all imports (preserve OAuth imports)
3. Update string literals and comments
4. Update telemetry constants
5. Add provider configuration system

### Phase 3: Documentation (Day 6-7)

1. Rewrite README.md
2. Update all docs/
3. Update CHANGELOG.md
4. Document all three auth methods

### Phase 4: Build System (Day 8)

1. Update build scripts
2. Update GitHub workflows
3. Update Dockerfile
4. Update VS Code extension

### Phase 5: Testing (Day 9-10)

1. Run full test suite
2. Test Qwen OAuth login
3. Test Gemini OAuth login
4. Test configurable providers
5. Test migration path
6. Manual testing of CLI
7. Integration tests

## 14. Estimated Impact

### Files Affected

- ~50+ TypeScript/JavaScript files need content changes
- ~10 files need renaming
- ~5 package.json files need updates
- ~10 workflow files need updates
- ~20 documentation files need updates

### Code Changes

- ~2,500 instances of "gemini" (case-insensitive) to replace (except in provider code)
- ~500 instances of "qwen" to rename (except in provider code)
- ~500 import statements to update

### Files to Preserve (OAuth)

- `packages/core/src/qwen/QwenOAuthManager.ts` → move to `providers/qwen/`
- `packages/core/src/qwen/QwenContentGenerator.ts` → move to `providers/qwen/`
- All DashScope provider code
- Gemini OAuth flow code

### Risk Areas

1. **OAuth flows** - Must test thoroughly after reorganization
2. **Telemetry backend** - May break if backend expects old names
3. **VS Code extension** - Marketplace publishing requires new ID
4. **Homebrew formula** - Needs new tap/formula
