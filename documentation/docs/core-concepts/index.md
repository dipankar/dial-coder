# Core Concepts

Understanding how Dial Code works under the hood.

---

## Key Concepts

<div class="grid" markdown>

<div class="card" markdown>
### [Execution Modes](execution-modes.md)
Four intelligent modes that adapt to your task's complexity and risk level.
</div>

<div class="card" markdown>
### [Dialectic Pipeline](dialectic-pipeline.md)
The multi-stage review process that ensures safer, higher-quality changes.
</div>

<div class="card" markdown>
### [Tools](tools.md)
25+ built-in capabilities from file operations to web search.
</div>

</div>

---

## How It Works

### 1. Task Analysis

When you submit a request, Dial Code analyzes:

- **Complexity** - Simple fix or multi-file change?
- **Risk Level** - Read-only, moderate, or critical?
- **Scope** - Which files and systems are affected?

### 2. Mode Selection

Based on the analysis, an execution mode is selected:

| Mode   | When Used                                      |
| ------ | ---------------------------------------------- |
| Ask    | Questions, explanations, read-only exploration |
| Quick  | Simple fixes, typos, straightforward changes   |
| Review | New features, moderate changes                 |
| Safe   | Critical systems, auth, database, security     |

### 3. Execution

- **Ask/Quick**: Direct execution with appropriate safeguards
- **Review/Safe**: Changes go through the [dialectic pipeline](dialectic-pipeline.md)

### 4. Approval

Before any file modifications:

1. Diff is displayed
2. You approve or reject
3. Changes are applied (or not)

---

## Design Principles

### Safety First

No changes are made without your explicit approval. The pipeline catches issues before they reach your codebase.

### Intelligent Adaptation

The system learns from each session, improving its understanding of your codebase and preferences.

### Transparent Process

Every step is visible - you can see what mode is selected, why, and what the pipeline is doing.

---

## Next Steps

- [Execution Modes](execution-modes.md) - Deep dive into each mode
- [Dialectic Pipeline](dialectic-pipeline.md) - How multi-stage review works
- [Tools](tools.md) - Available capabilities
