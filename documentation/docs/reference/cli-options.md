# CLI Options

Complete reference for command-line flags.

---

## Usage

```bash
dial [options] [prompt]
```

---

## General Options

| Flag        | Short | Description         | Default |
| ----------- | ----- | ------------------- | ------- |
| `--version` | `-V`  | Show version number | -       |
| `--help`    | `-h`  | Show help           | -       |
| `--debug`   | `-d`  | Enable debug mode   | `false` |
| `--verbose` | `-v`  | Verbose output      | `false` |

---

## Execution Options

| Flag              | Short | Description                               | Default |
| ----------------- | ----- | ----------------------------------------- | ------- |
| `--mode <mode>`   | `-m`  | Execution mode (ask, quick, review, safe) | `auto`  |
| `--yolo`          | `-y`  | Skip all confirmations                    | `false` |
| `--sandbox`       | `-s`  | Enable sandboxed execution                | `false` |
| `--prompt <text>` | `-p`  | Run single prompt and exit                | -       |

### Mode Values

| Value    | Description                   |
| -------- | ----------------------------- |
| `auto`   | Automatic selection (default) |
| `ask`    | Read-only queries             |
| `quick`  | Direct execution              |
| `review` | Light review cycle            |
| `safe`   | Full review pipeline          |

---

## Model Options

| Flag                | Description         | Default       |
| ------------------- | ------------------- | ------------- |
| `--model <name>`    | Model to use        | From settings |
| `--token-limit <n>` | Session token limit | `32000`       |

---

## Authentication Options

| Flag               | Description                               | Default      |
| ------------------ | ----------------------------------------- | ------------ |
| `--auth <type>`    | Auth type (qwen-oauth, openai-compatible) | `qwen-oauth` |
| `--api-key <key>`  | API key                                   | From env     |
| `--base-url <url>` | API base URL                              | From env     |

---

## Output Options

| Flag         | Description            | Default |
| ------------ | ---------------------- | ------- |
| `--json`     | Output in JSON format  | `false` |
| `--no-color` | Disable colored output | `false` |
| `--quiet`    | Minimal output         | `false` |

---

## Session Options

| Flag            | Description           | Default |
| --------------- | --------------------- | ------- |
| `--resume <id>` | Resume saved session  | -       |
| `--no-history`  | Don't save to history | `false` |
| `--checkpoint`  | Enable checkpointing  | `true`  |

---

## Vision Options

| Flag                       | Description                  | Default       |
| -------------------------- | ---------------------------- | ------------- |
| `--vlm-switch-mode <mode>` | Vision model switch behavior | From settings |

### VLM Switch Values

| Value     | Description            |
| --------- | ---------------------- |
| `once`    | Switch for one query   |
| `session` | Switch for session     |
| `persist` | Stay with vision model |

---

## IDE Options

| Flag    | Description     | Default |
| ------- | --------------- | ------- |
| `--ide` | Enable IDE mode | `false` |

---

## Examples

### Basic Usage

```bash
dial                          # Interactive mode
dial "explain this code"      # Single prompt
dial -p "fix the bug"         # Prompt flag
```

### Mode Selection

```bash
dial --mode safe              # Force safe mode
dial -m quick                 # Force quick mode
dial --yolo                   # Skip confirmations
```

### Model Configuration

```bash
dial --model gpt-4            # Use specific model
dial --token-limit 16000      # Limit tokens
```

### Output Control

```bash
dial --json                   # JSON output
dial --no-color               # No colors
dial --quiet                  # Minimal output
```

### Headless Mode

```bash
dial -p "generate tests" --json > output.json
dial --prompt "fix bug" --quiet
```

---

## Combining Options

```bash
# Safe mode with GPT-4
dial --mode safe --model gpt-4

# Headless JSON output
dial -p "analyze code" --json --quiet

# Debug with verbose output
dial --debug --verbose
```

---

## Environment Precedence

CLI flags override environment variables, which override settings files:

1. CLI flags (highest)
2. Environment variables
3. Project settings (`.dial/settings.json`)
4. Global settings (`~/.dial/settings.json`)

---

## Next Steps

- [Environment Variables](environment-vars.md) - Env var reference
- [Configuration](../user-guide/configuration.md) - Settings file reference
