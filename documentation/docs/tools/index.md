# Tools

Dial Code includes 25+ built-in tools for interacting with your system.

---

## Tool Categories

<div class="grid" markdown>

<div class="card" markdown>
### [File System](file-system.md)
Read, write, edit, search, and navigate files.
</div>

<div class="card" markdown>
### [Shell](shell.md)
Execute terminal commands with safety controls.
</div>

<div class="card" markdown>
### [MCP Integration](mcp.md)
Connect external tools via Model Context Protocol.
</div>

</div>

---

## Quick Reference

### File Operations

| Tool             | Description           | Confirmation |
| ---------------- | --------------------- | ------------ |
| `read_file`      | Read file contents    | No           |
| `write_file`     | Create/modify files   | Yes          |
| `edit`           | Smart code editing    | Yes          |
| `list_directory` | List directory        | No           |
| `glob`           | Find files by pattern | No           |
| `grep`           | Search file contents  | No           |

### Execution

| Tool                | Description            | Confirmation |
| ------------------- | ---------------------- | ------------ |
| `run_shell_command` | Execute shell commands | Yes          |

### Web

| Tool         | Description        | Confirmation |
| ------------ | ------------------ | ------------ |
| `web_fetch`  | Fetch URL contents | No           |
| `web_search` | Search the web     | No           |

### Memory

| Tool          | Description              | Confirmation |
| ------------- | ------------------------ | ------------ |
| `save_memory` | Store persistent context | No           |
| `todo_write`  | Track tasks              | No           |

---

## Viewing Tools

List all available tools:

```
/tools
```

---

## Using Tools

### Automatic

Dial Code automatically selects tools based on your request:

```
> List all Python files
[Using glob tool]
```

### File References

Use `@` to reference files:

```
> Explain @src/index.ts
```

### Shell Passthrough

Use `!` for direct shell access:

```
> !npm run test
```

---

## Tool Safety

### Confirmation Required

Potentially destructive tools require approval:

- File modifications (`write_file`, `edit`)
- Shell commands (`run_shell_command`)

### Sandbox Mode

Enable sandboxing for additional safety:

```json
{
  "sandbox": true
}
```

---

## Next Steps

- [File System](file-system.md) - File operations
- [Shell](shell.md) - Command execution
- [MCP](mcp.md) - External tools
