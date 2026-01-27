# Execution Modes

Dial Code automatically selects the appropriate execution mode based on your task's complexity and risk level.

---

## The Four Modes

### Ask Mode `?`

**Read-only queries** - No file modifications allowed.

```
> What does this function do?
> Explain the authentication flow
> Find all API endpoints
```

Best for:

- Exploring unfamiliar codebases
- Getting explanations
- Code review analysis

---

### Quick Mode `⚡`

**Direct execution** - Simple changes applied immediately.

```
> Fix the typo in README.md
> Add a comment to this function
> Update the version number
```

Best for:

- Typos and small fixes
- Simple additions
- Low-risk changes

---

### Review Mode `◎`

**Light review cycle** - Changes go through the dialectic pipeline.

```
> Add input validation to this form
> Create a new helper function
> Refactor this component
```

Best for:

- New features
- Moderate complexity changes
- Multi-file updates

---

### Safe Mode `🛡`

**Full multi-stage pipeline** - Maximum scrutiny for critical changes.

```
> Update the authentication logic
> Modify database connection handling
> Change the payment processing code
```

Best for:

- Security-sensitive code
- Database operations
- Authentication/authorization
- Payment processing

---

## Mode Selection

### Automatic Selection

Dial Code analyzes your request and automatically selects the appropriate mode based on:

| Factor         | Lower Risk        | Higher Risk        |
| -------------- | ----------------- | ------------------ |
| Files affected | Single file       | Multiple files     |
| Code type      | Comments, docs    | Auth, database     |
| Change scope   | Small, isolated   | Wide-reaching      |
| Keywords       | "explain", "show" | "modify", "delete" |

### Manual Override

Force a specific mode with the `--mode` flag:

```bash
# Force safe mode for extra scrutiny
dial --mode safe

# Use quick mode when confident
dial --mode quick
```

Or during a session:

```
> [safe] Update the config file
```

---

## Mode Escalation

If issues are detected during execution, Dial Code can automatically escalate:

- **Test failures** → Escalate to Review or Safe
- **Critical issues found** → Escalate to Safe
- **Low confidence** → Suggest escalation

### Example

```
> Add a new database query

[Quick mode selected]
[Test failure detected]
[Escalating to Review mode...]
```

---

## Configuration

Set default mode behavior in `.dial/settings.json`:

```json
{
  "executionMode": {
    "default": "auto",
    "autoSelect": true,
    "enableEscalation": true
  }
}
```

Options:

| Setting            | Values                                   | Description                |
| ------------------ | ---------------------------------------- | -------------------------- |
| `default`          | `auto`, `ask`, `quick`, `review`, `safe` | Starting mode              |
| `autoSelect`       | `true`, `false`                          | Enable automatic selection |
| `enableEscalation` | `true`, `false`                          | Allow mode escalation      |

---

## Mode Indicators

The current mode is shown in the UI:

```
[?] Ask mode active
[⚡] Quick mode active
[◎] Review mode active
[🛡] Safe mode active
```

---

## Best Practices

1. **Trust the auto-selection** - It's designed to balance speed and safety
2. **Use Safe for critical systems** - Authentication, payments, database schemas
3. **Quick mode for confidence** - When you know the change is simple
4. **Review new features** - New functionality benefits from the pipeline

---

## Next Steps

- [Dialectic Pipeline](dialectic-pipeline.md) - How Review/Safe modes process changes
- [Configuration](../user-guide/configuration.md) - Customize mode behavior
