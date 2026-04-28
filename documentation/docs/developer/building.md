# Building from Source

Set up a development environment for Dial Code.

---

## Prerequisites

### Node.js

Requires Node.js 20 or higher:

```bash
node --version
# v20.x.x or higher
```

Install via [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

### Git

```bash
git --version
```

---

## Clone and Install

```bash
# Clone the repository
git clone https://github.com/dipankar/dial-coder.git
cd dial-coder

# Install dependencies
npm install
```

---

## Build

### Full Build

```bash
npm run build
```

Builds all packages:

- `packages/cli`
- `packages/core`
- `packages/vscode-ide-companion`

### Build Specific Package

```bash
npm run build --workspace=packages/cli
npm run build --workspace=packages/core
```

---

## Run from Source

### Development Mode

```bash
npm start
```

### With Debug Output

```bash
DEBUG=1 npm start
```

### Debug with Chrome DevTools

```bash
npm run debug
```

Then open `chrome://inspect` in Chrome.

---

## Testing

### Unit Tests

```bash
npm run test
```

### Watch Mode

```bash
npm run test -- --watch
```

### Specific Package

```bash
npm run test --workspace=packages/cli
```

### Integration Tests

```bash
npm run test:e2e
```

Requires API keys in environment.

---

## Code Quality

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Formatting

```bash
npm run format      # Format all files
```

### Type Checking

```bash
npm run typecheck
```

### All Checks (Preflight)

```bash
npm run preflight
```

Run this before submitting PRs.

---

## Development Scripts

| Script              | Description           |
| ------------------- | --------------------- |
| `npm start`         | Run from source       |
| `npm run build`     | Build all packages    |
| `npm run test`      | Run unit tests        |
| `npm run test:e2e`  | Run integration tests |
| `npm run lint`      | Check linting         |
| `npm run lint:fix`  | Fix lint issues       |
| `npm run format`    | Format code           |
| `npm run typecheck` | Check types           |
| `npm run preflight` | Run all checks        |
| `npm run debug`     | Run with debugger     |

---

## Project Structure

```
dial-coder/
├── packages/
│   ├── cli/           # Terminal interface
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── core/          # Backend engine
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── ...
├── package.json       # Root package
├── tsconfig.json      # Root TS config
└── eslint.config.js   # ESLint config
```

---

## Workspace Commands

This is a monorepo using npm workspaces.

### Run in All Packages

```bash
npm run build --workspaces
npm run test --workspaces
```

### Run in Specific Package

```bash
npm run test --workspace=packages/core
```

---

## IDE Setup

### VS Code

Recommended extensions:

- ESLint
- Prettier
- TypeScript

Settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### WebStorm / IntelliJ

- Enable ESLint integration
- Enable Prettier integration
- Configure Node.js interpreter

---

## Common Issues

### "Module not found"

Run build first:

```bash
npm run build
```

### Type Errors

Ensure all packages are built:

```bash
npm run build
npm run typecheck
```

### Permission Errors

On Linux/macOS:

```bash
sudo npm install -g .
# Or configure npm prefix
npm config set prefix ~/.npm-global
```

---

## Environment Variables

For development:

```bash
export DEBUG=1              # Enable debug output
export DEV=true             # Development mode
export VERBOSE=true         # Verbose test output
```

---

## Next Steps

- [Architecture](architecture.md) - System design
- [Contributing](contributing.md) - PR guidelines
