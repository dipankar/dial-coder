# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Dial Code project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help:

- Document the reasoning behind decisions
- Provide context for future maintainers
- Enable informed decision-making about changes
- Create a historical record of the project's evolution

## ADR Index

| ID                                         | Title                         | Status   | Date    |
| ------------------------------------------ | ----------------------------- | -------- | ------- |
| [001](./001-monorepo-structure.md)         | Monorepo Package Structure    | Accepted | 2025-01 |
| [002](./002-multi-llm-provider-support.md) | Multi-LLM Provider Support    | Accepted | 2025-01 |
| [003](./003-multi-agent-architecture.md)   | Multi-Agent Review Pipeline   | Accepted | 2025-01 |
| [004](./004-tool-system-design.md)         | Extensible Tool System        | Accepted | 2025-01 |
| [005](./005-sandbox-execution.md)          | Sandbox Execution Environment | Accepted | 2025-01 |

## ADR Template

When creating a new ADR, use the following template:

```markdown
# ADR-XXX: Title

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

## Alternatives Considered

What other options were considered and why were they rejected?
```

## Contributing

When making significant architectural changes:

1. Create a new ADR with the next available number
2. Use the template above
3. Get the ADR reviewed before implementing the change
4. Update the ADR status as the decision progresses
