# Keyboard Shortcuts

Terminal shortcuts for efficient navigation and control.

---

## Essential Shortcuts

| Shortcut | Action                   |
| -------- | ------------------------ |
| `Enter`  | Send message             |
| `Ctrl+C` | Cancel current operation |
| `Ctrl+D` | Exit (on empty line)     |
| `Ctrl+L` | Clear screen             |
| `Up`     | Previous history item    |
| `Down`   | Next history item        |

---

## Input Navigation

| Shortcut          | Action           |
| ----------------- | ---------------- |
| `Left` / `Right`  | Move cursor      |
| `Alt+Left`        | Move word left   |
| `Alt+Right`       | Move word right  |
| `Home` / `Ctrl+A` | Go to line start |
| `End` / `Ctrl+E`  | Go to line end   |

---

## Text Editing

| Shortcut    | Action                         |
| ----------- | ------------------------------ |
| `Backspace` | Delete character before cursor |
| `Delete`    | Delete character after cursor  |
| `Ctrl+U`    | Delete line before cursor      |
| `Ctrl+K`    | Delete line after cursor       |
| `Ctrl+W`    | Delete word before cursor      |

---

## Multi-line Input

| Shortcut               | Action                          |
| ---------------------- | ------------------------------- |
| `Ctrl+J` (Linux)       | Insert newline                  |
| `Ctrl+Enter` (Windows) | Insert newline                  |
| `Shift+Enter`          | Insert newline (some terminals) |

---

## Session Control

| Shortcut    | Action                         |
| ----------- | ------------------------------ |
| `Ctrl+C`    | Cancel request / Close dialog  |
| `Esc`       | Cancel operation / Clear input |
| `Shift+Tab` | Cycle approval modes           |

---

## External Editor

| Shortcut     | Action                        |
| ------------ | ----------------------------- |
| `Ctrl+X`     | Open input in external editor |
| `Meta+Enter` | Open input in external editor |

Configure your preferred editor:

```json
{
  "editor": "code --wait"
}
```

---

## Vim Mode

Enable vim mode in settings:

```json
{
  "vim": true
}
```

Or toggle with `/settings`.

### Normal Mode

| Key  | Action        |
| ---- | ------------- |
| `h`  | Move left     |
| `j`  | Move down     |
| `k`  | Move up       |
| `l`  | Move right    |
| `w`  | Next word     |
| `b`  | Previous word |
| `0`  | Line start    |
| `$`  | Line end      |
| `gg` | First line    |
| `G`  | Last line     |

### Editing (Normal Mode)

| Key      | Action                      |
| -------- | --------------------------- |
| `i`      | Insert mode (before cursor) |
| `a`      | Insert mode (after cursor)  |
| `I`      | Insert at line start        |
| `A`      | Insert at line end          |
| `o`      | New line below              |
| `O`      | New line above              |
| `x`      | Delete character            |
| `dd`     | Delete line                 |
| `yy`     | Yank (copy) line            |
| `p`      | Paste                       |
| `u`      | Undo                        |
| `Ctrl+R` | Redo                        |

### Visual Mode

| Key | Action            |
| --- | ----------------- |
| `v` | Enter visual mode |
| `V` | Visual line mode  |
| `y` | Yank selection    |
| `d` | Delete selection  |

### Commands (Normal Mode)

| Key  | Action                 |
| ---- | ---------------------- |
| `:w` | Save (send message)    |
| `:q` | Quit                   |
| `/`  | Search                 |
| `n`  | Next search result     |
| `N`  | Previous search result |

---

## Terminal-Specific Notes

### macOS Terminal

- Use `Option` instead of `Alt` for word navigation
- `Cmd+K` clears terminal (not just screen)

### Windows Terminal

- `Ctrl+Shift+C` / `Ctrl+Shift+V` for copy/paste
- Some shortcuts may conflict with terminal settings

### Linux

- Behavior varies by terminal emulator
- Most shortcuts work as documented

---

## Customization

Shortcuts cannot be customized directly, but you can:

1. **Enable vim mode** for vim-style navigation
2. **Use external editor** for complex input
3. **Configure terminal** shortcuts separately

---

## Next Steps

- [Commands](commands.md) - Slash command reference
- [Configuration](configuration.md) - Settings and preferences
