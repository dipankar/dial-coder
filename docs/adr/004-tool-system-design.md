# ADR-004: Extensible Tool System

## Status

Accepted

## Context

AI coding assistants need to interact with the local environment to be effective. This includes:

- Reading and writing files
- Executing shell commands
- Searching code
- Fetching web content
- Managing memory/context

We needed a tool system that:

- Is extensible for new capabilities
- Provides security controls
- Supports user approval workflows
- Integrates with Model Context Protocol (MCP)

## Decision

We implemented a modular tool system with the following architecture:

### Core Tool Categories

1. **File System Tools**
   - `read_file`: Read file contents
   - `write_file`: Create/overwrite files
   - `edit_file`: Make targeted edits
   - `read_many_files`: Batch file reading
   - `list_directory`: Directory listing

2. **Shell Tools**
   - `run_shell_command`: Execute commands
   - Interactive shell support (via node-pty)
   - Command restriction patterns

3. **Search Tools**
   - `grep`: Content search (ripgrep-backed)
   - `glob`: File pattern matching
   - Recursive search support

4. **Web Tools**
   - `web_fetch`: Fetch URL content
   - `web_search`: Search the web (Tavily/DashScope)

5. **Memory Tools**
   - `memory_read`: Read context files
   - `memory_write`: Update context
   - Hierarchical memory loading

### Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(args: unknown): Promise<ToolResult>;
  requiresApproval?: boolean;
}
```

### Approval Modes

| Mode        | Behavior                                |
| ----------- | --------------------------------------- |
| `plan`      | Read-only, no modifications             |
| `default`   | Approval required for writes/commands   |
| `auto-edit` | Auto-approve edits, prompt for commands |
| `yolo`      | Auto-approve everything                 |

### MCP Integration

Model Context Protocol support for:

- Discovering external tools
- Connecting to MCP servers
- Namespaced tool names to avoid conflicts

### Tool Allowlisting

```json
{
  "tools": {
    "allowed": ["run_shell_command(git)", "run_shell_command(npm test)"]
  }
}
```

## Consequences

### Positive

- **Extensibility**: Easy to add new tools
- **Security**: Granular approval controls
- **Flexibility**: MCP allows external tool integration
- **User control**: Allowlisting for trusted operations
- **Performance**: Ripgrep for fast searching

### Negative

- **Security surface**: More tools = more attack surface
- **Approval fatigue**: Users may approve without reading
- **MCP complexity**: External tools add debugging complexity
- **Tool conflicts**: Need to handle name collisions

## Alternatives Considered

### Hardcoded Tool Set

Rejected because:

- Not extensible
- Can't adapt to project-specific needs
- No external tool support

### Unrestricted Tool Execution

Rejected because:

- Security risk too high
- No audit trail
- No user control
