# Ollama Provider

Run models locally for privacy and offline use.

---

## Prerequisites

Install Ollama from [ollama.ai](https://ollama.ai):

=== "macOS"
`bash
    brew install ollama
    `

=== "Linux"
`bash
    curl -fsSL https://ollama.ai/install.sh | sh
    `

=== "Windows"
Download from [ollama.ai/download](https://ollama.ai/download)

---

## Quick Start

```bash
# Start Ollama server
ollama serve

# Pull a model
ollama pull llama3

# Configure Dial Code
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"

# Start Dial Code
dial
```

---

## Recommended Models

### Code-Focused

| Model            | Size     | Best For        |
| ---------------- | -------- | --------------- |
| `codellama`      | 7B-34B   | Code generation |
| `deepseek-coder` | 6.7B-33B | Code completion |
| `starcoder2`     | 3B-15B   | Code assistance |

### General Purpose

| Model     | Size   | Best For          |
| --------- | ------ | ----------------- |
| `llama3`  | 8B-70B | General tasks     |
| `mistral` | 7B     | Fast responses    |
| `mixtral` | 8x7B   | Complex reasoning |

### Pull a Model

```bash
ollama pull codellama:13b
```

---

## Configuration

### Environment Variables

```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="codellama:13b"
# No API key needed for local Ollama
```

### Settings File

```json
{
  "authType": "openai-compatible"
}
```

---

## Performance Tips

### Hardware Requirements

| Model Size | RAM Required |
| ---------- | ------------ |
| 7B         | 8GB          |
| 13B        | 16GB         |
| 33B        | 32GB         |
| 70B        | 64GB+        |

### GPU Acceleration

Ollama automatically uses GPU when available:

- **NVIDIA**: CUDA support
- **Apple Silicon**: Metal support
- **AMD**: ROCm support (Linux)

### Optimize for Speed

Use smaller quantized models:

```bash
ollama pull llama3:8b-q4_0  # Smaller, faster
```

---

## Vision Models

Some Ollama models support vision:

```bash
ollama pull llava
export OPENAI_MODEL="llava"
```

Then use images:

```
> [attach image] Describe this
```

---

## Running on a Different Host

### Remote Server

```bash
# On server
ollama serve --host 0.0.0.0

# On client
export OPENAI_BASE_URL="http://server-ip:11434/v1"
```

### Docker

```bash
docker run -d -p 11434:11434 ollama/ollama
```

---

## Troubleshooting

### "Connection Refused"

Ensure Ollama is running:

```bash
ollama serve
```

### "Model Not Found"

Pull the model first:

```bash
ollama pull llama3
ollama list  # Verify it's downloaded
```

### Slow Responses

- Use a smaller model
- Ensure GPU is being used
- Check available RAM

### Out of Memory

- Use a quantized model (q4_0, q4_1)
- Close other applications
- Use a smaller model

---

## Available Models

List all available models:

```bash
ollama list
```

Search for models at [ollama.ai/library](https://ollama.ai/library).

---

## Next Steps

- [Qwen Provider](qwen.md) - Cloud alternative
- [Configuration](../user-guide/configuration.md) - Settings reference
