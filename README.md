# Dial Code

<div align="center">

[![npm version](https://img.shields.io/npm/v/dial-coder.svg)](https://www.npmjs.com/package/dial-coder)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![CI](https://github.com/neul-labs/dial-coder/actions/workflows/ci.yml/badge.svg)](https://github.com/neul-labs/dial-coder/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

**Think. Review. Code. Safely.**

[Documentation](./documentation/) | [Getting Started](#getting-started) | [Contributing](./CONTRIBUTING.md)

</div>

---

AI-powered CLI for developers with multi-stage review pipeline. Changes go through planning, review, and resolution before reaching your codebase.

## Getting Started

```bash
# Install
git clone https://github.com/neul-labs/dial-coder.git
cd dial-coder && npm install && npm install -g .

# Run
dial
```

Authenticate with Qwen OAuth (free, 2,000 requests/day) or configure your own provider.

## Key Features

- **Four Execution Modes** - Ask (`?`), Quick (`⚡`), Review (`◎`), Safe (`🛡`) - automatically selected based on task risk
- **Dialectic Pipeline** - Planner → Reviewer → Resolver → Learner for safer code changes
- **Multi-Provider Support** - Qwen, OpenAI, Anthropic, Gemini, Ollama
- **25+ Built-in Tools** - File operations, shell, web search, memory, MCP integration
- **Vision Support** - Auto-switch to vision models when images detected

## How It Works

```bash
> Explain how authentication works        # Ask mode (read-only)
> Fix the typo in README.md              # Quick mode (direct)
> Add input validation to the form       # Review mode (with review)
> Update the database connection         # Safe mode (full pipeline)
```

## Providers

| Provider   | Setup                                       | Free Tier     |
| ---------- | ------------------------------------------- | ------------- |
| **Qwen**   | `dial` (OAuth)                              | 2,000/day     |
| **OpenAI** | `OPENAI_API_KEY`                            | Pay-as-you-go |
| **Ollama** | `OPENAI_BASE_URL=http://localhost:11434/v1` | Unlimited     |

## Commands

| Command     | Description   |
| ----------- | ------------- |
| `/help`     | Show commands |
| `/clear`    | Clear history |
| `/compress` | Save tokens   |
| `/stats`    | Token usage   |
| `/exit`     | Exit          |

## Documentation

Full documentation available in [`documentation/`](./documentation/):

- [Getting Started](./documentation/docs/getting-started/index.md)
- [Core Concepts](./documentation/docs/core-concepts/index.md)
- [User Guide](./documentation/docs/user-guide/index.md)
- [Provider Setup](./documentation/docs/providers/index.md)
- [Developer Guide](./documentation/docs/developer/index.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Development
npm install
npm run build
npm run preflight  # Run before submitting PR
```

## License

[Apache 2.0](./LICENSE)
