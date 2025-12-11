# Review Pipeline: Agent Roles and Protocol

This document defines the four agent roles in Dial's review pipeline, their responsibilities, prompts, and interaction protocol.

> **Terminology Note**: This document uses internal design terminology. See `08-terminology-mapping.md` for user-facing equivalents. Users see "review pipeline" not "dialectic system".

## 1. Overview

### Internal vs External Terminology

| Internal (Design) | External (User-Facing) | Description        |
| ----------------- | ---------------------- | ------------------ |
| Dialectic Round   | Review Cycle           | One complete pass  |
| Proposer          | Planner                | Plans changes      |
| Critic            | Reviewer               | Reviews for issues |
| Synthesizer       | Resolver               | Finalizes approach |
| Reflector         | _(hidden)_             | Internal learning  |
| Thesis            | Proposal               | Proposed changes   |
| Antithesis        | Review findings        | Issues found       |
| Synthesis         | Final plan             | Resolved approach  |

### Internal Architecture (Design Reference)

```
┌──────────────────────────────────────────────────────────────┐
│              INTERNAL: DIALECTIC ROUND                       │
│                                                              │
│  ┌─────────┐     ┌─────────┐     ┌───────────┐             │
│  │PROPOSER │ ──▶ │ CRITIC  │ ──▶ │SYNTHESIZER│             │
│  │ Thesis  │     │Antithesis│     │ Synthesis │             │
│  └─────────┘     └─────────┘     └───────────┘             │
│       │                                │                    │
│       │         ┌───────────┐          │                    │
│       └────────▶│ REFLECTOR │◀─────────┘                    │
│                 │Meta-critique│                              │
│                 └───────────┘                               │
└──────────────────────────────────────────────────────────────┘
```

### User-Facing View (What Users See)

```
┌──────────────────────────────────────────────────────────────┐
│              EXTERNAL: REVIEW CYCLE                          │
│                                                              │
│  ┌─────────┐     ┌──────────┐     ┌──────────┐             │
│  │ PLANNER │ ──▶ │ REVIEWER │ ──▶ │ RESOLVER │             │
│  │         │     │          │     │          │             │
│  └─────────┘     └──────────┘     └──────────┘             │
│                                                              │
│  "Planning..."  "Reviewing..."  "Resolving..."              │
└──────────────────────────────────────────────────────────────┘
```

## 2. Agent Role Definitions

### 2.1 Proposer (Thesis)

**Purpose**: Generate initial plan or code change based on task requirements.

**Characteristics**:

- Pragmatic and solution-oriented
- Prefers minimal, focused changes
- Considers existing code patterns

**Input Context**:

- Task description
- Relevant files (from grep/read)
- Project decisions and invariants
- Previous round failures (if any)
- Session micro-summaries

**Output Format**:

```json
{
  "analysis": "Brief analysis of the problem",
  "approach": "Chosen approach and why",
  "plan": ["Step 1: Description", "Step 2: Description"],
  "patches": [
    {
      "file": "src/auth.ts",
      "action": "edit",
      "location": "function validateToken",
      "description": "Add expiry check",
      "code": "..."
    }
  ],
  "risks": ["Potential risk 1", "Potential risk 2"]
}
```

**System Prompt**:

```
You are the PROPOSER in a dialectic coding system. Your role is to generate concrete, actionable plans and code changes.

GUIDELINES:
1. Be pragmatic - propose minimal changes that solve the problem
2. Respect existing code patterns and architecture
3. Consider the project's established invariants and decisions
4. Acknowledge risks but don't over-engineer defenses
5. Prefer simple solutions over clever ones

CONSTRAINTS:
- You MUST output valid JSON in the specified format
- Each patch must be specific enough to apply programmatically
- Include file paths, function/class names, and actual code
- List potential risks honestly - the Critic will check your work

CONTEXT AVAILABLE:
- Task description and requirements
- Relevant source files
- Project architecture decisions
- Previous failure information (if this is a retry)

Remember: Your proposal will be critiqued. Be honest about trade-offs.
```

### 2.2 Critic (Antithesis)

**Purpose**: Rigorously analyze the proposal and identify weaknesses.

**Characteristics**:

- Adversarial but constructive
- Focuses on correctness, security, performance
- References past failures and anti-patterns

**Input Context**:

- Original task description
- Proposer's thesis
- Project invariants and decisions
- Known failure patterns
- User preferences (e.g., "strict about security")

**Output Format**:

```json
{
  "overall_assessment": "brief | acceptable | concerning | critical",
  "strengths": ["Strength 1", "Strength 2"],
  "issues": [
    {
      "severity": "low | medium | high | critical",
      "category": "correctness | security | performance | maintainability | edge_case",
      "description": "What's wrong",
      "location": "Where in the proposal",
      "suggestion": "How to fix it"
    }
  ],
  "missing_considerations": ["Something not addressed"],
  "questions": ["Clarifying question for synthesizer"]
}
```

**System Prompt**:

```
You are the CRITIC in a dialectic coding system. Your role is to rigorously analyze proposals and identify weaknesses.

YOUR MISSION:
Find problems BEFORE they reach production. Be thorough but fair.

AREAS TO CHECK:
1. CORRECTNESS
   - Logic errors, off-by-one bugs, null handling
   - Does the code actually solve the stated problem?
   - Are there untested code paths?

2. SECURITY
   - Input validation, injection risks, auth issues
   - Sensitive data exposure
   - OWASP top 10 considerations

3. PERFORMANCE
   - O(n²) or worse algorithms in hot paths
   - Unnecessary allocations, missing caching
   - Database query patterns (N+1, missing indexes)

4. MAINTAINABILITY
   - Code clarity and naming
   - Violation of project patterns
   - Missing error handling

5. EDGE CASES
   - Empty inputs, null values
   - Concurrent access
   - Error conditions

GUIDELINES:
- Be specific: point to exact locations in the proposal
- Be constructive: suggest fixes, not just problems
- Prioritize: distinguish critical issues from nitpicks
- Reference history: use known failure patterns from project memory

OUTPUT REQUIREMENTS:
- Use the specified JSON format
- Every issue must have a severity level
- Every issue must have a suggested fix
- Overall assessment must match the issues found
```

### 2.3 Synthesizer (Synthesis)

**Purpose**: Reconcile thesis and antithesis into an improved solution.

**Characteristics**:

- Diplomatic and balanced
- Produces actionable, machine-readable output
- Respects project constraints

**Input Context**:

- Original task description
- Proposer's thesis
- Critic's antithesis
- Project invariants
- Test results (if re-synthesis after failure)

**Output Format**:

```json
{
  "resolution_summary": "How thesis and antithesis were reconciled",
  "decisions": [
    {
      "issue": "Issue from critic",
      "resolution": "accepted | rejected | modified",
      "reasoning": "Why this decision"
    }
  ],
  "final_plan": ["Step 1: Description", "Step 2: Description"],
  "patches": [
    {
      "file": "src/auth.ts",
      "action": "edit | create | delete",
      "search": "exact string to find (for edit)",
      "replace": "exact replacement string",
      "description": "What this change does"
    }
  ],
  "tests_to_run": ["npm test -- --grep 'auth'"],
  "confidence": "low | medium | high"
}
```

**System Prompt**:

```
You are the SYNTHESIZER in a dialectic coding system. Your role is to produce the final, improved solution.

YOUR TASK:
1. Consider the Proposer's plan and code
2. Address the Critic's concerns
3. Produce a final patch set that is BETTER than the original

RECONCILIATION RULES:
- Critical issues MUST be addressed
- High severity issues SHOULD be addressed
- Medium issues should be addressed if feasible
- Low issues are optional but recommended

DECISION FRAMEWORK:
For each critique, you must decide:
- ACCEPT: Implement the critic's suggestion
- REJECT: Keep the original (with justification)
- MODIFY: Implement a variation that addresses the concern differently

OUTPUT REQUIREMENTS:
Your output must be machine-parseable. The patches array must contain:
- Exact file paths
- Exact search strings (for edit operations)
- Exact replacement strings
- Every patch must be independently verifiable

QUALITY GATES:
- All patches must respect project invariants
- No new security vulnerabilities
- Maintain or improve test coverage
- Follow existing code style

CONFIDENCE LEVELS:
- HIGH: All critical/high issues addressed, tests expected to pass
- MEDIUM: Most issues addressed, some uncertainty
- LOW: Significant concerns remain, may need another round
```

### 2.4 Reflector (Meta-Critique)

**Purpose**: Learn from the round and update project memory.

**Characteristics**:

- Analytical and concise
- Focused on patterns and lessons
- Updates long-term memory

**Input Context**:

- Full round history (thesis, antithesis, synthesis)
- Test/verification results
- Project memory (to avoid duplicates)

**Output Format**:

```json
{
  "round_outcome": "success | partial | failed",
  "lessons_learned": [
    {
      "type": "pattern | anti_pattern | invariant | heuristic",
      "scope": "project | module | file",
      "description": "What was learned",
      "applies_to": ["auth", "api"]
    }
  ],
  "decisions_to_record": [
    {
      "scope": "auth",
      "type": "invariant | pattern | constraint",
      "summary": "Tokens must always be validated before use",
      "reasoning": "Discovered during fix-bug-123"
    }
  ],
  "improvements_for_next_round": ["Be more careful about edge case X"],
  "memory_updates": {
    "add_to_architecture": "Optional note for ARCHITECTURE.md",
    "add_to_decisions": true
  }
}
```

**System Prompt**:

```
You are the REFLECTOR in a dialectic coding system. Your role is to extract lessons from completed rounds.

YOUR PURPOSE:
Turn experience into reusable knowledge. What should the system remember?

REFLECTION AREAS:

1. PATTERNS
   - What approaches worked well?
   - Are there reusable solutions?

2. ANTI-PATTERNS
   - What mistakes were made?
   - How can they be avoided in future?

3. INVARIANTS
   - What constraints were discovered?
   - What must always be true in this codebase?

4. HEURISTICS
   - Rules of thumb for this project
   - "When X, prefer Y"

GUIDELINES:
- Be concise: extract signal, not noise
- Be specific: vague lessons aren't useful
- Be actionable: lessons should guide future behavior
- Avoid duplicates: check existing project memory

MEMORY HIERARCHY:
- Project-wide: Goes into decisions.jsonl
- Module-specific: Goes into modules/{module}.json
- Session-specific: Stays in session summary

OUTPUT: Use the specified JSON format. Be selective - not every round produces new lessons.
```

## 3. Dialectic Protocol

### 3.1 Round Execution

```typescript
async function executeDialecticRound(
  task: TaskContext,
  round: number,
): Promise<RoundResult> {
  // 1. THESIS - Proposer generates initial plan
  const thesis = await agents.proposer.generate({
    task,
    projectMemory: await memory.getProjectDecisions(task.scope),
    sessionHistory: await memory.getMicroSummaries(task.sessionId),
    previousFailures: task.failures,
  });

  // 2. ANTITHESIS - Critic analyzes the proposal
  const antithesis = await agents.critic.generate({
    task,
    thesis,
    projectMemory: await memory.getProjectDecisions(task.scope),
    failurePatterns: await memory.getAntiPatterns(task.scope),
  });

  // 3. SYNTHESIS - Synthesizer reconciles
  const synthesis = await agents.synthesizer.generate({
    task,
    thesis,
    antithesis,
    projectInvariants: await memory.getInvariants(),
  });

  // 4. VERIFICATION - Apply and test
  const verification = await executor.applyAndTest(synthesis.patches, {
    testCommand: task.testCommand,
    validatePatches: true,
  });

  // 5. Record round
  const roundResult: RoundResult = {
    round,
    thesis,
    antithesis,
    synthesis,
    verification,
    outcome: verification.testsPass ? 'success' : 'failed',
  };

  await memory.saveRound(task.sessionId, roundResult);

  // 6. REFLECTION (if round complete or max rounds reached)
  if (roundResult.outcome === 'success' || round >= MAX_ROUNDS) {
    const reflection = await agents.reflector.generate({
      task,
      rounds: await memory.getRounds(task.sessionId),
      finalOutcome: roundResult.outcome,
    });

    await memory.applyReflection(reflection);
  }

  return roundResult;
}
```

### 3.2 Full Task Execution

```typescript
async function executeTask(task: TaskContext): Promise<TaskResult> {
  const mode = await modeSelector.selectMode(task);

  if (mode === 'read_only') {
    return executeReadOnly(task);
  }

  if (mode === 'simple') {
    return executeSimple(task); // Single-agent, no dialectic
  }

  // Dialectic modes
  const maxRounds = mode === 'dialectic_full' ? 3 : 1;

  for (let round = 1; round <= maxRounds; round++) {
    const result = await executeDialecticRound(task, round);

    if (result.outcome === 'success') {
      return {
        success: true,
        rounds: round,
        patches: result.synthesis.patches,
        summary: generateSummary(task.sessionId),
      };
    }

    // Update task with failure info for next round
    task = {
      ...task,
      failures: [...(task.failures || []), result.verification],
    };
  }

  return {
    success: false,
    rounds: maxRounds,
    patches: [],
    summary: generateFailureSummary(task.sessionId),
  };
}
```

## 4. Agent Memory Access

Each agent sees a different slice of memory:

### Proposer Memory View

```typescript
interface ProposerContext {
  // Current task
  task: TaskDescription;

  // What to consider
  relevantFiles: FileContent[];
  projectDecisions: Decision[]; // Filtered by scope
  sessionTodos: TodoItem[];

  // Previous attempts (if any)
  previousRoundSummaries: MicroSummary[];
  lastFailure?: VerificationResult;
}
```

### Critic Memory View

```typescript
interface CriticContext {
  // Current task and proposal
  task: TaskDescription;
  thesis: ThesisData;

  // Ammunition for critique
  projectDecisions: Decision[];
  failurePatterns: AntiPattern[]; // What has gone wrong before
  securityNotes: string[];
  performanceNotes: string[];

  // User preferences
  userPreferences: {
    strictSecurity?: boolean;
    strictPerformance?: boolean;
    preferSimplicity?: boolean;
  };
}
```

### Synthesizer Memory View

```typescript
interface SynthesizerContext {
  // The debate
  task: TaskDescription;
  thesis: ThesisData;
  antithesis: AntithesisData;

  // Constraints
  projectInvariants: Invariant[];
  testResults?: VerificationResult; // If re-synthesizing

  // Style guide
  codePatterns: Pattern[];
}
```

### Reflector Memory View

```typescript
interface ReflectorContext {
  // Full history
  task: TaskDescription;
  allRounds: RoundResult[];
  finalOutcome: 'success' | 'partial' | 'failed';

  // Existing memory (to avoid duplicates)
  existingDecisions: Decision[];
  existingPatterns: Pattern[];
  existingAntiPatterns: AntiPattern[];
}
```

## 5. Agent Configuration

### Default Configuration

```json
{
  "agents": {
    "proposer": {
      "llm": "default",
      "temperature": 0.7,
      "responseFormat": "json"
    },
    "critic": {
      "llm": "default",
      "temperature": 0.3,
      "responseFormat": "json"
    },
    "synthesizer": {
      "llm": "default",
      "temperature": 0.2,
      "responseFormat": "json"
    },
    "reflector": {
      "llm": "fast",
      "temperature": 0.5,
      "responseFormat": "json"
    }
  }
}
```

### Multi-Model Configuration

```json
{
  "llms": {
    "creative": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514"
    },
    "analytical": {
      "provider": "openai",
      "model": "gpt-4o"
    },
    "fast": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  },
  "agents": {
    "proposer": { "llm": "creative" },
    "critic": { "llm": "analytical" },
    "synthesizer": { "llm": "analytical" },
    "reflector": { "llm": "fast" }
  }
}
```

## 6. Error Handling

### Agent Output Validation

```typescript
async function runAgentWithValidation<T>(
  agent: Agent,
  context: AgentContext,
  schema: JSONSchema,
): Promise<T> {
  const maxRetries = 2;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await agent.generate(context);

    try {
      const parsed = JSON.parse(response.content);
      const valid = validateSchema(parsed, schema);

      if (valid) {
        return parsed as T;
      }

      // Invalid schema - ask for correction
      context = {
        ...context,
        validationError: `Output didn't match schema: ${valid.errors}`,
        previousAttempt: response.content,
      };
    } catch (e) {
      // JSON parse error - ask for correction
      context = {
        ...context,
        validationError: `Invalid JSON: ${e.message}`,
        previousAttempt: response.content,
      };
    }
  }

  throw new AgentOutputError(
    `Agent ${agent.role} failed to produce valid output`,
  );
}
```

### Round Failure Handling

```typescript
async function handleRoundFailure(
  task: TaskContext,
  round: RoundResult,
): Promise<TaskContext> {
  // Analyze what went wrong
  const failureAnalysis = analyzeFailure(round.verification);

  // Update task context for next round
  return {
    ...task,
    failures: [
      ...(task.failures || []),
      {
        round: round.round,
        testOutput: round.verification.output,
        failingTests: round.verification.failingTests,
        analysis: failureAnalysis,
      },
    ],
    // Add specific guidance based on failure type
    hints: generateHints(failureAnalysis),
  };
}
```

## 7. Streaming Output

For user visibility, agent outputs are streamed:

```typescript
async function* streamDialecticRound(
  task: TaskContext
): AsyncGenerator<DialecticEvent> {

  yield { type: 'round_start', round: task.round };

  // Stream proposer
  yield { type: 'agent_start', agent: 'proposer' };
  const thesis = await streamAgent('proposer', task, (chunk) => {
    yield { type: 'agent_chunk', agent: 'proposer', chunk };
  });
  yield { type: 'agent_complete', agent: 'proposer', output: thesis };

  // Stream critic
  yield { type: 'agent_start', agent: 'critic' };
  const antithesis = await streamAgent('critic', { task, thesis }, (chunk) => {
    yield { type: 'agent_chunk', agent: 'critic', chunk };
  });
  yield { type: 'agent_complete', agent: 'critic', output: antithesis };

  // Stream synthesizer
  yield { type: 'agent_start', agent: 'synthesizer' };
  const synthesis = await streamAgent('synthesizer', { task, thesis, antithesis }, (chunk) => {
    yield { type: 'agent_chunk', agent: 'synthesizer', chunk };
  });
  yield { type: 'agent_complete', agent: 'synthesizer', output: synthesis };

  // Verification
  yield { type: 'verification_start' };
  const verification = await executor.applyAndTest(synthesis.patches);
  yield { type: 'verification_complete', output: verification };

  yield { type: 'round_complete', outcome: verification.success ? 'success' : 'failed' };
}
```

## 8. CLI Display

The CLI shows the dialectic process in real-time:

```
$ dial "Fix the pagination bug"

[Mode: dialectic_light]

── Round 1 ───────────────────────────────────────────────────────

▶ Proposer (thinking...)
  Analysis: Off-by-one error in calculateOffset()
  Approach: Fix offset calculation, add boundary check
  Patches: 2 files

▶ Critic (reviewing...)
  Assessment: acceptable
  Issues:
    [medium] Missing test for page=0 case
    [low] Variable naming could be clearer

▶ Synthesizer (reconciling...)
  Decisions:
    ✓ Added test for page=0 (accepted)
    ✗ Kept original naming (rejected - not worth the churn)
  Patches: 3 files
  Confidence: high

▶ Verification
  Running: npm test -- --grep pagination
  ✓ 12 tests passed

── Complete ──────────────────────────────────────────────────────

Applied 3 patches to fix pagination bug.
Session saved to .dial/sessions/2024-01-15T10-30-00/
```
