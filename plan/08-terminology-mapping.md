# Terminology Mapping: Internal vs External

This document defines the mapping between internal design terminology and external user-facing terminology. **The dialectic approach is our internal design principle - users see a "multi-stage review system".**

## 1. Core Principle

> "Dialectic" is internal. Users see "review pipeline" or "safe mode".

The underlying architecture uses thesis-antithesis-synthesis, but externally we describe it as a structured review process that plans, reviews, and safely applies changes.

## 2. Terminology Mapping

### Execution Modes

| Internal (Code)   | External (CLI/Docs) | Description for Users                      |
| ----------------- | ------------------- | ------------------------------------------ |
| `read_only`       | `ask`               | "Ask questions without making changes"     |
| `simple`          | `quick`             | "Fast, single-pass execution"              |
| `dialectic_light` | `review`            | "Includes a review step before applying"   |
| `dialectic_full`  | `safe`              | "Multi-stage review with thorough testing" |

### Agent Roles

| Internal (Code) | External (CLI/Docs) | Description for Users    |
| --------------- | ------------------- | ------------------------ |
| Proposer        | Planner             | "Plans the changes"      |
| Critic          | Reviewer            | "Reviews for issues"     |
| Synthesizer     | Resolver            | "Finalizes the approach" |
| Reflector       | (hidden)            | Not shown to users       |

### Process Terms

| Internal (Code) | External (CLI/Docs) | Description for Users                |
| --------------- | ------------------- | ------------------------------------ |
| Dialectic round | Review cycle        | "One complete review cycle"          |
| Thesis          | Proposal            | "Proposed changes"                   |
| Antithesis      | Review findings     | "Issues found during review"         |
| Synthesis       | Final plan          | "Resolved approach"                  |
| Round memory    | Cycle history       | "History of this cycle"              |
| Session memory  | Task history        | "History of this task"               |
| Project memory  | Project knowledge   | "What Dial knows about your project" |

### Configuration Keys

| Internal (Code)       | External (Config)  | User Sees               |
| --------------------- | ------------------ | ----------------------- |
| `dialectic.maxRounds` | `review.maxCycles` | "Maximum review cycles" |
| `dialectic.agents`    | `review.stages`    | "Review stages"         |
| `dialecticController` | `reviewPipeline`   | "Review pipeline"       |

## 3. CLI Output Examples

### Mode Selection

```bash
# Command
dial --mode safe "Refactor the auth module"

# Output (NOT dialectic terminology)
[Mode: safe] Starting multi-stage review...

── Review Cycle 1 ─────────────────────────────────────────────

▶ Planning changes...
  Approach: Extract token validation into separate module
  Files: 3

▶ Reviewing proposal...
  Status: Acceptable
  Notes: 2 suggestions

▶ Resolving approach...
  Accepted: 1 suggestion
  Final: 3 files to modify

▶ Applying & testing...
  ✓ 24 tests passed

── Complete ───────────────────────────────────────────────────

Changes applied successfully.
```

### Mode Help

```bash
dial --help

MODES:
  --mode ask      Answer questions without making changes
  --mode quick    Fast execution for simple tasks
  --mode review   Adds a review step before applying changes
  --mode safe     Multi-stage review with thorough testing (recommended for refactoring)
  --mode auto     Automatically select based on task (default)
```

### Review Cycle Display

```
── Review Cycle 1 ──────────────────────────────────────────────

▶ Planning...          [analyzing task, reading files]
▶ Reviewing...         [checking for issues]
▶ Resolving...         [finalizing approach]
▶ Testing...           [running tests]

Result: Needs another cycle (2 tests failing)

── Review Cycle 2 ──────────────────────────────────────────────

▶ Planning...          [addressing test failures]
▶ Reviewing...         [checking fixes]
▶ Resolving...         [finalizing]
▶ Testing...           [running tests]

Result: ✓ All tests pass
```

## 4. Documentation Language

### README / Website

**Don't say:**

> "Dial uses a dialectic approach with thesis, antithesis, and synthesis phases..."

**Do say:**

> "Dial uses a multi-stage review pipeline that plans changes, reviews them for issues, and safely applies them with testing."

### Feature Description

**Don't say:**

> "The dialectic mode runs multiple rounds of proposer-critic-synthesizer..."

**Do say:**

> "Safe mode runs multiple review cycles, catching issues before they reach your codebase."

### How It Works Section

```markdown
## How Dial Works

1. **Plan** - Dial analyzes your request and plans the changes
2. **Review** - The plan is automatically reviewed for issues
3. **Resolve** - Feedback is incorporated into a final approach
4. **Test** - Changes are applied and tests are run
5. **Learn** - Dial remembers what worked for next time

For complex tasks, this cycle repeats until tests pass or you're satisfied.
```

## 5. Error Messages

| Internal Context             | User-Facing Message                                |
| ---------------------------- | -------------------------------------------------- |
| Critic found critical issues | "Review found critical issues that need attention" |
| Synthesis failed validation  | "Could not finalize a valid approach"              |
| Max rounds exceeded          | "Reached maximum review cycles without success"    |
| Proposer returned empty      | "Could not generate a plan for this task"          |
| Reflector failed             | (silent - internal only)                           |

## 6. Configuration File (User-Facing)

```json
// ~/.dial/config.json - What users see and edit
{
  "defaultMode": "auto",

  "review": {
    "maxCycles": 3,
    "runTestsAfterResolve": true,
    "stages": {
      "planner": { "provider": "default" },
      "reviewer": { "provider": "default" },
      "resolver": { "provider": "default" }
    }
  },

  "modes": {
    "quick": {
      "description": "Fast, single-pass execution"
    },
    "review": {
      "description": "Includes review before applying",
      "maxCycles": 1
    },
    "safe": {
      "description": "Multi-stage review with testing",
      "maxCycles": 3
    }
  }
}
```

## 7. Internal Code Comments

In the codebase, we CAN use dialectic terminology in comments and internal documentation:

```typescript
// packages/core/src/orchestrator/review-pipeline.ts

/**
 * ReviewPipeline implements the dialectic pattern:
 * - Planner = Proposer (thesis)
 * - Reviewer = Critic (antithesis)
 * - Resolver = Synthesizer (synthesis)
 *
 * Externally this is presented as a "multi-stage review pipeline".
 */
export class ReviewPipeline implements Orchestrator {
  // Internal: dialectic agents
  private proposer: ProposerAgent; // External: "planner"
  private critic: CriticAgent; // External: "reviewer"
  private synthesizer: SynthesizerAgent; // External: "resolver"
  private reflector: ReflectorAgent; // External: hidden
}
```

## 8. Logging Levels

| Log Level          | Terminology Used       |
| ------------------ | ---------------------- |
| User-facing (info) | External terms only    |
| Debug              | Can use internal terms |
| Internal metrics   | Can use internal terms |

```typescript
// User sees
logger.info('Starting review cycle 1...');
logger.info('Reviewing proposal...');

// Debug logs (not shown to users by default)
logger.debug('Critic agent evaluating thesis...');
logger.debug('Dialectic round 1 antithesis complete');
```

## 9. Metrics & Analytics (Internal)

Internal metrics can use dialectic terminology:

```jsonl
// .dial/analytics/metrics.jsonl (internal, not user-facing)
{"event":"dialectic_round_complete","round":1,"outcome":"success"}
{"event":"critic_issues_found","count":3,"severity":"medium"}
{"event":"synthesis_decisions","accepted":2,"rejected":1}
```

## 10. Summary Table

| Context               | Use Internal Terms?         | Use External Terms? |
| --------------------- | --------------------------- | ------------------- |
| CLI output            | No                          | Yes                 |
| CLI help              | No                          | Yes                 |
| README                | No                          | Yes                 |
| User config           | No                          | Yes                 |
| Error messages        | No                          | Yes                 |
| Code comments         | Yes                         | No                  |
| Class/function names  | Yes (with external aliases) | No                  |
| Debug logs            | Yes                         | No                  |
| Internal docs (plan/) | Yes                         | For reference       |
| Analytics/metrics     | Yes                         | No                  |
