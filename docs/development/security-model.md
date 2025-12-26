# Dial Code Security Model

This document describes the security architecture, trust boundaries, and threat model for Dial Code.

## Overview

Dial Code is an AI-powered CLI tool that executes actions on behalf of users. This creates a unique security challenge: balancing AI autonomy with system protection.

## Trust Boundaries

### Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER SYSTEM                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     DIAL CODE PROCESS                              │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                  CORE TRUSTED ZONE                           │  │  │
│  │  │  • Configuration loading                                     │  │  │
│  │  │  • Credential management                                     │  │  │
│  │  │  • Approval workflow                                         │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │              AI-CONTROLLED ZONE (Untrusted)                  │  │  │
│  │  │  • Tool execution requests                                   │  │  │
│  │  │  • Code generation                                           │  │  │
│  │  │  • File modification requests                                │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    SANDBOX (When Enabled)                          │  │
│  │  • Isolated command execution                                      │  │
│  │  • Limited filesystem access                                       │  │
│  │  • Network restrictions (optional)                                 │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
│  • LLM Provider APIs (Qwen, OpenAI, Anthropic, etc.)                    │
│  • MCP Servers                                                          │
│  • Web Search APIs                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Trust Levels

| Zone          | Trust Level | Description                                 |
| ------------- | ----------- | ------------------------------------------- |
| Core Trusted  | High        | Configuration, auth, approval workflow      |
| AI-Controlled | Low         | All AI-generated actions require validation |
| Sandbox       | Isolated    | Untrusted execution with restrictions       |
| External      | Untrusted   | Third-party services and APIs               |

## Threat Model

### Threat Categories

#### 1. Malicious AI Output

**Risk**: LLM generates harmful commands or code
**Mitigations**:

- Approval workflow for sensitive operations
- Sandbox execution for shell commands
- Multi-agent review for critical changes
- Command allowlisting/denylisting

#### 2. Credential Exposure

**Risk**: API keys or tokens leaked
**Mitigations**:

- Secrets scanning in pre-commit hooks
- Environment variable isolation
- OAuth token refresh (no long-lived tokens)
- Keychain integration on macOS
- `.qwenignore` for sensitive files

#### 3. Data Exfiltration

**Risk**: Sensitive data sent to external services
**Mitigations**:

- Telemetry is opt-in for prompts
- No file contents in usage statistics
- Network sandbox options
- Local model support (Ollama)

#### 4. Supply Chain Attacks

**Risk**: Malicious dependencies or MCP servers
**Mitigations**:

- MCP server allowlisting
- Tool namespace isolation
- Dependency scanning in CI
- Pinned Docker base images

#### 5. Prompt Injection

**Risk**: Malicious content in files affects AI behavior
**Mitigations**:

- File content is marked as user-provided
- Separate system prompts from user content
- Multi-agent review catches anomalies

## Security Controls

### 1. Approval Workflow

All potentially dangerous operations require user approval:

```
┌─────────────────────────────────────────────────────────┐
│                    Tool Request                          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Is tool allowed?    │
              └─────────────────────┘
                    │         │
                   YES        NO
                    │         │
                    ▼         ▼
              ┌─────────┐ ┌─────────────────┐
              │ Execute │ │ Prompt for      │
              │         │ │ Approval        │
              └─────────┘ └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                 APPROVE              DENY
                    │                     │
                    ▼                     ▼
              ┌─────────┐         ┌─────────────┐
              │ Execute │         │ Block       │
              └─────────┘         └─────────────┘
```

### 2. Approval Modes

| Mode        | File Edit | Shell Command | Description                      |
| ----------- | --------- | ------------- | -------------------------------- |
| `plan`      | Block     | Block         | Read-only analysis               |
| `default`   | Prompt    | Prompt        | Full approval                    |
| `auto-edit` | Auto      | Prompt        | Trust file edits                 |
| `yolo`      | Auto      | Auto          | Full trust (sandbox recommended) |

### 3. Tool Allowlisting

Configure trusted tools in `settings.json`:

```json
{
  "tools": {
    "allowed": [
      "run_shell_command(git status)",
      "run_shell_command(npm test)",
      "run_shell_command(npm run build)"
    ]
  }
}
```

### 4. Sandbox Execution

When sandbox is enabled:

- Commands run in isolated container
- Filesystem access limited to project
- Network can be restricted
- Resource limits applied

### 5. Secrets Protection

**Detection**: Pre-commit hook scans for:

- API keys (AWS, OpenAI, Anthropic, etc.)
- OAuth tokens
- Private keys
- Database connection strings
- Generic secrets patterns

**Exclusion**: Use `.qwenignore` for sensitive files:

```
.env
credentials.json
*.pem
```

## Security Best Practices

### For Users

1. **Use approval mode `default`** until you trust the AI's behavior
2. **Enable sandbox** for YOLO mode: `dial --sandbox --yolo`
3. **Review file changes** before committing
4. **Use allowlisting** for frequently-used safe commands
5. **Keep credentials out of project files**
6. **Use OAuth** instead of long-lived API keys when available

### For Developers

1. **Validate all tool inputs** before execution
2. **Sanitize file paths** to prevent traversal attacks
3. **Never execute shell commands** without user consent or sandbox
4. **Log security-relevant events** for audit
5. **Test security controls** in CI pipeline
6. **Update dependencies** regularly

### For Enterprise Deployment

1. **Enforce authentication type** via `security.auth.enforcedType`
2. **Configure system-wide settings** via `/etc/dial-code/settings.json`
3. **Restrict available tools** via `tools.core` setting
4. **Enable telemetry** for security monitoring
5. **Use folder trust** for project isolation
6. **Deploy with sandbox enabled** by default

## Incident Response

### If Suspicious Activity Detected

1. **Stop execution**: Ctrl+C immediately
2. **Review changes**: `git diff` to see modifications
3. **Revert if needed**: `git checkout .` or use checkpoints
4. **Report**: File an issue with sanitized details
5. **Update allowlist**: Remove problematic patterns

### If Credentials Exposed

1. **Revoke immediately**: Rotate exposed keys/tokens
2. **Audit access logs**: Check for unauthorized usage
3. **Update `.qwenignore`**: Prevent future exposure
4. **Enable secrets scanning**: Run `npm run pre-commit`

## Security Roadmap

### Planned Improvements

1. **Enhanced secrets detection** with more patterns
2. **Security audit logging** with structured events
3. **Rate limiting** for tool execution
4. **Network egress controls** in sandbox
5. **Signed MCP server verification**
6. **Security scoring** for AI-suggested changes

## Related Documents

- [ADR-004: Tool System Design](../adr/004-tool-system-design.md)
- [ADR-005: Sandbox Execution](../adr/005-sandbox-execution.md)
- [Configuration Guide](../cli/configuration.md)
- [Sandbox Documentation](../features/sandbox.md)
