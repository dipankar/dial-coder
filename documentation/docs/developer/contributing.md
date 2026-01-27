# Contributing

Guidelines for contributing to Dial Code.

---

## Getting Started

1. **Fork** the repository
2. **Clone** your fork
3. **Install** dependencies
4. **Create** a feature branch

```bash
git clone https://github.com/your-username/dial-code.git
cd dial-code
npm install
git checkout -b feature/my-feature
```

---

## Development Workflow

### Before Making Changes

1. Check for existing issues or PRs
2. For new features, open an issue first
3. Discuss approach in the issue

### Making Changes

1. Write code following the style guide
2. Add tests for new functionality
3. Update documentation if needed

### Before Submitting

Run the preflight checks:

```bash
npm run preflight
```

This runs:

- Formatting check
- Linting
- Type checking
- Unit tests

---

## Code Style

### TypeScript

- Use strict mode
- Prefer explicit types
- Use interfaces for public APIs

```typescript
// Good
interface UserOptions {
  name: string;
  timeout?: number;
}

function createUser(options: UserOptions): User {
  // ...
}

// Avoid
function createUser(options: any) {
  // ...
}
```

### Formatting

Prettier handles formatting automatically:

```bash
npm run format
```

### Linting

ESLint enforces code quality:

```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

---

## Testing

### Unit Tests

```bash
npm run test           # Run all tests
npm run test -- path   # Run specific test
```

### Writing Tests

Use Vitest:

```typescript
import { describe, it, expect } from 'vitest';

describe('myFunction', () => {
  it('should return expected result', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Integration Tests

```bash
npm run test:e2e
```

---

## Pull Request Process

### PR Requirements

- [ ] Linked to an issue (bug or approved feature)
- [ ] Tests added/updated
- [ ] Documentation updated (if user-facing)
- [ ] Preflight checks pass
- [ ] Clear description of changes

### PR Title Format

```
type: brief description

Examples:
fix: resolve authentication timeout issue
feat: add custom command support
docs: update installation guide
refactor: simplify mode selection logic
```

### Types

| Type       | Description                  |
| ---------- | ---------------------------- |
| `feat`     | New feature                  |
| `fix`      | Bug fix                      |
| `docs`     | Documentation only           |
| `refactor` | Code change (no feature/fix) |
| `test`     | Test additions               |
| `chore`    | Build/tooling changes        |

---

## Contributor License Agreement

Before your first contribution is merged, you'll need to sign the CLA.

---

## Issue Guidelines

### Bug Reports

Include:

- Dial Code version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior

### Feature Requests

Include:

- Use case description
- Proposed solution
- Alternatives considered

---

## Review Process

1. **Automated checks** run on PR
2. **Maintainer review** for code quality
3. **Feedback addressed** by contributor
4. **Approval and merge**

---

## Getting Help

- Open an issue for questions
- Check existing issues/PRs
- Read the documentation

---

## Next Steps

- [Building](building.md) - Development setup
- [Architecture](architecture.md) - System design
