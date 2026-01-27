# Themes

Customize the visual appearance of Dial Code.

---

## Changing Themes

### Using Commands

```
/theme
```

Opens the theme selector dialog.

### Using Settings

```json
{
  "theme": "dracula"
}
```

---

## Built-in Themes

### Dark Themes

| Theme              | Description            |
| ------------------ | ---------------------- |
| `default`          | Default dark theme     |
| `dial-dark`        | Dial Code branded dark |
| `dracula`          | Popular Dracula colors |
| `github-dark`      | GitHub dark mode       |
| `atom-one-dark`    | Atom editor dark       |
| `ayu`              | Ayu dark variant       |
| `shades-of-purple` | Purple-focused dark    |

### Light Themes

| Theme           | Description             |
| --------------- | ----------------------- |
| `default-light` | Default light theme     |
| `dial-light`    | Dial Code branded light |
| `github-light`  | GitHub light mode       |
| `ayu-light`     | Ayu light variant       |
| `xcode`         | Xcode-inspired light    |

### Accessibility

| Theme        | Description         |
| ------------ | ------------------- |
| `ansi`       | ANSI colors (dark)  |
| `ansi-light` | ANSI colors (light) |
| `no-color`   | Minimal colors      |

---

## Theme Preview

### Dracula

```
Primary: Purple (#bd93f9)
Background: Dark gray (#282a36)
Text: Light gray (#f8f8f2)
Accent: Pink (#ff79c6)
```

### GitHub Dark

```
Primary: Blue (#58a6ff)
Background: Dark (#0d1117)
Text: Light (#c9d1d9)
Accent: Green (#3fb950)
```

### Ayu

```
Primary: Orange (#ffb454)
Background: Dark blue (#0a0e14)
Text: Light (#b3b1ad)
Accent: Cyan (#59c2ff)
```

---

## Custom Themes

Create a custom theme in your settings:

```json
{
  "customTheme": {
    "name": "my-theme",
    "colors": {
      "primary": "#7c4dff",
      "background": "#1a1a2e",
      "text": "#eaeaea",
      "accent": "#00d4ff",
      "error": "#ff5555",
      "warning": "#ffb86c",
      "success": "#50fa7b",
      "info": "#8be9fd"
    }
  }
}
```

### Color Properties

| Property     | Description        |
| ------------ | ------------------ |
| `primary`    | Main brand color   |
| `background` | Background color   |
| `text`       | Primary text color |
| `accent`     | Highlight color    |
| `error`      | Error messages     |
| `warning`    | Warning messages   |
| `success`    | Success messages   |
| `info`       | Info messages      |

---

## Code Highlighting

Code syntax highlighting uses the theme colors automatically.

For specific language highlighting, themes use Prism.js color schemes.

---

## Terminal Compatibility

### True Color Support

Most modern terminals support true color (24-bit):

- **macOS**: Terminal.app, iTerm2
- **Windows**: Windows Terminal, ConEmu
- **Linux**: Most modern terminals

### 256 Color Fallback

For terminals with limited color support:

```json
{
  "theme": "ansi"
}
```

### No Color

For accessibility or CI environments:

```json
{
  "theme": "no-color"
}
```

Or set environment variable:

```bash
export NO_COLOR=1
```

---

## Mode Indicators

Themes affect mode indicator colors:

| Mode   | Color    |
| ------ | -------- |
| Ask    | Blue     |
| Quick  | Orange   |
| Review | Green    |
| Safe   | Pink/Red |

---

## Tips

1. **Match your terminal** - Choose a theme that complements your terminal theme
2. **Consider lighting** - Use light themes in bright environments
3. **Test readability** - Ensure code and diffs are readable
4. **Accessibility** - Use high-contrast themes if needed

---

## Next Steps

- [Configuration](configuration.md) - Other customization options
- [Keyboard Shortcuts](keyboard-shortcuts.md) - Navigation shortcuts
