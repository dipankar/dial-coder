# ADR-003: Multi-Agent Review Pipeline

## Status

Accepted

## Context

Complex code changes require careful review to ensure quality, security, and correctness. Single-pass AI generation often misses edge cases, security issues, or architectural concerns. We needed an architecture that:

- Provides layered review of changes
- Catches issues before they're applied
- Learns from past mistakes
- Scales review depth based on task risk

## Decision

We implemented a multi-agent review pipeline with specialized agents:

### Agent Types

1. **Planner Agent**
   - Analyzes the task and creates a structured plan
   - Generates code patches for proposed changes
   - Identifies affected files and dependencies

2. **Reviewer Agent**
   - Reviews the plan for issues and concerns
   - Checks for security vulnerabilities
   - Identifies edge cases and potential bugs
   - Suggests improvements

3. **Resolver Agent**
   - Reconciles feedback from the reviewer
   - Produces the final implementation
   - Resolves conflicts between suggestions

4. **Learner Agent**
   - Extracts patterns from successful changes
   - Updates project-specific guidelines
   - Improves future recommendations

### Execution Modes

| Mode   | Symbol | Review Depth     | Use Case         |
| ------ | ------ | ---------------- | ---------------- |
| Ask    | `?`    | None (read-only) | Code exploration |
| Quick  | `⚡`   | None             | Simple fixes     |
| Review | `◎`    | Light review     | Moderate changes |
| Safe   | `🛡`   | Full pipeline    | Critical changes |

### Mode Selection

Automatic mode selection based on:

- Task complexity analysis
- File sensitivity (auth, database, etc.)
- Change scope (number of files)
- Keyword detection (security, password, etc.)

### Escalation

Automatic escalation when:

- Tests fail after changes
- Security concerns detected
- Confidence score is low
- User explicitly requests

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mode Selector                         │
├─────────────────────────────────────────────────────────┤
│              Dialectic Controller                        │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Planner  │ Reviewer │ Resolver │ Learner                │
│  Agent   │  Agent   │  Agent   │  Agent                 │
└──────────┴──────────┴──────────┴────────────────────────┘
```

## Consequences

### Positive

- **Quality assurance**: Multiple passes catch more issues
- **Security**: Dedicated security review step
- **Learning**: System improves over time
- **Flexibility**: Users can choose review depth
- **Safety**: Critical changes get extra scrutiny

### Negative

- **Latency**: Multiple agent passes take longer
- **Token cost**: More API calls for full pipeline
- **Complexity**: Agent coordination adds complexity
- **False positives**: Over-cautious escalation possible

## Alternatives Considered

### Single Agent with Longer Prompts

Rejected because:

- Context window limitations
- No separation of concerns
- Harder to debug and improve individual steps

### User-Triggered Review Only

Rejected because:

- Users may forget to request review
- No automatic safety net for risky changes
- Inconsistent quality assurance
