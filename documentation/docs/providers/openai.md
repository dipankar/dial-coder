# OpenAI Provider

Use OpenAI's GPT models or any OpenAI-compatible API.

---

## Quick Start

```bash
export OPENAI_API_KEY="sk-..."
dial
```

---

## Configuration

### Environment Variables

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional
export OPENAI_MODEL="gpt-4"  # Optional
```

### .env File

Create `.env` in your project root:

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
```

### Settings File

```json
{
  "authType": "openai-compatible"
}
```

---

## Available Models

| Model           | Context | Best For             |
| --------------- | ------- | -------------------- |
| `gpt-4`         | 8K      | Complex reasoning    |
| `gpt-4-turbo`   | 128K    | Long context         |
| `gpt-4o`        | 128K    | Balanced performance |
| `gpt-3.5-turbo` | 16K     | Fast, economical     |

Set your model:

```bash
export OPENAI_MODEL="gpt-4o"
```

---

## OpenAI-Compatible APIs

Any API that follows the OpenAI format works:

### Anthropic (Claude)

```bash
export OPENAI_API_KEY="sk-ant-..."
export OPENAI_BASE_URL="https://api.anthropic.com/v1"
export OPENAI_MODEL="claude-3-opus-20240229"
```

### Azure OpenAI

```bash
export OPENAI_API_KEY="your-azure-key"
export OPENAI_BASE_URL="https://your-resource.openai.azure.com/openai/deployments/your-deployment"
export OPENAI_MODEL="gpt-4"
```

### OpenRouter

```bash
export OPENAI_API_KEY="your-openrouter-key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_MODEL="openai/gpt-4"
```

Free models available:

```bash
export OPENAI_MODEL="qwen/qwen3-coder:free"
```

### Together AI

```bash
export OPENAI_API_KEY="your-together-key"
export OPENAI_BASE_URL="https://api.together.xyz/v1"
export OPENAI_MODEL="meta-llama/Llama-3-70b-chat-hf"
```

---

## Vision Support

For vision-capable models (GPT-4V, GPT-4o):

```
> [attach image] Describe this UI
```

---

## Pricing

OpenAI uses pay-as-you-go pricing. See [openai.com/pricing](https://openai.com/pricing).

Track usage:

```
/stats
```

---

## Troubleshooting

### "Invalid API Key"

- Check key format (starts with `sk-`)
- Verify key is active at platform.openai.com
- No extra whitespace

### "Model Not Found"

- Check model name spelling
- Some models require specific access
- Use `/model` to see available options

### "Rate Limited"

- OpenAI has tier-based rate limits
- Wait and retry
- Consider upgrading tier

### "Context Length Exceeded"

```
/compress
```

Or reduce `sessionTokenLimit`:

```json
{
  "sessionTokenLimit": 16000
}
```

---

## Next Steps

- [Ollama Provider](ollama.md) - Local models
- [Configuration](../user-guide/configuration.md) - Settings reference
