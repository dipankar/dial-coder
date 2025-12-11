# Dialectic Memory System

This document defines Dial's hierarchical memory system for preserving context across rounds, sessions, and projects.

## 1. Memory Philosophy

Traditional coding assistants lose context between sessions. Dial's memory system captures:

- **Decisions**: What was decided and why
- **Patterns**: What approaches work in this codebase
- **Anti-patterns**: What has failed before
- **Invariants**: What must always be true

The goal is **accumulated wisdom**, not just conversation history.

## 2. Memory Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     MEMORY LAYERS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ROUND MEMORY (Ephemeral)                               │ │
│  │ • Full thesis/antithesis/synthesis                     │ │
│  │ • Tool calls and outputs                               │ │
│  │ • Test results                                         │ │
│  │ • Lives: Duration of task                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓ compacts to                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ SESSION MEMORY (Task-scoped)                           │ │
│  │ • Task TODO and progress                               │ │
│  │ • Accepted decisions                                   │ │
│  │ • Known pitfalls                                       │ │
│  │ • Open questions                                       │ │
│  │ • Lives: Duration of task, archived after              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓ extracts to                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PROJECT MEMORY (Persistent)                            │ │
│  │ • Architecture summaries                               │ │
│  │ • Decision records                                     │ │
│  │ • Module-specific patterns                             │ │
│  │ • Lessons learned                                      │ │
│  │ • Lives: Permanently in .dial/                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓ inherits from                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ GLOBAL MEMORY (User-wide)                              │ │
│  │ • User preferences                                     │ │
│  │ • Default heuristics                                   │ │
│  │ • Cross-project patterns                               │ │
│  │ • Lives: ~/.dial/global/                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 3. File Structure

### User Home Directory (`~/.dial/`)

```
~/.dial/
├── config.json              # User LLM configuration
├── global/
│   ├── preferences.json     # User preferences
│   └── heuristics.json      # Cross-project heuristics
├── commands/                # User-defined commands
└── agents/                  # User-defined agent configs
```

### Project Directory (`.dial/`)

```
.dial/
├── config.json              # Project config (extends ~/.dial/config.json)
├── DIAL.md                  # Human-readable project context
├── project/
│   ├── ARCHITECTURE.md      # Architecture summary
│   ├── decisions.jsonl      # Atomic decision records
│   └── modules/
│       ├── auth.json        # Module-specific memory
│       ├── api.json
│       └── database.json
└── sessions/
    ├── 2024-01-15T10-30-00_fix-pagination/
    │   ├── round_001.json
    │   ├── round_002.json
    │   ├── micro_summaries.jsonl
    │   └── session_summary.json
    └── 2024-01-14T14-22-00_add-auth/
        └── ...
```

## 4. Data Schemas

### 4.1 Round Memory

**File**: `.dial/sessions/{session_id}/round_{N}.json`

```typescript
interface RoundMemory {
  task_id: string;
  round: number;
  timestamp: string;

  problem: {
    description: string;
    constraints: string[];
    files_involved: string[];
  };

  thesis: {
    summary: string;
    approach: string;
    patches: PatchSpec[];
    risks: string[];
    token_usage: number;
  };

  antithesis: {
    overall_assessment: 'brief' | 'acceptable' | 'concerning' | 'critical';
    strengths: string[];
    issues: CritiqueIssue[];
    missing_considerations: string[];
    token_usage: number;
  };

  synthesis: {
    resolution_summary: string;
    decisions: ResolutionDecision[];
    final_patches: AppliedPatch[];
    confidence: 'low' | 'medium' | 'high';
    token_usage: number;
  };

  verification: {
    tests_run: string[];
    passed: boolean;
    failures: TestFailure[];
    output: string;
  };

  outcome: 'success' | 'partial' | 'failed';
}

interface CritiqueIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'correctness'
    | 'security'
    | 'performance'
    | 'maintainability'
    | 'edge_case';
  description: string;
  location: string;
  suggestion: string;
}

interface ResolutionDecision {
  issue: string;
  resolution: 'accepted' | 'rejected' | 'modified';
  reasoning: string;
}
```

### 4.2 Micro-Summary

**File**: `.dial/sessions/{session_id}/micro_summaries.jsonl`

Each line is a compact summary of one round:

```typescript
interface MicroSummary {
  round: number;
  task_id: string;
  timestamp: string;

  key_decision: string; // Most important decision made
  key_failure?: string; // What went wrong (if failed)
  critic_insight?: string; // Most useful critique
  pattern_discovered?: string; // Any new pattern found
  outcome: 'success' | 'partial' | 'failed';
}
```

**Example**:

```json
{"round":1,"task_id":"fix-pagination","key_decision":"Fix offset calc in calculateOffset()","key_failure":"Missed page=0 edge case","critic_insight":"Always test boundary conditions","outcome":"failed"}
{"round":2,"task_id":"fix-pagination","key_decision":"Add boundary validation + tests","pattern_discovered":"Use clamp() for pagination params","outcome":"success"}
```

### 4.3 Session Summary

**File**: `.dial/sessions/{session_id}/session_summary.json`

```typescript
interface SessionSummary {
  session_id: string;
  task_id: string;
  created_at: string;
  completed_at: string;

  task: {
    original_prompt: string;
    interpreted_goal: string;
    files_touched: string[];
    scope: string[]; // e.g., ["auth", "api"]
  };

  execution: {
    mode: 'simple' | 'dialectic_light' | 'dialectic_full';
    rounds_executed: number;
    total_tokens: number;
    final_outcome: 'success' | 'partial' | 'failed';
  };

  changes: {
    patches_applied: number;
    files_created: string[];
    files_modified: string[];
    files_deleted: string[];
  };

  learnings: {
    decisions_made: SessionDecision[];
    patterns_discovered: Pattern[];
    anti_patterns_encountered: AntiPattern[];
    open_questions: string[];
  };

  human_summary: string; // LLM-generated prose summary
}

interface SessionDecision {
  scope: string;
  type: 'invariant' | 'pattern' | 'constraint' | 'trade_off';
  summary: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
}
```

### 4.4 Project Decisions

**File**: `.dial/project/decisions.jsonl`

Each line is an atomic, retrievable decision:

```typescript
interface Decision {
  id: string; // e.g., "dec_001"
  scope: string; // e.g., "auth", "api", "global"
  type: 'invariant' | 'pattern' | 'constraint' | 'anti_pattern' | 'heuristic';

  summary: string; // The actual decision/rule
  reasoning: string; // Why this decision was made
  examples?: string[]; // Code examples if relevant

  source: {
    session_id: string;
    round?: number;
    date: string;
  };

  metadata: {
    confidence: 'low' | 'medium' | 'high';
    times_referenced: number; // How often this has been useful
    last_referenced?: string;
  };
}
```

**Example decisions.jsonl**:

```json
{"id":"dec_001","scope":"auth","type":"invariant","summary":"User IDs are UUIDv4, never sequential integers.","reasoning":"Sequential IDs leak information about user count and allow enumeration attacks.","source":{"session_id":"2024-01-10T09-00-00","date":"2024-01-10"},"metadata":{"confidence":"high","times_referenced":3}}
{"id":"dec_002","scope":"pagination","type":"pattern","summary":"Always validate page and limit params, clamp limit to max 100.","reasoning":"Prevents DoS via large page requests and handles invalid input gracefully.","examples":["const limit = Math.min(Math.max(1, requestedLimit), 100);"],"source":{"session_id":"2024-01-15T10-30-00","round":2,"date":"2024-01-15"},"metadata":{"confidence":"high","times_referenced":1}}
{"id":"dec_003","scope":"api","type":"anti_pattern","summary":"Never return raw database errors to API clients.","reasoning":"Leaks internal structure and can expose sensitive information.","source":{"session_id":"2024-01-12T14-00-00","date":"2024-01-12"},"metadata":{"confidence":"high","times_referenced":5}}
```

### 4.5 Module Memory

**File**: `.dial/project/modules/{module}.json`

```typescript
interface ModuleMemory {
  module: string; // e.g., "auth"
  last_updated: string;

  description: string; // What this module does
  key_files: string[]; // Important files in this module
  dependencies: string[]; // Other modules it depends on

  patterns: Pattern[]; // Patterns specific to this module
  invariants: string[]; // Things that must always be true
  common_issues: Issue[]; // Known problematic areas
  test_coverage_notes: string;

  recent_changes: RecentChange[]; // Last N changes to this module
}

interface Pattern {
  name: string;
  description: string;
  example?: string;
  when_to_use: string;
}

interface Issue {
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}
```

**Example** `.dial/project/modules/auth.json`:

```json
{
  "module": "auth",
  "last_updated": "2024-01-15",
  "description": "Authentication and authorization module using JWT tokens",
  "key_files": [
    "src/auth/jwt.ts",
    "src/auth/middleware.ts",
    "src/auth/guards.ts"
  ],
  "dependencies": ["database", "config"],
  "patterns": [
    {
      "name": "Token refresh flow",
      "description": "Access tokens expire in 15min, refresh tokens in 7 days",
      "when_to_use": "Any authenticated endpoint"
    }
  ],
  "invariants": [
    "Tokens are always validated before any protected operation",
    "Refresh tokens are single-use and invalidated after refresh",
    "Failed auth attempts are logged with IP address"
  ],
  "common_issues": [
    {
      "description": "Race condition in token refresh",
      "severity": "medium",
      "mitigation": "Use mutex lock on refresh endpoint"
    }
  ],
  "test_coverage_notes": "Integration tests cover main flows, missing edge cases for expired refresh tokens"
}
```

### 4.6 Architecture Summary

**File**: `.dial/project/ARCHITECTURE.md`

Human-readable (and LLM-readable) summary:

```markdown
# Project Architecture

## Overview

Brief description of the project and its purpose.

## Directory Structure
```

src/
├── api/ # REST API endpoints
├── auth/ # Authentication module
├── database/ # Database access layer
└── utils/ # Shared utilities

```

## Key Patterns

### Repository Pattern
All database access goes through repository classes. Never use ORM directly in handlers.

### Error Handling
All errors are wrapped in AppError. Never throw raw errors.

## Invariants

1. User IDs are UUIDv4, never sequential
2. All API responses follow the standard envelope format
3. Database transactions are used for multi-table operations

## Critical Paths
These areas require extra care:
- `src/auth/` - Security-sensitive
- `src/database/migrations/` - Data integrity
- `src/billing/` - Financial operations
```

### 4.7 Global User Memory

**File**: `~/.dial/global/preferences.json`

```typescript
interface UserPreferences {
  coding_style: {
    prefer_functional: boolean;
    prefer_explicit_types: boolean;
    max_function_length: number;
    comment_style: 'jsdoc' | 'inline' | 'minimal';
  };

  review_preferences: {
    strict_security: boolean;
    strict_performance: boolean;
    prefer_simplicity: boolean;
  };

  testing_preferences: {
    always_add_tests: boolean;
    preferred_framework?: string;
    coverage_threshold?: number;
  };

  ui_preferences: {
    verbosity: 'minimal' | 'normal' | 'verbose';
    show_reasoning: boolean;
    show_alternatives: boolean;
  };
}
```

**File**: `~/.dial/global/heuristics.json`

```typescript
interface GlobalHeuristics {
  meta_rules: MetaRule[];
  learned_patterns: LearnedPattern[];
}

interface MetaRule {
  id: string;
  rule: string;
  applies_when: string;
  source: 'user' | 'learned';
}

interface LearnedPattern {
  pattern: string;
  success_rate: number; // 0-1
  times_applied: number;
  last_applied: string;
}
```

## 5. Memory Operations

### 5.1 Writing Memory

```typescript
class MemoryWriter {
  // After each round
  async saveRound(sessionId: string, round: RoundMemory): Promise<void> {
    const path = `.dial/sessions/${sessionId}/round_${round.round.toString().padStart(3, '0')}.json`;
    await fs.writeFile(path, JSON.stringify(round, null, 2));

    // Also append micro-summary
    const micro = this.extractMicroSummary(round);
    await fs.appendFile(
      `.dial/sessions/${sessionId}/micro_summaries.jsonl`,
      JSON.stringify(micro) + '\n',
    );
  }

  // After session completes
  async saveSession(summary: SessionSummary): Promise<void> {
    const path = `.dial/sessions/${summary.session_id}/session_summary.json`;
    await fs.writeFile(path, JSON.stringify(summary, null, 2));

    // Extract decisions for project memory
    for (const decision of summary.learnings.decisions_made) {
      if (decision.confidence !== 'low') {
        await this.addProjectDecision(decision, summary.session_id);
      }
    }
  }

  // Add to project decisions
  async addProjectDecision(
    decision: SessionDecision,
    sessionId: string,
  ): Promise<void> {
    const projectDecision: Decision = {
      id: `dec_${Date.now()}`,
      scope: decision.scope,
      type: decision.type,
      summary: decision.summary,
      reasoning: decision.reasoning,
      source: {
        session_id: sessionId,
        date: new Date().toISOString().split('T')[0],
      },
      metadata: {
        confidence: decision.confidence,
        times_referenced: 0,
      },
    };

    await fs.appendFile(
      '.dial/project/decisions.jsonl',
      JSON.stringify(projectDecision) + '\n',
    );
  }
}
```

### 5.2 Reading Memory

```typescript
class MemoryReader {
  // Get decisions relevant to a scope
  async getProjectDecisions(scopes: string[]): Promise<Decision[]> {
    const allDecisions = await this.loadDecisions();

    return allDecisions.filter(
      (d) => scopes.includes(d.scope) || d.scope === 'global',
    );
  }

  // Get anti-patterns for critic
  async getAntiPatterns(scopes: string[]): Promise<Decision[]> {
    const decisions = await this.getProjectDecisions(scopes);
    return decisions.filter((d) => d.type === 'anti_pattern');
  }

  // Get invariants
  async getInvariants(): Promise<string[]> {
    const decisions = await this.loadDecisions();
    return decisions
      .filter((d) => d.type === 'invariant')
      .map((d) => d.summary);
  }

  // Get recent session summaries
  async getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
    const sessionDirs = await fs.readdir('.dial/sessions/');
    const sorted = sessionDirs.sort().reverse().slice(0, limit);

    const summaries: SessionSummary[] = [];
    for (const dir of sorted) {
      const summaryPath = `.dial/sessions/${dir}/session_summary.json`;
      if (await fs.exists(summaryPath)) {
        summaries.push(JSON.parse(await fs.readFile(summaryPath, 'utf-8')));
      }
    }

    return summaries;
  }

  // Get micro-summaries for current session
  async getMicroSummaries(sessionId: string): Promise<MicroSummary[]> {
    const path = `.dial/sessions/${sessionId}/micro_summaries.jsonl`;
    if (!(await fs.exists(path))) return [];

    const content = await fs.readFile(path, 'utf-8');
    return content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  }
}
```

### 5.3 Memory Compaction

```typescript
class MemoryCompactor {
  // Compact a session into a summary
  async compactSession(sessionId: string): Promise<SessionSummary> {
    const rounds = await this.loadRounds(sessionId);
    const microSummaries = await this.loadMicroSummaries(sessionId);

    // Use LLM to generate summary
    const summary = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: COMPACTION_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify({ rounds, microSummaries }),
        },
      ],
      responseFormat: 'json',
    });

    return JSON.parse(summary.content);
  }

  // Periodic project memory maintenance
  async compactProject(): Promise<void> {
    const decisions = await this.loadDecisions();

    // Remove stale decisions (never referenced, low confidence, old)
    const staleThreshold = new Date();
    staleThreshold.setMonth(staleThreshold.getMonth() - 3);

    const activeDecisions = decisions.filter((d) => {
      if (d.metadata.times_referenced > 0) return true;
      if (d.metadata.confidence === 'high') return true;

      const decisionDate = new Date(d.source.date);
      return decisionDate > staleThreshold;
    });

    // Merge similar decisions
    const mergedDecisions = await this.mergeSimilar(activeDecisions);

    // Rewrite decisions file
    await this.rewriteDecisions(mergedDecisions);

    // Update architecture summary
    await this.updateArchitectureSummary(mergedDecisions);
  }

  // Merge similar decisions using LLM
  async mergeSimilar(decisions: Decision[]): Promise<Decision[]> {
    // Group by scope
    const byScope = groupBy(decisions, (d) => d.scope);

    const merged: Decision[] = [];
    for (const [scope, scopeDecisions] of Object.entries(byScope)) {
      if (scopeDecisions.length <= 5) {
        merged.push(...scopeDecisions);
        continue;
      }

      // Ask LLM to identify duplicates/overlaps
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: MERGE_DECISIONS_PROMPT,
          },
          {
            role: 'user',
            content: JSON.stringify(scopeDecisions),
          },
        ],
        responseFormat: 'json',
      });

      merged.push(...JSON.parse(response.content).decisions);
    }

    return merged;
  }
}
```

## 6. Memory in Prompts

### 6.1 Proposer Context Assembly

```typescript
async function buildProposerContext(task: TaskContext): Promise<string> {
  const decisions = await memory.getProjectDecisions(task.scopes);
  const microSummaries = await memory.getMicroSummaries(task.sessionId);
  const moduleMemory = await memory.getModuleMemory(task.primaryModule);

  return `
## Task
${task.description}

## Files to Consider
${task.relevantFiles.map((f) => `- ${f}`).join('\n')}

## Project Decisions (Respect These)
${decisions.map((d) => `- [${d.scope}] ${d.summary}`).join('\n')}

## Module Context: ${task.primaryModule}
${moduleMemory?.description || 'No specific module context.'}
${moduleMemory?.invariants ? '\nInvariants:\n' + moduleMemory.invariants.map((i) => `- ${i}`).join('\n') : ''}

## Previous Rounds This Session
${
  microSummaries.length > 0
    ? microSummaries
        .map((m) => `Round ${m.round}: ${m.key_decision} (${m.outcome})`)
        .join('\n')
    : 'This is the first round.'
}

${
  task.failures?.length > 0
    ? `
## Previous Failures to Address
${task.failures.map((f) => `- Round ${f.round}: ${f.analysis}`).join('\n')}
`
    : ''
}
`;
}
```

### 6.2 Critic Context Assembly

```typescript
async function buildCriticContext(
  task: TaskContext,
  thesis: ThesisData,
): Promise<string> {
  const antiPatterns = await memory.getAntiPatterns(task.scopes);
  const decisions = await memory.getProjectDecisions(task.scopes);
  const preferences = await memory.getUserPreferences();

  return `
## Task Being Reviewed
${task.description}

## Proposal to Critique
### Approach
${thesis.approach}

### Proposed Patches
${thesis.patches.map((p) => `- ${p.file}: ${p.description}`).join('\n')}

### Proposer's Risk Assessment
${thesis.risks.map((r) => `- ${r}`).join('\n')}

## Known Anti-Patterns in This Codebase
${antiPatterns.map((a) => `- ${a.summary}`).join('\n') || 'None recorded.'}

## Project Decisions to Enforce
${decisions.map((d) => `- [${d.scope}] ${d.summary}`).join('\n')}

## User Review Preferences
- Strict about security: ${preferences.review_preferences.strict_security}
- Strict about performance: ${preferences.review_preferences.strict_performance}
- Prefer simplicity: ${preferences.review_preferences.prefer_simplicity}
`;
}
```

## 7. Memory Initialization

When a project first uses Dial:

```typescript
async function initializeProjectMemory(projectPath: string): Promise<void> {
  // Create directory structure
  await fs.mkdir(`${projectPath}/.dial/project/modules`, { recursive: true });
  await fs.mkdir(`${projectPath}/.dial/sessions`, { recursive: true });

  // Create initial files
  await fs.writeFile(`${projectPath}/.dial/project/decisions.jsonl`, '');

  // Generate initial architecture summary
  const files = await scanProject(projectPath);
  const architectureSummary = await generateInitialArchitecture(files);
  await fs.writeFile(
    `${projectPath}/.dial/project/ARCHITECTURE.md`,
    architectureSummary,
  );

  // Create DIAL.md (like QWEN.md)
  const dialMd = await generateDialMd(files);
  await fs.writeFile(`${projectPath}/.dial/DIAL.md`, dialMd);

  console.log('Initialized Dial memory in .dial/');
}
```

## 8. Memory Search

For large projects, we need efficient memory search:

```typescript
class MemorySearch {
  // Semantic search over decisions
  async searchDecisions(
    query: string,
    limit: number = 10,
  ): Promise<Decision[]> {
    const decisions = await this.loadDecisions();

    // Simple keyword matching (can be upgraded to embeddings)
    const scored = decisions.map((d) => ({
      decision: d,
      score: this.scoreMatch(query, `${d.summary} ${d.reasoning}`),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.decision);
  }

  // Find relevant module memory
  async findRelevantModules(files: string[]): Promise<ModuleMemory[]> {
    const modules = await this.loadAllModules();

    return modules.filter((m) =>
      m.key_files.some((kf) => files.some((f) => f.includes(kf))),
    );
  }

  // Find past sessions that touched similar files
  async findSimilarSessions(
    files: string[],
    limit: number = 5,
  ): Promise<SessionSummary[]> {
    const sessions = await this.loadRecentSessions(100);

    const scored = sessions.map((s) => ({
      session: s,
      overlap: this.calculateFileOverlap(files, s.task.files_touched),
    }));

    return scored
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, limit)
      .map((s) => s.session);
  }
}
```

## 9. Token Budget Management

Memory loading must respect context limits:

```typescript
class MemoryBudget {
  private maxTokens: number;
  private usedTokens: number = 0;

  constructor(maxTokens: number = 8000) {
    this.maxTokens = maxTokens;
  }

  async loadWithBudget(loaders: MemoryLoader[]): Promise<string[]> {
    const results: string[] = [];

    // Sort by priority
    const sorted = loaders.sort((a, b) => b.priority - a.priority);

    for (const loader of sorted) {
      const content = await loader.load();
      const tokens = this.estimateTokens(content);

      if (this.usedTokens + tokens <= this.maxTokens) {
        results.push(content);
        this.usedTokens += tokens;
      } else if (loader.canTruncate) {
        // Truncate to fit
        const available = this.maxTokens - this.usedTokens;
        const truncated = this.truncateToTokens(content, available);
        results.push(truncated);
        break;
      }
    }

    return results;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 4 chars per token
    return Math.ceil(text.length / 4);
  }
}

// Usage
const budget = new MemoryBudget(8000);
const context = await budget.loadWithBudget([
  { load: () => loadInvariants(), priority: 100, canTruncate: false },
  { load: () => loadDecisions(scopes), priority: 90, canTruncate: true },
  {
    load: () => loadMicroSummaries(sessionId),
    priority: 80,
    canTruncate: true,
  },
  { load: () => loadModuleMemory(module), priority: 70, canTruncate: true },
]);
```

## 10. Privacy and Security

### Sensitive Data Handling

```typescript
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /credential/i,
];

function sanitizeForMemory(content: string): string {
  let sanitized = content;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(
      new RegExp(`(${pattern.source})\\s*[:=]\\s*["']?[^"'\\s]+["']?`, 'gi'),
      '$1: [REDACTED]',
    );
  }

  return sanitized;
}
```

### Memory Encryption (Optional)

For sensitive projects, memory can be encrypted at rest:

```typescript
interface EncryptedMemory {
  version: number;
  algorithm: 'aes-256-gcm';
  iv: string;
  data: string;
  tag: string;
}
```
