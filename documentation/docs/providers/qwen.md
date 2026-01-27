# Qwen Provider

The default and recommended provider for Dial Code.

---

## Quick Start

```bash
dial
```

On first run, your browser opens for Qwen OAuth authentication.

---

## Free Tier

Qwen offers a generous free tier:

| Limit               | Value              |
| ------------------- | ------------------ |
| Requests per day    | 2,000              |
| Requests per minute | 60                 |
| Token limit         | None (per-request) |
| Cost                | Free               |

---

## Authentication

### OAuth Flow

1. Run `dial`
2. Browser opens to qwen.ai
3. Log in or create account
4. Authorize Dial Code
5. Credentials cached locally

### Re-authenticate

```
/auth
```

### Clear Credentials

```bash
rm -rf ~/.dial/credentials
```

---

## Available Models

| Model                | Description          |
| -------------------- | -------------------- |
| `qwen3-coder`        | Code-focused model   |
| `qwen3-coder-plus`   | Enhanced code model  |
| `qwen-vl-max-latest` | Vision-capable model |

Set default model:

```json
{
  "model": "qwen3-coder-plus"
}
```

---

## Vision Support

Qwen supports vision models for image analysis:

```
> [attach image] What's in this screenshot?
```

Configure auto-switching:

```json
{
  "experimental": {
    "vlmSwitchMode": "once"
  }
}
```

Options:

| Mode      | Behavior                          |
| --------- | --------------------------------- |
| `once`    | Switch for one query, then revert |
| `session` | Switch for entire session         |
| `persist` | Stay with vision model            |

---

## Regional Endpoints

### International (Default)

Automatic - no configuration needed.

### China (Mainland)

Use Alibaba Cloud Bailian:

```bash
export OPENAI_API_KEY="your_key"
export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export OPENAI_MODEL="qwen3-coder-plus"
```

Or ModelScope (free tier):

```bash
export OPENAI_API_KEY="your_key"
export OPENAI_BASE_URL="https://api-inference.modelscope.cn/v1"
export OPENAI_MODEL="Qwen/Qwen3-Coder-480B-A35B-Instruct"
```

---

## Troubleshooting

### "Rate Limited"

- Free tier: 60 requests/minute
- Wait briefly and retry
- Heavy use may trigger limits

### "Authentication Failed"

```bash
# Clear and re-authenticate
rm -rf ~/.dial/credentials
dial
```

### "Model Fallback"

During high load, the service may use fallback models. This is automatic and maintains service quality.

---

## Next Steps

- [OpenAI Provider](openai.md) - Alternative provider
- [Configuration](../user-guide/configuration.md) - Customize settings
