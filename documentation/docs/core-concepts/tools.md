# Tools

Dial Code comes with 25+ built-in tools that extend its capabilities beyond simple text generation.

---

## What Are Tools?

Tools are capabilities that Dial Code can invoke to interact with your system:

- Read and write files
- Execute shell commands
- Search the web
- Store persistent memory
- And more...

---

## Tool Categories

### File System

| Tool             | Description                   |
| ---------------- | ----------------------------- |
| `read_file`      | Read file contents            |
| `write_file`     | Create or modify files        |
| `edit`           | Smart code editing with diffs |
| `list_directory` | List directory contents       |
| `glob`           | Find files by pattern         |
| `grep`           | Search file contents          |

### Shell

| Tool                | Description               |
| ------------------- | ------------------------- |
| `run_shell_command` | Execute terminal commands |

### Web

| Tool         | Description        |
| ------------ | ------------------ |
| `web_fetch`  | Fetch URL contents |
| `web_search` | Search the web     |

### Memory

| Tool          | Description              |
| ------------- | ------------------------ |
| `save_memory` | Store persistent context |
| `todo_write`  | Track tasks              |

### MCP (Model Context Protocol)

| Tool       | Description              |
| ---------- | ------------------------ |
| `mcp_tool` | Use external MCP servers |

---

## How Tools Work

### 1. Model Requests Tool

Based on your request, Dial Code decides which tools to use:

```
> What files are in this directory?
[Using list_directory tool]
```

### 2. Confirmation (if needed)

For sensitive operations, you'll be asked to confirm:

```
[run_shell_command] npm install express
Allow? (y/n)
```

### 3. Execution

The tool runs and results are returned to the model.

### 4. Response

Dial Code incorporates the results into its response.

---

## Viewing Available Tools

List all available tools:

```
/tools
```

Output shows:

- Tool name
- Description
- Whether confirmation is required

---

## Tool Safety

### Confirmation Required

These tools always require approval:

- `write_file` - File modifications
- `run_shell_command` - Shell execution
- `edit` - Code changes

### No Confirmation

These tools run automatically:

- `read_file` - Reading files
- `list_directory` - Listing directories
- `glob` - Finding files
- `grep` - Searching content

### Sandbox Mode

Enable sandboxing for additional safety:

```json
{
  "sandbox": true
}
```

In sandbox mode, file operations are restricted to the current directory.

---

## Using Tools Directly

### File References

Use `@` to reference files:

```
> Explain @src/index.ts
```

### Shell Passthrough

Use `!` to run shell commands:

```
> !npm run test
```

---

## Extending with MCP

The Model Context Protocol (MCP) allows adding external tools:

```json
{
  "mcpServers": {
    "database": {
      "command": "mcp-server-database",
      "args": ["--connection", "postgres://..."]
    }
  }
}
```

See [MCP Integration](../tools/mcp.md) for details.

---

## Tool Output

Tool results can be:

- Displayed directly
- Summarized (for large outputs)
- Truncated (configurable)

Configure in settings:

```json
{
  "toolOutputTruncation": {
    "threshold": 10000,
    "maxLines": 500
  }
}
```

---

## Common Patterns

### Exploring Code

```
> Show me all TypeScript files in src/
[Using glob tool: src/**/*.ts]
```

### Making Changes

```
> Add error handling to this function
[Using edit tool on src/utils.ts]
[Confirmation required]
```

### Running Tests

```
> Run the test suite
[Using run_shell_command: npm test]
[Confirmation required]
```

---

## Next Steps

- [File System Tools](../tools/file-system.md) - Detailed file operations
- [Shell Tool](../tools/shell.md) - Command execution
- [MCP Integration](../tools/mcp.md) - External tools
