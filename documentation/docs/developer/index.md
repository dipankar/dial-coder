# Developer Guide

Resources for contributing to and extending Dial Code.

---

## Getting Involved

<div class="grid" markdown>

<div class="card" markdown>
### [Architecture](architecture.md)
Understand the system design and package structure.
</div>

<div class="card" markdown>
### [Contributing](contributing.md)
Guidelines for submitting pull requests.
</div>

<div class="card" markdown>
### [Building](building.md)
Set up a development environment.
</div>

</div>

---

## Quick Setup

```bash
# Clone
git clone https://github.com/dipankar/dial-coder.git
cd dial-coder

# Install dependencies
npm install

# Build
npm run build

# Run from source
npm start
```

---

## Project Structure

```
dial-coder/
├── packages/
│   ├── cli/           # Terminal UI (React/Ink)
│   ├── core/          # Backend engine
│   ├── test-utils/    # Shared test utilities
│   └── vscode-ide-companion/  # VS Code extension
├── docs/              # Internal documentation
├── integration-tests/ # E2E tests
└── scripts/           # Build scripts
```

---

## Key Technologies

| Component     | Technology  |
| ------------- | ----------- |
| Language      | TypeScript  |
| CLI Framework | Yargs       |
| Terminal UI   | React + Ink |
| Testing       | Vitest      |
| Build         | esbuild     |
| Linting       | ESLint      |

---

## Development Workflow

1. **Fork & Clone** the repository
2. **Create a branch** for your feature
3. **Make changes** with tests
4. **Run preflight** checks
5. **Submit PR** with description

```bash
# Before submitting
npm run preflight
```

---

## Next Steps

- [Architecture](architecture.md) - System design
- [Contributing](contributing.md) - PR guidelines
- [Building](building.md) - Development setup
