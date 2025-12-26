# ADR-005: Sandbox Execution Environment

## Status

Accepted

## Context

Executing AI-generated shell commands poses significant security risks:

- Malicious or buggy commands could damage the system
- Commands might access sensitive data
- Network access could leak information
- Resource consumption could be excessive

We needed a sandboxing solution that:

- Isolates command execution from the host
- Works across multiple platforms
- Provides appropriate access to project files
- Maintains reasonable performance

## Decision

We implemented a multi-strategy sandboxing system:

### Sandbox Strategies

1. **Docker** (Primary)
   - Full container isolation
   - Custom Dockerfile support
   - Prebuilt `dial-code-sandbox` image
   - Network and filesystem isolation

2. **Podman** (Alternative)
   - Rootless container support
   - Docker-compatible
   - Better for restricted environments

3. **macOS Seatbelt** (Native)
   - Uses `sandbox-exec`
   - Profile-based restrictions
   - Three built-in profiles:
     - `permissive-open`: Project folder writes only
     - `strict`: Deny by default
     - Custom profiles via `.dial/sandbox-macos-*.sb`

4. **No Sandbox** (Development)
   - For trusted environments
   - Explicit opt-in required

### Configuration

```bash
# Via environment
export DIAL_SANDBOX=docker

# Via CLI flag
dial --sandbox

# Via settings.json
{
  "tools": {
    "sandbox": "docker"
  }
}
```

### Custom Sandbox

Project-specific sandboxing via `.dial/sandbox.Dockerfile`:

```dockerfile
FROM dial-code-sandbox

# Add project-specific dependencies
RUN apt-get update && apt-get install -y python3
```

### Default Behavior

- **Normal mode**: Sandbox disabled (approval required)
- **YOLO mode**: Sandbox auto-enabled for safety
- **CI/CD**: Sandbox recommended

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Shell Tool                              │
├─────────────────────────────────────────────────────────┤
│              Sandbox Controller                          │
├──────────┬──────────┬──────────┬────────────────────────┤
│  Docker  │  Podman  │ Seatbelt │   Direct Execution     │
│  Runner  │  Runner  │  Runner  │      (No sandbox)      │
└──────────┴──────────┴──────────┴────────────────────────┘
```

## Consequences

### Positive

- **Security**: Isolation prevents host damage
- **Flexibility**: Multiple strategies for different environments
- **Customization**: Project-specific sandboxes
- **Safety net**: Auto-enables in high-risk modes
- **Cross-platform**: Works on Linux, macOS, Windows

### Negative

- **Performance**: Container overhead
- **Complexity**: Multiple strategies to maintain
- **Compatibility**: Some commands may not work in sandbox
- **Setup**: Docker/Podman installation required

## Alternatives Considered

### Mandatory Sandboxing

Rejected because:

- Performance impact too high for development
- Some users need unrestricted access
- Breaks legitimate workflows

### Virtual Machine Isolation

Rejected because:

- Too heavy for interactive use
- Complex setup and management
- Poor developer experience

### chroot/namespaces Only

Rejected because:

- Linux-only solution
- Requires root for proper isolation
- Less portable than containers
