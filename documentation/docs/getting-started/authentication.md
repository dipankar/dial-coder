# Authentication

Connect Dial Code to your preferred LLM provider.

---

## Qwen OAuth (Recommended)

The easiest way to start - free with generous quotas.

```bash
dial
# Browser opens automatically for authentication
```

**Free Tier:**

- 2,000 requests per day
- 60 requests per minute
- Automatic credential refresh
- No API key needed

---

## OpenAI-Compatible APIs

Use environment variables or a `.env` file:

=== "Environment Variables"

````bash
export OPENAI_API_KEY="your_api_key"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export OPENAI_MODEL="gpt-4"

    dial
    ```

=== ".env File"
Create `.env` in your project root:
`env
    OPENAI_API_KEY=your_api_key
    OPENAI_BASE_URL=https://api.openai.com/v1
    OPENAI_MODEL=gpt-4
    `

---

## Provider-Specific Setup

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4"
````

### Anthropic

```bash
export OPENAI_API_KEY="sk-ant-..."
export OPENAI_BASE_URL="https://api.anthropic.com/v1"
export OPENAI_MODEL="claude-3-opus-20240229"
```

### Ollama (Local)

```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"
# No API key needed for local Ollama
```

### Alibaba Cloud (China)

```bash
export OPENAI_API_KEY="your_key"
export OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
export OPENAI_MODEL="qwen3-coder-plus"
```

### OpenRouter

```bash
export OPENAI_API_KEY="your_key"
export OPENAI_BASE_URL="https://openrouter.ai/api/v1"
export OPENAI_MODEL="qwen/qwen3-coder:free"
```

---

## Switching Providers

Change provider during a session:

```
/auth
```

Or specify in settings (`.dial/settings.json`):

```json
{
  "authType": "openai-compatible"
}
```

---

## Verify Connection

Check your current authentication status:

```
/stats
```

---

## Troubleshooting

### "Invalid API Key"

- Verify the key is correct
- Check the base URL matches the provider
- Ensure no extra whitespace in the key

### "Rate Limited"

- Qwen free tier: 60 requests/minute
- Wait briefly and retry
- Consider upgrading or using a different provider

### "Model Not Found"

- Check the model name is correct for your provider
- Some providers require specific model identifiers

---

## Next Steps

- [Quick Start](quick-start.md) - Run your first session
- [Providers](../providers/index.md) - Detailed provider guides
