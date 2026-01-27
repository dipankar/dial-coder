# Commands Reference

Complete list of slash commands available in Dial Code.

---

## Session Commands

### `/help`

Display available commands and shortcuts.

```
/help
```

### `/clear`

Clear all conversation history and start fresh.

```
/clear
```

### `/compress`

Compress conversation history to save tokens while preserving context.

```
/compress
```

### `/stats`

Show current session statistics including token usage.

```
/stats
```

Output includes:

- Current token count
- Token limit
- Requests made
- Current model

### `/exit` or `/quit`

Exit Dial Code.

```
/exit
```

---

## Chat Management

### `/chat save`

Save the current conversation.

```
/chat save my-session
```

### `/chat resume`

Resume a saved conversation.

```
/chat resume my-session
```

### `/chat list`

List all saved conversations.

```
/chat list
```

### `/chat delete`

Delete a saved conversation.

```
/chat delete my-session
```

### `/chat share`

Generate a shareable link for the conversation.

```
/chat share
```

---

## Configuration Commands

### `/settings`

Open the settings dialog.

```
/settings
```

### `/theme`

Change the UI theme.

```
/theme
```

Opens a theme selector with available options.

### `/model`

Change the current model.

```
/model
```

### `/auth`

Change authentication method or re-authenticate.

```
/auth
```

---

## Tools & Context

### `/tools`

List all available tools and their status.

```
/tools
```

### `/mcp`

Show MCP server status and available tools.

```
/mcp
```

### `/memory`

Manage persistent memory.

```
/memory list    # List stored memories
/memory clear   # Clear all memories
```

### `/init`

Initialize a project context file (DIAL.md).

```
/init
```

---

## Agent Commands

### `/agents`

Manage custom subagents.

```
/agents list     # List available agents
/agents create   # Create a new agent
/agents delete   # Delete an agent
```

---

## IDE Integration

### `/ide`

Manage IDE integration.

```
/ide install    # Install VS Code extension
/ide status     # Check connection status
```

---

## Utility Commands

### `/summary`

Generate a summary of the current conversation.

```
/summary
```

### `/restore`

Restore from a checkpoint (if checkpointing is enabled).

```
/restore
```

---

## Command Syntax

### Arguments

Some commands accept arguments:

```
/chat save session-name
/theme dracula
```

### Flags

Some commands support flags:

```
/help --verbose
```

---

## Custom Commands

Create custom commands in `~/.dial/commands/` or `.dial/commands/`:

```toml
# ~/.dial/commands/deploy.toml
[command]
name = "deploy"
description = "Deploy to production"
prompt = "Run deployment checks and deploy to production"
```

Use with:

```
/deploy
```

---

## Next Steps

- [Keyboard Shortcuts](keyboard-shortcuts.md) - Terminal navigation
- [Configuration](configuration.md) - Customize command behavior
