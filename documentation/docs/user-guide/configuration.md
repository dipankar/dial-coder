# Configuration

Customize Dial Code behavior with settings files.

---

## Settings Files

Settings can be defined at multiple levels:

| Location                | Scope                       |
| ----------------------- | --------------------------- |
| `~/.dial/settings.json` | Global (all projects)       |
| `.dial/settings.json`   | Project (current directory) |

Project settings override global settings.

---

## Quick Start

Create a settings file:

```bash
mkdir -p ~/.dial
echo '{}' > ~/.dial/settings.json
```

Or use the settings dialog:

```
/settings
```

---

## Common Settings

### Session Token Limit

Control conversation length:

```json
{
  "sessionTokenLimit": 32000
}
```

### Execution Mode

Set default execution behavior:

```json
{
  "executionMode": {
    "default": "auto",
    "autoSelect": true,
    "enableEscalation": true
  }
}
```

### Model Selection

Choose your default model:

```json
{
  "model": "qwen3-coder-plus"
}
```

### Theme

Set the UI theme:

```json
{
  "theme": "dracula"
}
```

---

## Full Settings Reference

### General

```json
{
  "vim": false,
  "language": "auto",
  "autoUpdate": true,
  "checkpointing": true
}
```

| Setting         | Type    | Default  | Description                |
| --------------- | ------- | -------- | -------------------------- |
| `vim`           | boolean | `false`  | Enable vim mode            |
| `language`      | string  | `"auto"` | UI language (auto, en, zh) |
| `autoUpdate`    | boolean | `true`   | Check for updates          |
| `checkpointing` | boolean | `true`   | Enable session recovery    |

### UI

```json
{
  "theme": "default",
  "hideTitleBar": false,
  "hideContextSummary": false,
  "hideFooter": false,
  "showLineNumbers": true
}
```

| Setting              | Type    | Default     | Description               |
| -------------------- | ------- | ----------- | ------------------------- |
| `theme`              | string  | `"default"` | Color theme               |
| `hideTitleBar`       | boolean | `false`     | Hide title bar            |
| `hideContextSummary` | boolean | `false`     | Hide context display      |
| `hideFooter`         | boolean | `false`     | Hide footer               |
| `showLineNumbers`    | boolean | `true`      | Show line numbers in code |

### Model

```json
{
  "model": "qwen3-coder-plus",
  "sessionTokenLimit": 32000,
  "maxSessionTurns": -1,
  "generationConfig": {
    "timeout": 120000,
    "maxRetries": 3
  }
}
```

| Setting             | Type   | Default | Description                |
| ------------------- | ------ | ------- | -------------------------- |
| `model`             | string | varies  | Model to use               |
| `sessionTokenLimit` | number | `32000` | Max tokens per session     |
| `maxSessionTurns`   | number | `-1`    | Max turns (-1 = unlimited) |

### Tools

```json
{
  "sandbox": false,
  "toolOutputTruncation": {
    "threshold": 10000,
    "maxLines": 500
  }
}
```

| Setting                | Type    | Default | Description                |
| ---------------------- | ------- | ------- | -------------------------- |
| `sandbox`              | boolean | `false` | Enable sandboxed execution |
| `toolOutputTruncation` | object  | varies  | Truncate large outputs     |

### MCP Servers

```json
{
  "mcpServers": {
    "server-name": {
      "command": "mcp-server-command",
      "args": ["--arg1", "value"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

See [MCP Integration](../tools/mcp.md) for details.

### Authentication

```json
{
  "authType": "qwen-oauth"
}
```

| Value               | Description            |
| ------------------- | ---------------------- |
| `qwen-oauth`        | Qwen OAuth (default)   |
| `openai-compatible` | API key authentication |

---

## Environment Variables

Settings can also be set via environment:

| Variable          | Setting      |
| ----------------- | ------------ |
| `OPENAI_API_KEY`  | API key      |
| `OPENAI_BASE_URL` | API endpoint |
| `OPENAI_MODEL`    | Model name   |
| `DIAL_SANDBOX`    | Sandbox mode |

Environment variables take precedence over settings files.

---

## Project-Specific Settings

Create `.dial/settings.json` in your project root:

```json
{
  "model": "gpt-4",
  "sessionTokenLimit": 16000,
  "sandbox": true
}
```

This only affects sessions started in that directory.

---

## Experimental Features

Enable experimental features:

```json
{
  "experimental": {
    "visionModelPreview": true,
    "vlmSwitchMode": "once"
  }
}
```

!!! warning
Experimental features may change or be removed.

---

## Resetting Settings

Delete settings files to reset:

```bash
# Reset global settings
rm ~/.dial/settings.json

# Reset project settings
rm .dial/settings.json
```

---

## Next Steps

- [Themes](themes.md) - Customize appearance
- [Providers](../providers/index.md) - Provider-specific settings
- [Reference](../reference/settings-schema.md) - Complete settings schema
