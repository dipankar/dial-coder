# Dial Code

<div class="hero" markdown>

**Think. Review. Code. Safely.**

AI-powered CLI for developers with multi-stage review pipeline

[Get Started](getting-started/index.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/anthropics/dial-code){ .md-button }

</div>

---

## Why Dial Code?

Dial Code is an intelligent command-line AI assistant that goes beyond simple code generation. It features a **multi-stage review pipeline** that plans changes, reviews them for issues, and safely applies them with testing.

<div class="grid" markdown>

<div class="card" markdown>
### Four Execution Modes
Intelligent mode selection adapts to your task's complexity and risk level - from read-only queries to fully reviewed changes.
</div>

<div class="card" markdown>
### Dialectic Pipeline
Changes go through Planner, Reviewer, Resolver, and Learner stages for safer, higher-quality code modifications.
</div>

<div class="card" markdown>
### Multi-Provider Support
Works with Qwen, OpenAI, Anthropic, Gemini, and Ollama. Start free with Qwen OAuth (2,000 requests/day).
</div>

<div class="card" markdown>
### 25+ Built-in Tools
File operations, shell commands, web search, memory, MCP integration, and more - all with safety controls.
</div>

</div>

---

## Quick Install

```bash
# Clone and install
git clone https://github.com/anthropics/dial-code.git
cd dial-code && npm install && npm install -g .

# Start using
dial
```

---

## Execution Modes at a Glance

| Mode       | Symbol | Description        | Use Case                             |
| ---------- | ------ | ------------------ | ------------------------------------ |
| **Ask**    | `?`    | Read-only queries  | Exploring code, getting explanations |
| **Quick**  | `⚡`   | Direct execution   | Simple fixes, typos                  |
| **Review** | `◎`    | Light review cycle | Moderate changes, new features       |
| **Safe**   | `🛡`   | Full pipeline      | Critical paths, auth, database       |

Dial Code automatically selects the appropriate mode based on your request.

---

## Documentation

<div class="grid" markdown>

<div class="card" markdown>
### [Getting Started](getting-started/index.md)
Install Dial Code, authenticate, and run your first session.
</div>

<div class="card" markdown>
### [Core Concepts](core-concepts/index.md)
Understand execution modes, the dialectic pipeline, and the tool system.
</div>

<div class="card" markdown>
### [User Guide](user-guide/index.md)
Commands, shortcuts, configuration, themes, and daily usage.
</div>

<div class="card" markdown>
### [Providers](providers/index.md)
Configure Qwen, OpenAI, Ollama, and other LLM providers.
</div>

<div class="card" markdown>
### [Tools](tools/index.md)
Built-in tools, MCP integration, and extending functionality.
</div>

<div class="card" markdown>
### [Developer Guide](developer/index.md)
Architecture, contributing, and building from source.
</div>

</div>

---

## Example Session

```bash
$ dial
> Explain how authentication works in this codebase    # Ask mode
> Fix the typo in README.md                            # Quick mode
> Add input validation to the login form               # Review mode
> Update the database connection handling              # Safe mode
```

---

## License

Dial Code is open source under the [Apache 2.0 License](https://github.com/anthropics/dial-code/blob/main/LICENSE).
