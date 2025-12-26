# ADR-001: Monorepo Package Structure

## Status

Accepted

## Context

Dial Code is a complex application with multiple concerns: CLI interface, core AI logic, VS Code integration, and testing utilities. We needed a structure that:

- Enables independent development and versioning of components
- Shares common code and types between packages
- Supports efficient build and test processes
- Allows for future extension with additional packages

## Decision

We adopted a monorepo structure using npm workspaces with the following packages:

```
dial-code/
├── packages/
│   ├── cli/           # Command-line interface (React + Ink)
│   ├── core/          # Core AI logic and tool scheduling
│   ├── test-utils/    # Shared testing utilities
│   └── vscode-ide-companion/  # VS Code extension
├── integration-tests/ # End-to-end tests
└── scripts/           # Build and development scripts
```

### Package Responsibilities

1. **@dial-code/cli** (~48K lines)
   - Terminal UI using React and Ink
   - User input handling and display rendering
   - Session management and history
   - Theme and configuration management

2. **@dial-code/core** (~40K lines)
   - LLM abstraction layer for multiple providers
   - Tool registration and execution
   - Multi-agent orchestration (Planner, Reviewer, etc.)
   - Memory and context management

3. **@dial-code/test-utils**
   - Shared mocks and fixtures
   - Test helpers and utilities
   - Common test configurations

4. **@dial-code/vscode-ide-companion**
   - VS Code extension for IDE integration
   - Code navigation and context sharing

## Consequences

### Positive

- **Clear separation of concerns**: CLI handles presentation, Core handles business logic
- **Independent testing**: Each package has its own test suite
- **Reusability**: Core package can be used by different frontends
- **Parallel development**: Teams can work on different packages simultaneously
- **Selective publishing**: Packages can be versioned and published independently

### Negative

- **Build complexity**: Need to coordinate builds across packages
- **Dependency management**: Must ensure consistent versions across packages
- **Initial setup overhead**: More configuration required than single-package structure

## Alternatives Considered

### Single Package Structure

Rejected because:

- Would create tight coupling between CLI and core logic
- Makes it harder to test components in isolation
- Limits reusability of core functionality

### Separate Repositories

Rejected because:

- Increases coordination overhead
- Makes atomic changes across components difficult
- Complicates dependency management
