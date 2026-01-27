# Providers

Dial Code supports multiple LLM providers. Choose based on your needs.

---

## Provider Comparison

| Provider            | Auth Method | Free Tier     | Best For                     |
| ------------------- | ----------- | ------------- | ---------------------------- |
| [Qwen](qwen.md)     | OAuth       | 2,000/day     | Getting started, general use |
| [OpenAI](openai.md) | API Key     | Pay-as-you-go | GPT models, enterprise       |
| [Ollama](ollama.md) | Local       | Unlimited     | Privacy, offline use         |

---

## Quick Setup

### Qwen (Recommended)

```bash
dial
# Browser opens for authentication
```

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
dial
```

### Ollama

```bash
# Start Ollama first
ollama serve

export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"
dial
```

---

## Switching Providers

During a session:

```
/auth
```

Or in settings:

```json
{
  "authType": "openai-compatible"
}
```

---

## Provider Features

| Feature          | Qwen | OpenAI | Ollama |
| ---------------- | ---- | ------ | ------ |
| Vision Models    | Yes  | Yes    | Some   |
| Function Calling | Yes  | Yes    | Some   |
| Streaming        | Yes  | Yes    | Yes    |
| Context Length   | 128K | Varies | Varies |

---

## Regional Options

### China (Mainland)

- **Alibaba Cloud Bailian** - [dashscope.aliyuncs.com](https://bailian.console.aliyun.com/)
- **ModelScope** - Free tier available

### International

- **Alibaba Cloud ModelStudio** - [dashscope-intl.aliyuncs.com](https://modelstudio.console.alibabacloud.com/)
- **OpenRouter** - Free tier for some models

See individual provider pages for setup details.

---

## Next Steps

- [Qwen](qwen.md) - Default provider setup
- [OpenAI](openai.md) - API key configuration
- [Ollama](ollama.md) - Local model setup
