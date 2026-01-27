# User Guide

Everything you need for daily use of Dial Code.

---

## Quick Reference

<div class="grid" markdown>

<div class="card" markdown>
### [Commands](commands.md)
All slash commands for controlling sessions, settings, and more.
</div>

<div class="card" markdown>
### [Keyboard Shortcuts](keyboard-shortcuts.md)
Terminal shortcuts and vim mode keybindings.
</div>

<div class="card" markdown>
### [Configuration](configuration.md)
Customize Dial Code with settings.json.
</div>

<div class="card" markdown>
### [Themes](themes.md)
Built-in themes and custom styling.
</div>

</div>

---

## Essential Commands

| Command     | Description        |
| ----------- | ------------------ |
| `/help`     | Show all commands  |
| `/clear`    | Clear conversation |
| `/compress` | Compress history   |
| `/stats`    | Show token usage   |
| `/exit`     | Exit Dial Code     |

---

## Essential Shortcuts

| Shortcut  | Action           |
| --------- | ---------------- |
| `Ctrl+C`  | Cancel operation |
| `Ctrl+L`  | Clear screen     |
| `Up/Down` | Navigate history |
| `Tab`     | Auto-complete    |

---

## Quick Tips

### Reference Files

Use `@` to include file context:

```
> Explain @src/index.ts
> Fix the bug in @utils/parser.js
```

### Run Shell Commands

Use `!` for shell passthrough:

```
> !npm test
> !git status
```

### Save Sessions

Save and resume conversations:

```
/chat save my-session
/chat resume my-session
```

---

## Next Steps

- [Commands](commands.md) - Complete command reference
- [Configuration](configuration.md) - Customize behavior
- [Themes](themes.md) - Change appearance
