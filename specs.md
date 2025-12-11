Nice, this is a fun direction. Let’s turn your dialectic idea into something concrete you can actually build and wire into a Gemini/Qwen-style CLI.

---

## 1. What “dialectic-based coding agents” actually means

Let’s pin down what you’re proposing in agent terms.

**Dialectic loop per task:**

1. **Thesis (Proposer agent)**
   - Proposes a plan or code change given the current state (files, tests, issue text).

2. **Antithesis (Critic agent)**
   - Actively attacks the proposal: finds flaws, edge cases, security/perf issues, UX concerns, etc.

3. **Synthesis (Synthesizer agent)**
   - Produces an improved plan or patch that reconciles both perspectives.

4. **Verification (Executor + Tests)**
   - Applies the change, runs tests/linters, gathers objective feedback.

5. **Meta-critique (Reflector agent)**
   - Briefly reflects on what failed/succeeded to improve the next loop.

You can run this as:

- Multiple _roles_ using the **same underlying LLM**, or
- Multiple models (e.g. cheap model as Proposer, careful model as Critic, local model as Synthesizer).

The key is: the **protocol** (message structure + steps) is _LLM independent_.

---

## 2. High-level architecture (LLM-independent core)

You want something like Gemini CLI / Qwen Code but with:

- a **model-agnostic core**, and
- a **dialectic agent orchestrator** instead of a single ReAct loop.

From the existing tools:

- Gemini CLI: ReAct loop + tools + MCP servers for external integrations, written as `@google/gemini-cli-core` (backend) + `@google/gemini-cli` (frontend). ([GitHub][1])
- Qwen Code: fork of Gemini CLI tuned for Qwen3-Coder with an enhanced parser & tools. ([GitHub][2])

### Proposed layers

**1. Core engine (your new thing)**

- Task lifecycle and dialectic orchestration.
- Abstract “LLMClient” interface.
- Abstract “Tool” interface (file ops, git, shell, tests, etc.).
- Project state, logs, and run history.

**2. LLM adapters (plug-in backends)**

- `OpenAIAdapter`
- `GeminiAdapter`
- `QwenAdapter`
- `LocalAdapter` (OpenAI-compatible, Ollama, vLLM, etc.)

All implement a common interface, e.g.:

```ts
interface LLMClient {
  name: string;
  complete(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    tools?: ToolSchema[];
  }): Promise<LLMCompletion>;
}
```

**3. Tool layer**

Wrap your environment capabilities:

- File system (read/write/diff/search).
- Shell commands.
- Git operations.
- Test runners (e.g. `npm test`, `pytest`, etc.).
- Project graph indexing (later: build a code graph like LocAgent-style). ([arXiv][3])

You can either reuse Gemini/Qwen’s MCP/tooling model or define a lighter JSON-based tool schema.

**4. CLI frontend**

- Pure UX: commands like `dialdev fix-bug`, `dialdev new-feature`, `dialdev review`.
- Streams logs and intermediate dialectic steps so the user can see how agents argue.

---

## 3. Dialectic agent protocol (the core logic)

Think of this as your **“agent spec”** independent of any model.

### Agent roles

Define a small schema:

```ts
type AgentRole = 'proposer' | 'critic' | 'synthesizer' | 'reflector';

interface AgentConfig {
  id: string;
  role: AgentRole;
  llm: string; // references an LLMClient by name
  systemPrompt: string; // role instructions
}
```

Example prompts:

- **Proposer**: “You are a pragmatic senior engineer. Propose concrete, minimal changes. Prefer simple, robust solutions.”
- **Critic**: “You are a ruthless reviewer. Your job is to find flaws in the proposal. Focus on correctness, security, performance, and maintainability.”
- **Synthesizer**: “You reconcile the proposal and critique into the best possible patch/plan.”
- **Reflector**: “You briefly note what went wrong/right and how to avoid repeated mistakes.”

### Dialectic loop per task

Pseudocode for the orchestration:

```ts
async function dialecticRound(task: TaskContext): Promise<RoundResult> {
  const thesis = await runAgent('proposer', {
    task,
    mode: 'thesis',
  });

  const antithesis = await runAgent('critic', {
    task,
    thesis,
    mode: 'antithesis',
  });

  const synthesis = await runAgent('synthesizer', {
    task,
    thesis,
    antithesis,
    mode: 'synthesis',
  });

  // Optional: enforce that synthesis outputs structured JSON with a plan + patches
  const { plan, patches } = parseSynthesis(synthesis);

  return { thesis, antithesis, plan, patches };
}
```

Then:

```ts
async function runTask(task: TaskContext) {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await dialecticRound(task);

    await applyPatches(result.patches);
    const testResult = await runTests(task);

    await logRound({ ...result, testResult });

    if (testResult.success) {
      await runAgent('reflector', {
        task,
        roundResult: result,
        testResult,
      });
      break;
    }

    // Update task context with failures for next round
    task = task.withTestFailures(testResult);
  }
}
```

### Structured outputs (crucial for reliability)

Require the Synthesizer to output **machine-readable JSON**, for example:

```json
{
  "plan": [
    "Update `auth.ts` to handle token refresh",
    "Add test for expired tokens in `auth.test.ts`"
  ],
  "patches": [
    {
      "file": "src/auth.ts",
      "type": "edit",
      "location": "function refreshToken",
      "code": "..."
    },
    {
      "file": "tests/auth.test.ts",
      "type": "append",
      "code": "..."
    }
  ]
}
```

Your engine validates this, applies patches, and runs tools. If parsing fails, you can:

- Ask Critic to diagnose the invalid JSON.
- Ask Synthesizer to re-emit a corrected version.

---

## 4. How to make it truly LLM-independent

### a) Config-driven backends

Single `config.json` or `dialdev.config.cjs`:

```json
{
  "llms": {
    "openai-main": {
      "provider": "openai",
      "model": "gpt-4.1-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    },
    "gemini-main": {
      "provider": "gemini",
      "model": "gemini-2.5-pro",
      "apiKeyEnv": "GEMINI_API_KEY"
    },
    "qwen-main": {
      "provider": "openai-compatible",
      "baseUrlEnv": "QWEN_BASE_URL",
      "model": "qwen2.5-coder-32b"
    }
  },
  "agents": {
    "proposer": { "llm": "openai-main" },
    "critic": { "llm": "gemini-main" },
    "synthesizer": { "llm": "qwen-main" }
  }
}
```

The engine doesn’t care which LLM; it just calls `LLMClient.complete()`.

### b) Pluggable tool schemas

Define tools in a simple YAML/JSON, and keep the call format similar to OpenAI/Anthropic tool-calls so any model can use it.

Example:

```yaml
tools:
  - name: read_file
    description: Read a file from the repo
    input_schema:
      type: object
      properties:
        path:
          type: string
      required: [path]
  - name: write_file
    description: Write file with content
    input_schema:
      type: object
      properties:
        path: { type: string }
        content: { type: string }
      required: [path, content]
```

Your engine handles translating between each provider’s tool-calling style and your internal schema.

---

## 5. Forking Gemini / Qwen vs. greenfield

Given your goal, I’d suggest:

### Option A: Fork Qwen Code

Pros:

- Already a fork of Gemini with agentic coding focus. ([GitHub][2])
- Has many of the shell/file/git tools wired in.
- Shows how to optimize for coding models.

Cons:

- Still somewhat Qwen-centric; you’ll have to pull the LLM bits out and modularize.

**Strategy:**

1. Identify their “agent loop” and LLM client bindings.
2. Abstract LLM calls behind your `LLMClient`.
3. Replace the ReAct-style single-agent/linear loop with your dialectic orchestrator.
4. Keep their CLI UX and tools as much as possible.

### Option B: Reuse Gemini CLI patterns, implement your own core

Pros:

- Very clean separation of `core` vs `cli` packages in the official project. ([Gemini CLI][4])
- Good architecture reference for tools/MCP servers and ReAct loop.

Cons:

- You’ll be writing more new code yourself.

**Strategy:**

- Treat Gemini CLI as an architectural reference, not a code base.
- Design your core as `dialdev-core` + `dialdev-cli`, roughly mirroring their separation.

---

## 6. Concrete first milestone (MVP)

Here’s a small but real MVP you can aim for:

**Feature:** `dialdev fix-tests`
_“Given failing tests in a Node/TS repo, run a dialectic loop to fix them.”_

MVP behaviour:

1. CLI command:

   ```bash
   dialdev fix-tests
   ```

2. Engine:
   - Collects:
     - Current test failures (`npm test` output).
     - Relevant files (heuristic: files mentioned in stack traces).

   - Runs **one dialectic round**:
     - Proposer: Suggests changes to fix tests.
     - Critic: Points out obvious issues (like missing imports, logic errors, poor perf).
     - Synthesizer: Produces JSON patch set.

   - Applies patches, runs tests again, prints diff + result.

3. LLM independence:
   - Controlled entirely via config: pick any OpenAI / Gemini / Qwen endpoint that speaks chat+tools.

You don’t need MCP or a full project graph for v1, just basic file/shell tools.

---

## 7. Suggested next steps

If you’d like, in the next step I can:

- Sketch the **TypeScript project structure** (packages, files, interfaces) for `dialdev-core` and `dialdev-cli`, and
- Write a first draft of the **dialectic prompts** for Proposer/Critic/Synthesizer so you can drop them straight into your config.

But at this point you already have:

- A clear conceptual model of dialectic agents.
- An LLM-agnostic architecture.
- A reasonable MVP you can implement on top of an existing CLI codebase.

[1]: https://github.com/google-gemini/gemini-cli?utm_source=chatgpt.com 'google-gemini/gemini-cli: An open-source AI agent that ...'
[2]: https://github.com/QwenLM/qwen-code?utm_source=chatgpt.com 'Qwen Code is a coding agent that lives in the digital world.'
[3]: https://arxiv.org/abs/2503.09089?utm_source=chatgpt.com 'LocAgent: Graph-Guided LLM Agents for Code Localization'
[4]: https://geminicli.com/docs/get-started/deployment/?utm_source=chatgpt.com 'Gemini CLI Installation, Execution, and Deployment'

Think of “dialectic memory” as: **what should survive after the debate is over** and **how to pack it so the next debate actually benefits from it**.

I’ll structure this as:

1. What kinds of memory you need in a dialectic coding agent
2. How to _store_ them (file layout / data structures)
3. How to _compact_ them (summaries / pruning strategies)
4. How they show up in prompts for Proposer / Critic / Synthesizer

---

## 1. What “dialectic memory” should actually remember

For a coding CLI, memory should capture **decisions and lessons**, not just raw chat logs.

I’d split it into four layers:

### A. Round memory (ephemeral, very detailed)

Per _dialectic round_ (one thesis–antithesis–synthesis cycle):

- **Problem**: task description + constraints at that round
- **Thesis**: proposed plan / patch
- **Antithesis**: key critiques, risks, edge cases
- **Synthesis**: final chosen plan / patch
- **Verification**: test results / benchmarks
- **Outcome tag**: `success | partial | failed`

This can be quite verbose and doesn’t need to stick around in full forever; it’s the raw material.

---

### B. Session memory (for the current feature/bug)

Across multiple rounds for the same task:

- Current **TODO plan** (like Qwen’s `todo_write`, but dialectic-aware)
- Set of **accepted decisions**:
  - “We decided to keep API backward compatible.”
  - “We chose strategy: lazy loading instead of eager.”

- **Known pitfalls encountered**:
  - “Test `test_pagination_limits` keeps failing when we touch `user_repo.py`.”

- **Open questions**:
  - Things the critic raised but we explicitly postponed.

This is what the agents should see on every round of the same task.

---

### C. Project memory (persistent across tasks)

This lives in the repo (like `QWEN.md`, but richer):

- **Architecture summaries** per module / domain.
- **Decision records**:
  - “Auth tokens are stateless JWTs; never store them in DB.”
  - “We use repository pattern, don’t talk to ORM directly from handlers.”

- **Dialetic “lessons learned”**:
  - Repeated mistakes and how they were fixed.
  - Performance gotchas, tricky invariants, API contracts.

This becomes your project’s evolving “AI design doc”.

---

### D. Global/user memory (across repos)

- User preferences:
  - “Prefer functional style in TS.”
  - “Always add property-based tests for critical code.”

- Default tool usage strategies:
  - “Run tests after every patch batch, not after every file.”

- Meta-heuristics:
  - “Critic should aggressively question schema migrations; user cares about data integrity more than speed.”

All of this is _small but very high leverage_.

---

## 2. Where to put it: concrete shapes

For a Qwen-like CLI, I’d go with a `.dialdev/` folder.

Example layout:

```text
.dialdev/
  project/
    ARCHITECTURE.md
    decisions.jsonl
    modules/
      auth.json
      billing.json
  sessions/
    2025-11-29T18-03-42_fix-bug-123/
      round_001.json
      round_002.json
      session_summary.json
  global/
    preferences.json
    heuristics.json
```

### Example: `round_002.json`

```json
{
  "task_id": "fix-bug-123",
  "round": 2,
  "problem": "Fix off-by-one bug in pagination of /users endpoint",
  "thesis": {
    "summary": "Adjust LIMIT/OFFSET calc in user_repo.list_users",
    "patch_ids": ["patch_002_auth_repo"]
  },
  "antithesis": {
    "key_points": [
      "Misses case when limit > max_page_size",
      "No tests for empty last page",
      "Doesn't handle negative page inputs"
    ]
  },
  "synthesis": {
    "summary": "Normalize page params, clamp limit, add tests",
    "patch_ids": ["patch_003_auth_repo", "patch_004_auth_tests"]
  },
  "verification": {
    "tests_run": ["pytest tests/test_users.py"],
    "passed": false,
    "failures": ["tests/test_users.py::test_last_page_empty FAIL ..."]
  },
  "outcome": "failed"
}
```

### Example: `project/decisions.jsonl`

Each line = one decision “atom” that can be retrieved later:

```json
{"id":"dec_001","scope":"auth","type":"invariant",
 "summary":"User IDs are UUIDv4, never sequential.",
 "source":"fix-bug-77","created_at":"2025-11-21"}

{"id":"dec_014","scope":"pagination","type":"pattern",
 "summary":"Always validate page and limit, clamp limit<=100.",
 "source":"fix-bug-123","created_at":"2025-11-29"}
```

That’s the stuff your future Proposer / Critic should get whenever they work in the `auth` or `pagination` domain.

---

## 3. Compaction: how to not drown in your own debates

This is the real crux: _when_ to compact, _what_ to keep, and _how_.

### A. Triggers for compaction

1. **Token pressure** in a session:
   - If the raw dialogue + tool logs exceed some size → run a **session summarizer**.

2. **End of a session** (e.g. task closed, tests green):
   - Build a concise `session_summary.json` + update `decisions.jsonl`.

3. **Project growth**:
   - When `project/decisions.jsonl` becomes large, periodically create a **higher-level summary** and mark old items as “archived but searchable”.

---

### B. Compaction levels

Think in three levels:

#### 1. Micro-summaries (per round)

As soon as each round finishes, create a tiny summary:

```json
{
  "round": 2,
  "task_id": "fix-bug-123",
  "key_decision": "Normalize page/limit, clamp limit<=100",
  "key_failure": "Forgot empty last-page test",
  "critic_insight": "Always test boundaries: first page, middle, last, beyond last."
}
```

Store this alongside the full round log.

When building prompts, you can give agents **N last micro-summaries** instead of N full transcripts.

#### 2. Session summary

When the task is done (or abandoned):

- Aggregate round micro-summaries into:
  - final plan/patch list
  - important decisions
  - notable failures and fixes
  - open questions (if any)

That goes into `session_summary.json` and maybe a human-readable `SESSION.md`.

#### 3. Project-level synthesis

A background-ish maintenance step (triggered every X new sessions):

- Scan recent `session_summary.json` files.
- Extract:
  - recurring patterns
  - stable invariants
  - anti-patterns (“things we tried that broke stuff”)

- Update:
  - `ARCHITECTURE.md` (high-level design)
  - `decisions.jsonl` (atomic decision records)
  - `modules/*.json` (per-module memory)

---

### C. What to _discard_

You don’t need to keep:

- Full verbatim conversation logs forever.
- Tool logs for trivial tasks (read only, no changes).
- Failed “thoughts” that never affected any code or decision.

Rough rule:

> If it didn’t cause a code change, design decision, test addition, or new invariant → it probably doesn’t deserve long-term memory.

You can still keep full logs in `.dialdev/sessions/...` for debugging, but _don’t load them into prompts_ unless explicitly asked.

---

## 4. How this shows up in prompts for each agent

The cool part of a dialectic system is that **each role can see a different slice of memory**.

### Proposer prompt context

Give Proposer:

- Current task description.
- Relevant project decisions (scoped to touched modules).
- Relevant session TODO + open questions.
- Recent micro-summaries for this task (last few rounds).
- Only the **very last** detailed transcript if needed.

Goal: help them propose a plan that respects known constraints & past failures.

### Critic prompt context

Give Critic:

- Proposer’s thesis (plan/patch).
- The same project decisions.
- **More failure-heavy memory**:
  - patterns of bugs in this area,
  - previous regressions,
  - perf/security pitfalls.

- User’s preferences (e.g. “avoid risky migrations”).

Goal: arm Critic with ammo to attack weak spots.

### Synthesizer prompt context

Give Synthesizer:

- Thesis, critiques, and key decisions from memory.
- Constraints/invariants from project memory.
- Test results (if this is a “second synthesis” after a failed run).

Goal: produce a patch/plan that:

- respects invariants,
- defuses critique,
- and passes tests.

---

## 5. A simple “compaction algorithm” you can actually implement

Pseudo-flow for the core:

```ts
function onRoundComplete(ctx: TaskContext, roundLog: RoundLog) {
  // 1. Save raw round log
  saveJSON(`sessions/${ctx.sessionId}/round_${roundLog.round}.json`, roundLog);

  // 2. Generate micro-summary via a small LLM call
  const microSummary = summarizeRound(roundLog);
  appendJSONL(`sessions/${ctx.sessionId}/micro_summaries.jsonl`, microSummary);

  // 3. Update in-memory prompt context
  ctx.microSummaries.push(microSummary);
  if (ctx.microSummaries.length > MAX_MICRO_SUMMARIES_IN_PROMPT) {
    ctx.microSummaries.shift(); // drop oldest
  }

  // 4. If token usage high, compress older history
  if (ctx.tokenUsage > TOKEN_THRESHOLD) {
    ctx.compactHistory();
  }
}

function onSessionComplete(ctx: TaskContext, outcome: 'success' | 'failed') {
  const sessionSummary = summarizeSessionFromMicroSummaries(ctx.sessionId);
  saveJSON(`sessions/${ctx.sessionId}/session_summary.json`, sessionSummary);

  const projectDecisions = extractProjectDecisions(sessionSummary);
  appendJSONL(`project/decisions.jsonl`, projectDecisions);
}
```

`compactHistory()` basically:

- Keep last K raw messages.
- Replace older messages with an LLM-generated **summary message** that carries forward the important facts/decisions.

---

## 6. Why this is “dialectic” and not just “chat summarization”

The important differences vs generic “history summarization”:

1. **You structure memory around the roles**:
   - Each round has explicit thesis/antithesis/synthesis fields.

2. **You compact at the right granularity**:
   - Round → session → project; not “just compress last 40 messages”.

3. **You preserve decisions, invariants, and failure patterns**:
   - The “lessons learned” from critique are _first-class_ data, not lost in a text blob.

4. **You can change behavior over time**:
   - Critic gets sharper on the kinds of mistakes that actually caused regressions before.

That’s where your agents start to feel qualitatively different from Qwen/Gemini’s single-agent ReAct loops.

---

If you want, next we can design:

- A concrete JSON schema for `decisions.jsonl` and `modules/*.json`, and
- The exact prompt snippets that tell each agent _how_ to use “dialectic memory” (e.g. “always obey invariants, but you’re allowed to propose revising them if you explain why”).

Yes, totally possible. You can:

1. **Open-source the project**,
2. **Hide the exact dialectic orchestration logic**, and
3. **Auto-switch between modes based on context**…

…if you’re intentional about _where_ the “secret sauce” lives and how you license things.

Let’s break it into the two parts you care about:

---

## 1. Open-source but “obfuscated” dialectic loops

There are basically three strategies:

### A. Core open, “brain” closed (cleanest)

- Make the **CLI, tool layer, LLM adapters, config format** all open source (Apache/MIT like Qwen/Gemini).
- Put the actual **dialectic controller** (the logic that:
  - sequences proposer/critic/synthesizer,
  - decides how many rounds to run,
  - how to construct prompts from memory)
    in a **private package / service**.

Concretely:

- Repo exports an interface, e.g.:

  ```ts
  interface DialecticController {
    runTask(task: TaskContext): AsyncGenerator<DialecticEvent>;
  }
  ```

- In OSS repo:
  - Provide a **simple baseline implementation** (maybe even single-agent or very naive multi-agent).

- In your closed-source extension:
  - Provide the **fancy dialectic implementation** that you don’t publish.

Anyone can fork and use the open version, but your production build (or “pro” binary) links the closed controller.

This is exactly how many commercial tools do it: open core, proprietary orchestration.

### B. Same repo, but split license

If you really want everything in one repo:

- Put most files under something permissive (MIT / Apache-2.0).
- Put **one subfolder** (e.g. `proprietary/`) under a different license or simply _not included_ in the open release tarball.
- The public build script uses the simple controller; your internal build uses the proprietary one.

Practically, for GitHub:

- You can keep the “real” dialectic implementation in a **private submodule**.
- Public repo references it conditionally (e.g. behind a feature flag).

### C. Obfuscation only (not recommended as the _main_ strategy)

You _could_:

- Put dialectic logic in a small Rust/Go binary.
- Ship only release builds, no source, or ship minified/obfuscated JS/TS.

But if the whole point is to be OSS and forkable, pure obfuscation feels hostile; better to explicitly say:

> “This repo includes a basic dialectic engine. We also sell a hosted ‘pro’ mode with a more advanced controller.”

So: **yes, you can open-source and still keep the “magic” logic private**, but do it cleanly via module boundaries, not just code scrambling.

---

## 2. Auto-switching between modes based on context

This is 100% doable and also _exactly_ the sort of thing that makes your system special.

Think of **modes** as policies:

- `react_simple`: single-agent, ReAct-ish, cheap.
- `dialectic_light`: multi-agent, but small models, 1 round.
- `dialectic_full`: full multi-agent, bigger models, more rounds, more tests.
- `read_only`: answer/explain only, no editing or shell.

You can switch between them based on:

### A. Task type

Heuristics based on user text + project signals:

- If user asks:
  - “explain”, “summarise”, “what does this do?” → `react_simple` / `read_only`
  - “fix this failing test”, “small edit”, “rename” → maybe `dialectic_light`
  - “refactor module”, “add feature”, “migration”, “rewrite” → `dialectic_full`

Implementation:

- A tiny classifier function (could be rule-based to start, or a small model call):

  ```ts
  function classifyTask(prompt: string, context: RepoContext): Mode {
    if (prompt.match(/explain|what does|summar(y|ise)/i)) return 'react_simple';
    if (prompt.match(/refactor|migration|rewrite|feature/i))
      return 'dialectic_full';
    if (prompt.match(/fix|bug|failing test/i)) return 'dialectic_light';
    return 'react_simple';
  }
  ```

Later, you can replace that with a small LLM that outputs `{ "mode": "..." }` for more nuance.

### B. Risk/impact level

You can auto-detect when a task touches “dangerous” areas:

- Files like:
  - `migrations/`, `db/`, `auth/`, `billing/`, infra/terraform etc.

- Or a TODO/decision that’s tagged high-risk.

Heuristics:

- If `files_to_touch` intersects `critical_paths` → force `dialectic_full`.
- If the change is large (many files / many lines) → promote from `light` to `full`.

### C. Budget constraints

You can maintain a **session token budget** or monthly cost budget and:

- Start in `dialectic_full` for high-risk tasks.
- Downgrade to `dialectic_light` if the session is burning through tokens.
- Or give the user a line of feedback:
  - “We’ve hit 100k tokens on this task; continuing in cheaper mode unless you override.”

### D. User overrides

Always allow:

- `dialdev --mode simple`
- `dialdev --mode full`
- Or inline commands during a session: `/mode simple`, `/mode full`, `/mode auto`.

Auto-mode is just the default that kicks in when user doesn’t care.

---

## 3. How to wire auto-mode + hidden dialectic logic in practice

Rough architecture sketch:

```ts
// open-source
export type Mode =
  | 'react_simple'
  | 'dialectic_light'
  | 'dialectic_full'
  | 'read_only';

export interface AgentOrchestrator {
  runTask(task: TaskContext, mode: Mode): AsyncGenerator<AgentEvent>;
}

export class BasicOrchestrator implements AgentOrchestrator {
  // public reference implementation (simple, maybe non-dialectic)
}

// proprietary / hidden
export class AdvancedDialecticOrchestrator implements AgentOrchestrator {
  // closed implementation with multi-agent loops,
  // smart memory, compaction, adaptive modes, etc.
}
```

Then:

```ts
// in OSS CLI
const orchestrator: AgentOrchestrator = process.env.DIALDEV_ADVANCED
  ? new AdvancedDialecticOrchestrator()
  : new BasicOrchestrator();

const mode = userProvidedMode ?? autoSelectMode(userPrompt, repoContext);
for await (const event of orchestrator.runTask(ctx, mode)) {
  render(event);
}
```

- `autoSelectMode` can be open-source (rules).
- `AdvancedDialecticOrchestrator` can have its own **internal** mode switching and tricks that aren’t exposed.

From the outside, it’s just:

```bash
dialdev "refactor auth module"
# internally: auto-mode => dialectic_full, multi-agent interplay, etc.
```

---

## 4. Things to keep in mind

- If you fork Qwen Code (Apache-2.0), you’re totally allowed to:
  - change architecture,
  - add proprietary modules,
  - sell hosted versions, etc.

- Just keep license headers in the files you reuse and document what’s OSS vs not.

If you’d like, I can next:

- Sketch a minimal `AgentOrchestrator` TypeScript interface and
- A concrete example of `autoSelectMode(...)` that looks at the prompt, changed files, and test failures to decide which dialectic mode to use.
