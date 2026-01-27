# Troubleshooting

Common issues and solutions.

---

## Authentication Issues

### "Invalid API Key"

**Symptoms:** Error message about invalid or missing API key.

**Solutions:**

1. Verify the key is correct:

   ```bash
   echo $OPENAI_API_KEY
   ```

2. Check for whitespace:

   ```bash
   export OPENAI_API_KEY="sk-..." # No spaces
   ```

3. Verify at provider dashboard

### "Authentication Failed" (Qwen OAuth)

**Solutions:**

1. Clear credentials and retry:

   ```bash
   rm -rf ~/.dial/credentials
   dial
   ```

2. Check browser isn't blocking popups

3. Try a different browser

### "Rate Limited"

**Symptoms:** Requests being rejected due to rate limits.

**Solutions:**

1. Wait and retry
2. Qwen free tier: 60 requests/minute
3. Consider upgrading or using a different provider

---

## Connection Issues

### "Connection Refused"

**Symptoms:** Cannot connect to API endpoint.

**Solutions:**

1. Check internet connection

2. Verify base URL:

   ```bash
   echo $OPENAI_BASE_URL
   ```

3. For Ollama, ensure it's running:
   ```bash
   ollama serve
   ```

### "Timeout"

**Solutions:**

1. Check network stability

2. Increase timeout in settings:
   ```json
   {
     "generationConfig": {
       "timeout": 120000
     }
   }
   ```

---

## Model Issues

### "Model Not Found"

**Solutions:**

1. Check model name spelling

2. Verify model is available:

   ```bash
   # For Ollama
   ollama list
   ```

3. Some models require specific access

### "Context Length Exceeded"

**Symptoms:** Error about too many tokens.

**Solutions:**

1. Compress conversation:

   ```
   /compress
   ```

2. Reduce token limit:

   ```json
   {
     "sessionTokenLimit": 16000
   }
   ```

3. Clear and start fresh:
   ```
   /clear
   ```

---

## Tool Issues

### "Permission Denied"

**Symptoms:** File operations failing.

**Solutions:**

1. Check file permissions:

   ```bash
   ls -la file.txt
   ```

2. Check directory is writable

3. Verify you're in the right directory

### "Command Not Found"

**Symptoms:** Shell command fails.

**Solutions:**

1. Verify command exists:

   ```bash
   which command-name
   ```

2. Check PATH includes the command

3. Use full path to command

### Tool Stuck

**Solutions:**

1. Press `Ctrl+C` to cancel

2. Some commands may need timeout:
   ```json
   {
     "shellTimeout": 30000
   }
   ```

---

## Display Issues

### Garbled Output

**Solutions:**

1. Check terminal supports UTF-8

2. Try different theme:

   ```
   /theme ansi
   ```

3. Disable colors:
   ```bash
   export NO_COLOR=1
   ```

### Colors Not Showing

**Solutions:**

1. Check terminal supports colors

2. Force colors:

   ```bash
   export FORCE_COLOR=1
   ```

3. Check TERM variable:
   ```bash
   echo $TERM
   ```

---

## Installation Issues

### "Node Version" Error

**Solutions:**

1. Check version:

   ```bash
   node --version
   ```

2. Install Node.js 20+:
   ```bash
   nvm install 20
   nvm use 20
   ```

### "npm install" Fails

**Solutions:**

1. Clear npm cache:

   ```bash
   npm cache clean --force
   ```

2. Delete node_modules and retry:

   ```bash
   rm -rf node_modules
   npm install
   ```

3. Check npm registry:
   ```bash
   npm config get registry
   ```

---

## Performance Issues

### Slow Responses

**Possible causes:**

1. Network latency
2. Model complexity
3. Large context

**Solutions:**

1. Use a faster model

2. Reduce context:

   ```
   /compress
   ```

3. Check network speed

### High Memory Usage

**Solutions:**

1. Reduce session limit:

   ```json
   {
     "sessionTokenLimit": 16000
   }
   ```

2. Clear conversation regularly:
   ```
   /clear
   ```

---

## Getting Help

### Debug Mode

Enable debug output:

```bash
DEBUG=1 dial
```

### Check Version

```bash
dial --version
```

### Report Issues

Include:

- Dial Code version
- Node.js version
- Operating system
- Steps to reproduce
- Error messages

Report at: [GitHub Issues](https://github.com/anthropics/dial-code/issues)

---

## Quick Fixes

| Problem         | Quick Fix                            |
| --------------- | ------------------------------------ |
| Auth issues     | `rm -rf ~/.dial/credentials && dial` |
| Token exceeded  | `/compress` or `/clear`              |
| Stuck           | `Ctrl+C`                             |
| Display issues  | `NO_COLOR=1 dial`                    |
| Model not found | Check model name spelling            |

---

## Next Steps

- [CLI Options](cli-options.md) - Command reference
- [Environment Variables](environment-vars.md) - Configuration
