# Shell Tool

Execute terminal commands with safety controls.

---

## Basic Usage

Dial Code executes shell commands when needed:

```
> Run the tests
[run_shell_command: npm test]
Allow? (y/n)
```

---

## Shell Passthrough

Use `!` for direct shell access:

```
> !npm run build
> !git status
> !ls -la
```

Still requires confirmation unless in YOLO mode.

---

## Environment

### Working Directory

Commands run in your current working directory (where you started `dial`).

### Environment Variable

Dial Code sets `DIAL_CODE=1` so scripts can detect the environment:

```bash
if [ -n "$DIAL_CODE" ]; then
  echo "Running in Dial Code"
fi
```

---

## Confirmation

### Default Behavior

All shell commands require confirmation:

```
[run_shell_command] npm install express
Allow? (y/n)
```

### YOLO Mode

Skip confirmations (use carefully):

```bash
dial --yolo
```

Or during session:

```
Shift+Tab  # Cycle to YOLO mode
```

---

## Sandboxing

### Enable Sandbox

Restrict command execution:

```json
{
  "sandbox": true
}
```

Or via environment:

```bash
export DIAL_SANDBOX=docker
dial
```

### Sandbox Options

| Value    | Description              |
| -------- | ------------------------ |
| `false`  | No sandboxing (default)  |
| `docker` | Docker container sandbox |
| `podman` | Podman container sandbox |

### What's Restricted

In sandbox mode:

- File access limited to current directory
- Network access may be restricted
- System commands blocked

---

## Interactive Commands

### PTY Mode

For interactive commands, enable PTY mode:

```json
{
  "interactiveShell": true
}
```

Supports:

- Color output
- Progress bars
- Interactive prompts (limited)

### Limitations

Some interactive commands don't work well:

- Editors (vim, nano)
- REPLs requiring input
- Password prompts

---

## Common Commands

### Package Management

```
> Install lodash
[npm install lodash]

> Update all dependencies
[npm update]
```

### Testing

```
> Run the tests
[npm test]

> Run tests in watch mode
[npm test -- --watch]
```

### Git

```
> Show git status
[git status]

> Commit these changes
[git add . && git commit -m "..."]
```

### Build

```
> Build the project
[npm run build]

> Start the dev server
[npm run dev]
```

---

## Safety Features

### Command Review

Before execution, review the command:

```
[run_shell_command] rm -rf node_modules
Allow? (y/n)
```

### Dangerous Command Detection

Dial Code warns about potentially dangerous commands:

- `rm -rf`
- `sudo`
- System-wide changes

### Execution Modes

In **Safe** mode, shell commands go through the dialectic pipeline for review.

---

## Configuration

### Color Output

Enable colored command output:

```json
{
  "shellColor": true
}
```

### Timeout

Set command timeout:

```json
{
  "shellTimeout": 60000
}
```

---

## Troubleshooting

### "Command Not Found"

The command isn't in your PATH. Verify:

```bash
which command-name
```

### "Permission Denied"

- Check file permissions
- May need `sudo` (use carefully)

### Hanging Commands

Press `Ctrl+C` to cancel. Some commands may need:

```json
{
  "shellTimeout": 30000
}
```

---

## Next Steps

- [File System](file-system.md) - File operations
- [MCP](mcp.md) - External tools
