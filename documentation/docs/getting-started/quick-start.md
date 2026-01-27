# Quick Start

Learn the basics of Dial Code in 5 minutes.

---

## Start a Session

```bash
dial
```

On first run, you'll be prompted to authenticate. The default is Qwen OAuth - just follow the browser prompt.

---

## Your First Prompts

Once authenticated, try these examples:

### Explore Code

```
> What does this codebase do?
```

Dial Code reads your project files and provides an overview.

### Get Explanations

```
> Explain how the authentication module works
```

Uses **Ask mode** - read-only, no file modifications.

### Make Changes

```
> Fix the typo in README.md
```

Uses **Quick mode** - direct execution for simple fixes.

### Complex Tasks

```
> Add input validation to the user registration form
```

Uses **Review mode** - changes go through the dialectic pipeline for review.

---

## Session Commands

Control your session with slash commands:

| Command     | Description                     |
| ----------- | ------------------------------- |
| `/help`     | Show available commands         |
| `/clear`    | Clear conversation history      |
| `/compress` | Compress history to save tokens |
| `/stats`    | Show token usage                |
| `/exit`     | Exit Dial Code                  |

---

## Key Concepts

### Execution Modes

Dial Code automatically selects the appropriate mode:

- **Ask** `?` - Read-only queries
- **Quick** `⚡` - Simple, direct changes
- **Review** `◎` - Changes with review cycle
- **Safe** `🛡` - Full multi-stage pipeline

### The Dialectic Pipeline

For Review and Safe modes, changes go through:

1. **Planner** - Analyzes and plans changes
2. **Reviewer** - Checks for issues
3. **Resolver** - Produces final implementation
4. **Learner** - Extracts patterns for future

### Approval Flow

Before file modifications, you'll see a diff and be asked to approve.

---

## Tips

- Use `@filename` to reference specific files
- Use `!command` to run shell commands directly
- Press `Ctrl+C` to cancel an operation
- Press `Up/Down` to navigate history

---

## Next Steps

- [Commands Reference](../user-guide/commands.md) - All available commands
- [Configuration](../user-guide/configuration.md) - Customize behavior
- [Execution Modes](../core-concepts/execution-modes.md) - Deep dive into modes
