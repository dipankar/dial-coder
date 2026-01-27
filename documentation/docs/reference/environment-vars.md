# Environment Variables

Configure Dial Code via environment variables.

---

## Authentication

| Variable          | Description                             | Example                     |
| ----------------- | --------------------------------------- | --------------------------- |
| `OPENAI_API_KEY`  | API key for OpenAI-compatible providers | `sk-...`                    |
| `OPENAI_BASE_URL` | API endpoint URL                        | `https://api.openai.com/v1` |
| `OPENAI_MODEL`    | Model to use                            | `gpt-4`                     |

### Example Setup

```bash
export OPENAI_API_KEY="sk-your-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4"
```

---

## Sandbox

| Variable         | Description            | Values                      |
| ---------------- | ---------------------- | --------------------------- |
| `DIAL_SANDBOX`   | Sandbox mode           | `false`, `docker`, `podman` |
| `GEMINI_SANDBOX` | Alias for DIAL_SANDBOX | Same as above               |

### Docker Sandbox

```bash
export DIAL_SANDBOX=docker
```

### Podman Sandbox

```bash
export DIAL_SANDBOX=podman
```

---

## Debug

| Variable          | Description         | Values      |
| ----------------- | ------------------- | ----------- |
| `DEBUG`           | Enable debug output | `1`, `true` |
| `VERBOSE`         | Verbose logging     | `1`, `true` |
| `DEBUG_TELEMETRY` | Debug telemetry     | `1`, `true` |

### Enable Debug Mode

```bash
export DEBUG=1
dial
```

---

## Display

| Variable      | Description    | Values                 |
| ------------- | -------------- | ---------------------- |
| `NO_COLOR`    | Disable colors | `1`, `true`            |
| `FORCE_COLOR` | Force colors   | `1`, `true`            |
| `TERM`        | Terminal type  | `xterm-256color`, etc. |

### Disable Colors

```bash
export NO_COLOR=1
```

---

## Development

| Variable   | Description      | Values                      |
| ---------- | ---------------- | --------------------------- |
| `DEV`      | Development mode | `true`                      |
| `NODE_ENV` | Node environment | `development`, `production` |

### Development Mode

```bash
export DEV=true
npm start
```

---

## Provider-Specific

### Qwen

| Variable     | Description                     |
| ------------ | ------------------------------- |
| (Uses OAuth) | No environment variables needed |

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4"
```

### Anthropic

```bash
export OPENAI_API_KEY="sk-ant-..."
export OPENAI_BASE_URL="https://api.anthropic.com/v1"
export OPENAI_MODEL="claude-3-opus-20240229"
```

### Ollama

```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"
```

### OpenRouter

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_MODEL="openai/gpt-4"
```

---

## Web Search

| Variable         | Description                    |
| ---------------- | ------------------------------ |
| `TAVILY_API_KEY` | Tavily search API key          |
| `GOOGLE_API_KEY` | Google search API key          |
| `GOOGLE_CSE_ID`  | Google Custom Search Engine ID |

---

## .env File

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4
DIAL_SANDBOX=false
```

Dial Code automatically loads `.env` files from:

1. Current directory
2. `.dial/.env`
3. `~/.dial/.env`

---

## Precedence

Environment variables take precedence over settings files:

1. Environment variables (highest)
2. Project settings (`.dial/settings.json`)
3. Global settings (`~/.dial/settings.json`)

CLI flags override everything.

---

## Security Notes

### Don't Commit API Keys

Add to `.gitignore`:

```
.env
.dial/
```

### Use Secret Management

For CI/CD, use your platform's secret management:

- GitHub Actions: Repository secrets
- GitLab: CI/CD variables
- Docker: Build secrets

---

## Next Steps

- [CLI Options](cli-options.md) - Command-line flags
- [Configuration](../user-guide/configuration.md) - Settings file
