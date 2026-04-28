# Dial Coder

<div align="center">

[![npm version](https://img.shields.io/npm/v/@dial-coder/cli.svg)](https://www.npmjs.com/package/@dial-coder/cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![CI](https://github.com/dipankar/dial-coder/actions/workflows/ci.yml/badge.svg)](https://github.com/dipankar/dial-coder/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

**Think. Review. Code. Safely.**

A terminal-based AI coding agent with a built-in dialectic review pipeline.
Every change goes through planning, critique, and synthesis before it reaches your codebase.

[Documentation](./documentation/) · [Getting Started](#getting-started) · [Contributing](./CONTRIBUTING.md)

</div>

---

## Overview

Dial Coder is an AI-powered CLI for developers. Instead of blindly applying AI-generated changes, Dial Coder runs them through a structured review pipeline that catches bugs, security issues, and missed edge cases before they land in your code.

The terminal interface gives you full control: ask questions, request edits, review diffs, and approve or reject every change.

## Features

- **Dialectic Review Pipeline** — Planner → Critic → Synthesizer → Reflector. Every non-trivial change gets reviewed by multiple agent perspectives.
- **Four Execution Modes** — `ask`, `quick`, `review`, `safe`. Automatically selected based on task risk, or override manually.
- **Multi-Provider Support** — Ollama (default), OpenAI, Anthropic, Gemini, Google GenAI, Ollama Cloud, and any OpenAI-compatible endpoint.
- **25+ Built-in Tools** — File operations, shell execution, web search, semantic code search, memory, and MCP integration.
- **Vision Support** — Auto-detects images and switches to vision-capable models.
- **Safety Classifier** — Blocks dangerous operations (`rm -rf`, destructive SQL, credential exposure) before execution.
- **Message Compaction** — Four-tier progressive compaction (snip → micro → collapse → auto) keeps long sessions within token budgets.
- **Sandboxed Execution** — Optional Docker/Podman sandbox for untrusted commands.

## Installation

### npm (recommended)

```bash
npm install -g @dial-coder/cli
```

### npx (no install)

```bash
npx @dial-coder/cli
```

### Docker

```bash
docker run --rm -it ghcr.io/dipankar/dial-coder:latest
```

### From source

```bash
git clone https://github.com/dipankar/dial-coder.git
cd dial-coder
npm install
npm run build
npm link packages/cli
```

## Getting Started

### 1. Configure a provider

**Ollama (default, local, free):**

```bash
# Start Ollama locally first
ollama pull llama3.3

# Then run
dial
```

**OpenAI:**

```bash
export OPENAI_API_KEY="sk-..."
dial --auth=openai
```

**Anthropic:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
dial --auth=anthropic
```

### 2. Start a session

```bash
# Interactive mode
dial

# One-shot mode
dial -p "Refactor the error handling in src/utils/errors.ts"

# Review mode (full dialectic pipeline)
dial --mode=safe -p "Add input validation to the signup form"
```

## How It Works

Dial Coder uses a **dialectic pipeline** for code changes. Instead of a single agent generating and applying edits, the pipeline splits work across specialized agents:

```
User Request
    │
    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Proposer   │───→│   Critic    │───→│ Synthesizer │
│  (Thesis)   │    │ (Antithesis)│    │ (Synthesis) │
└─────────────┘    └─────────────┘    └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  Reflector  │
                                       │  (Learn)    │
                                       └─────────────┘
```

1. **Proposer** — Generates a plan and proposed patches.
2. **Critic** — Reviews the plan for bugs, security issues, missed edge cases, and style violations.
3. **Synthesizer** — Reconciles the thesis and antithesis into a final, reviewed patch set.
4. **Reflector** — Updates project memory (decisions, invariants, patterns) so future rounds are smarter.

### Execution Modes

| Mode | Pipeline | Use For |
|------|----------|---------|
| **Ask** (`?`) | None | Read-only questions, explanations, code review |
| **Quick** (`⚡`) | Proposer only | Fast, low-risk edits (typos, renaming) |
| **Review** (`◎`) | Proposer + Critic + Synthesizer | Medium-risk changes (refactoring, feature adds) |
| **Safe** (`🛡`) | Full pipeline + verification | High-risk changes (auth, payments, schema changes) |

Modes are automatically selected based on the task description, or you can force a mode with `--mode=<mode>`.

## Providers

| Provider | Setup | Default Model | Free? |
|----------|-------|---------------|-------|
| **Ollama** | `ollama run llama3.3` | `llama3.3` | Yes (local) |
| **Ollama Cloud** | `OLLAMA_CLOUD_API_KEY` | varies | Yes (with key) |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-4.1` | Pay-as-you-go |
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Pay-as-you-go |
| **Gemini** | `GOOGLE_API_KEY` | `gemini-2.5-pro` | Free tier |
| **Google GenAI** | OAuth or `GOOGLE_API_KEY` | `gemini-2.5-pro` | Free tier |

Ollama is the default. No API keys required.

## Commands

Inside the interactive terminal:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/clear` | Clear conversation history |
| `/compress` | Compact conversation to save tokens |
| `/stats` | Show token usage and cost |
| `/memory` | View project memory (decisions, invariants) |
| `/diff` | Show pending diffs |
| `/approve` | Approve and apply pending changes |
| `/reject` | Reject pending changes |
| `/exit` | Exit session |

## Tools

Dial Coder exposes a rich tool set to the AI agent:

**File & Search**
- `view`, `edit`, `write`, `patch` — File operations
- `glob`, `grep`, `ripgrep` — Code search
- `ls`, `pwd` — Directory navigation

**Execution**
- `bash` — Shell commands (sandboxed by default)
- `fetch` — Web requests

**Integration**
- `mcp` — Model Context Protocol servers
- `memory_search` — Semantic search over project memory

## Configuration

Configuration lives in `~/.dial/settings.json`:

```json
{
  "model": {
    "name": "llama3.3",
    "provider": "ollama"
  },
  "security": {
    "approvalMode": "suggest",
    "sandbox": "docker"
  }
}
```

Set `DIAL_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` as environment variables for cloud providers.

## Development

```bash
npm install
npm run build
npm run test:ci        # Run all tests
npm run preflight      # Full CI check (lint, typecheck, build, test)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Architecture

Dial Coder is a monorepo with three main packages:

- **`@dial-coder/core`** — LLM adapters, tools, memory system, dialectic orchestrator
- **`@dial-coder/cli`** — Terminal UI, command handlers, configuration
- **`dial-coder-vscode`** — VS Code extension for IDE companion mode

## License

[Apache 2.0](./LICENSE)

---

<div align="center">

Built with ❤️ by <a href="https://github.com/dipankar">Dipankar</a> and contributors.

</div>
