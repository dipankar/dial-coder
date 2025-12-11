# Mode Switching System

This document defines Dial's automatic mode selection system that adapts execution strategy based on task characteristics.

> **Terminology Note**: This document uses internal design terminology. See `08-terminology-mapping.md` for user-facing equivalents.

## 1. Execution Modes

### Mode Naming: Internal vs External

| Internal (Code)   | External (CLI) | User Description                   |
| ----------------- | -------------- | ---------------------------------- |
| `read_only`       | `ask`          | "Answer questions without changes" |
| `simple`          | `quick`        | "Fast execution for simple tasks"  |
| `dialectic_light` | `review`       | "Includes review before applying"  |
| `dialectic_full`  | `safe`         | "Multi-stage review with testing"  |

### Mode Overview (Internal Names)

```
┌─────────────────────────────────────────────────────────────────┐
│          EXECUTION MODES (Internal → External)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  read_only (ask)    simple (quick)    dialectic_light (review) │
│  ──────────────     ──────────────    ────────────────────────  │
│  Information        Single-pass       One review cycle          │
│  retrieval only     fast execution    with validation           │
│                                                                 │
│  • No edits         • Minimal         • Plan → Review           │
│  • No tools           changes           → Resolve               │
│  • Fast response    • Single agent    • Light validation        │
│                     • No review       • Quick tests             │
│                                                                 │
│  Cost: $            Cost: $           Cost: $$                  │
│  Time: Fast         Time: Fast        Time: Medium              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  dialectic_full (safe)                                          │
│  ────────────────────                                           │
│  Multi-cycle review with comprehensive testing                  │
│                                                                 │
│  • Up to 3 review cycles                                        │
│  • Full test suite execution                                    │
│  • Learning and memory updates                                  │
│  • Multi-model option                                           │
│                                                                 │
│  Cost: $$$                                                      │
│  Time: Slow                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### CLI Usage (User-Facing)

```bash
# User-facing mode names
dial --mode ask "Explain how auth works"
dial --mode quick "Fix the typo in README"
dial --mode review "Fix the failing test"
dial --mode safe "Refactor the auth module"
dial --mode auto "Do something"  # default
```

## 2. Mode Characteristics

### 2.1 Read-Only Mode

**Purpose**: Answer questions without modifying anything.

**Triggers**:

- Explanation requests ("explain", "what does", "how does")
- Summary requests ("summarize", "overview")
- Information lookup ("find", "search", "list")

**Behavior**:

- Read files, search code
- No write/edit tools enabled
- No shell commands (except safe ones like `ls`)
- Single LLM call typically sufficient

**Example Tasks**:

```
"Explain how authentication works in this project"
"What does the validateToken function do?"
"List all API endpoints"
"How is the database schema organized?"
```

### 2.2 Simple Mode

**Purpose**: Fast, single-pass execution for straightforward tasks.

**Triggers**:

- Small, localized changes
- Clear, unambiguous instructions
- Low-risk file modifications
- Tasks affecting ≤2 files

**Behavior**:

- Standard ReAct loop (like current Qwen Code)
- Single agent, no dialectic
- Optional quick test run
- No memory updates

**Example Tasks**:

```
"Fix the typo in README.md"
"Add a comment to the calculateTotal function"
"Rename the variable 'tmp' to 'tempResult'"
"Update the version number to 2.0.0"
```

### 2.3 Dialectic Light Mode

**Purpose**: Single round of structured review for moderate-risk changes.

**Triggers**:

- Bug fixes with test failures
- Small feature additions
- Refactoring affecting 3-5 files
- Changes to non-critical paths

**Behavior**:

- One dialectic round: Proposer → Critic → Synthesizer
- Test execution after synthesis
- Basic reflection (no deep memory update)
- ~3x token usage vs Simple

**Example Tasks**:

```
"Fix the failing test in auth.test.ts"
"Add input validation to the user registration endpoint"
"Refactor the helper functions into a separate utility file"
```

### 2.4 Dialectic Full Mode

**Purpose**: Comprehensive multi-round dialectic for complex/risky changes.

**Triggers**:

- Large refactoring
- Security-sensitive changes
- Database migrations
- New feature development
- Changes to critical paths

**Behavior**:

- Up to 3 dialectic rounds
- Full test suite execution
- Reflector agent extracts lessons
- Memory updates (decisions, patterns)
- ~10x token usage vs Simple

**Example Tasks**:

```
"Refactor the authentication module to use JWT"
"Add rate limiting to all API endpoints"
"Implement the new billing system"
"Migrate from MySQL to PostgreSQL"
```

## 3. Mode Selection Algorithm

### 3.1 Decision Flow

```
                        ┌─────────────────┐
                        │ Analyze Prompt  │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │ Is it a question/lookup? │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
            YES     │                          │  NO
         ┌──────────┴──────────┐               │
         │                     │               │
         ▼                     │               ▼
   ┌───────────┐               │    ┌─────────────────────┐
   │ READ_ONLY │               │    │ Analyze Task Scope  │
   └───────────┘               │    └──────────┬──────────┘
                               │               │
                               │    ┌──────────┴──────────┐
                               │    │  Files affected?    │
                               │    └──────────┬──────────┘
                               │               │
                               │    ┌──────────┼──────────┐
                               │    │ ≤2       │ 3-5      │ >5
                               │    │          │          │
                               │    ▼          ▼          ▼
                               │  SIMPLE   DIA_LIGHT   DIA_FULL
                               │
                               │    ┌─────────────────────┐
                               └───►│ Check Critical Path │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │ Touches critical?   │
                                    └──────────┬──────────┘
                                               │
                              YES              │              NO
                           ┌───────────────────┴───────────────┐
                           │                                   │
                           ▼                                   ▼
                      DIA_FULL                          (keep current)
```

### 3.2 Implementation

```typescript
// packages/core/src/orchestrator/mode-selector.ts

export type ExecutionMode =
  | 'read_only'
  | 'simple'
  | 'dialectic_light'
  | 'dialectic_full';

export interface ModeSelectionContext {
  prompt: string;
  repoContext: RepoContext;
  estimatedFiles?: string[];
  userOverride?: ExecutionMode;
  tokenBudget?: number;
}

export interface ModeSelector {
  selectMode(context: ModeSelectionContext): Promise<ExecutionMode>;
}

export class RuleBasedModeSelector implements ModeSelector {
  private readonly criticalPaths: string[];

  constructor(config: { criticalPaths?: string[] } = {}) {
    this.criticalPaths = config.criticalPaths || [
      'auth',
      'security',
      'billing',
      'payment',
      'migration',
      'database',
      'db',
      'infra',
    ];
  }

  async selectMode(context: ModeSelectionContext): Promise<ExecutionMode> {
    // 1. User override takes precedence
    if (context.userOverride) {
      return context.userOverride;
    }

    // 2. Check for read-only patterns
    if (this.isReadOnlyTask(context.prompt)) {
      return 'read_only';
    }

    // 3. Analyze task complexity
    const analysis = await this.analyzeTask(context);

    // 4. Check critical paths
    if (this.touchesCriticalPath(analysis.estimatedFiles)) {
      return 'dialectic_full';
    }

    // 5. Check scope
    if (analysis.estimatedFiles.length <= 2 && analysis.complexity === 'low') {
      return 'simple';
    }

    if (analysis.estimatedFiles.length <= 5 && analysis.complexity !== 'high') {
      return 'dialectic_light';
    }

    return 'dialectic_full';
  }

  private isReadOnlyTask(prompt: string): boolean {
    const readOnlyPatterns = [
      /\b(explain|what does|how does|what is|describe)\b/i,
      /\b(summar(y|ize|ise)|overview|list all)\b/i,
      /\b(find|search|locate|where is|show me)\b/i,
      /\b(understand|learn about|tell me about)\b/i,
    ];

    return readOnlyPatterns.some((p) => p.test(prompt));
  }

  private async analyzeTask(
    context: ModeSelectionContext,
  ): Promise<TaskAnalysis> {
    // Pattern-based analysis
    const complexity = this.estimateComplexity(context.prompt);
    const estimatedFiles =
      context.estimatedFiles || this.estimateFiles(context.prompt);
    const taskType = this.classifyTaskType(context.prompt);

    return { complexity, estimatedFiles, taskType };
  }

  private estimateComplexity(prompt: string): 'low' | 'medium' | 'high' {
    const highComplexityPatterns = [
      /\b(refactor|rewrite|migrate|redesign)\b/i,
      /\b(implement|create|build).*(feature|system|module)\b/i,
      /\b(security|authentication|authorization)\b/i,
      /\b(performance|optimize|scale)\b/i,
    ];

    const lowComplexityPatterns = [
      /\b(fix typo|add comment|rename|update version)\b/i,
      /\b(small|quick|simple|minor)\b/i,
    ];

    if (highComplexityPatterns.some((p) => p.test(prompt))) {
      return 'high';
    }

    if (lowComplexityPatterns.some((p) => p.test(prompt))) {
      return 'low';
    }

    return 'medium';
  }

  private classifyTaskType(prompt: string): TaskType {
    const patterns: Record<TaskType, RegExp[]> = {
      bug_fix: [/\b(fix|bug|error|failing|broken)\b/i],
      feature: [/\b(add|implement|create|new feature)\b/i],
      refactor: [/\b(refactor|restructure|reorganize|clean up)\b/i],
      docs: [/\b(document|readme|comment|explain)\b/i],
      test: [/\b(test|spec|coverage)\b/i],
      config: [/\b(config|setting|environment)\b/i],
    };

    for (const [type, pats] of Object.entries(patterns)) {
      if (pats.some((p) => p.test(prompt))) {
        return type as TaskType;
      }
    }

    return 'other';
  }

  private touchesCriticalPath(files: string[]): boolean {
    return files.some((file) =>
      this.criticalPaths.some((critical) =>
        file.toLowerCase().includes(critical),
      ),
    );
  }

  private estimateFiles(prompt: string): string[] {
    // Extract file/module mentions from prompt
    const filePatterns = [
      /\b(\w+\.(ts|js|tsx|jsx|py|go|rs))\b/gi,
      /\b(src\/\S+)\b/gi,
      /\b(\w+)\s+(module|component|service|controller)\b/gi,
    ];

    const files = new Set<string>();
    for (const pattern of filePatterns) {
      const matches = prompt.match(pattern) || [];
      matches.forEach((m) => files.add(m));
    }

    return Array.from(files);
  }
}

type TaskType =
  | 'bug_fix'
  | 'feature'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'config'
  | 'other';

interface TaskAnalysis {
  complexity: 'low' | 'medium' | 'high';
  estimatedFiles: string[];
  taskType: TaskType;
}
```

### 3.3 LLM-Enhanced Mode Selection

For more sophisticated selection, an LLM can be used:

```typescript
export class LLMEnhancedModeSelector implements ModeSelector {
  private readonly llm: LLMClient;
  private readonly fallback: RuleBasedModeSelector;

  constructor(llm: LLMClient) {
    this.llm = llm;
    this.fallback = new RuleBasedModeSelector();
  }

  async selectMode(context: ModeSelectionContext): Promise<ExecutionMode> {
    // Use rule-based for obvious cases
    const ruleBasedMode = await this.fallback.selectMode(context);
    if (ruleBasedMode === 'read_only') {
      return 'read_only';
    }

    // For ambiguous cases, ask the LLM
    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: MODE_SELECTION_PROMPT },
          { role: 'user', content: this.buildPrompt(context) },
        ],
        responseFormat: 'json',
        maxTokens: 200,
      });

      const result = JSON.parse(response.content);
      return this.validateMode(result.mode);
    } catch {
      return ruleBasedMode;
    }
  }

  private buildPrompt(context: ModeSelectionContext): string {
    return `
Analyze this task and select the appropriate execution mode.

Task: "${context.prompt}"

Repository info:
- Language: ${context.repoContext.primaryLanguage}
- Size: ${context.repoContext.fileCount} files
- Has tests: ${context.repoContext.hasTests}

Critical paths in this project:
${context.repoContext.criticalPaths?.join(', ') || 'None specified'}

Respond with JSON: { "mode": "simple" | "dialectic_light" | "dialectic_full", "reasoning": "..." }
`;
  }
}

const MODE_SELECTION_PROMPT = `
You are a task analyzer for a coding assistant. Your job is to select the appropriate execution mode.

MODES:
- simple: For trivial changes (typos, comments, renames, <3 files)
- dialectic_light: For moderate changes (bug fixes, small features, 3-5 files)
- dialectic_full: For complex changes (refactoring, security, migrations, >5 files, critical paths)

RULES:
1. If the task mentions security, auth, billing, or migrations → dialectic_full
2. If the task is a simple fix or update to 1-2 files → simple
3. If unclear, prefer dialectic_light for safety
4. Consider the user's explicit risk tolerance if mentioned

Output JSON only.
`;
```

## 4. Mode Configuration

### 4.1 User Configuration

```json
// ~/.dial/config.json
{
  "modes": {
    "default": "auto",
    "preferences": {
      "prefer_thorough": false,
      "prefer_fast": true,
      "token_budget": 100000
    },
    "overrides": {
      "test_files": "simple",
      "documentation": "simple",
      "migrations": "dialectic_full"
    }
  }
}
```

### 4.2 Project Configuration

```json
// .dial/config.json
{
  "modes": {
    "critical_paths": ["src/auth/", "src/billing/", "database/migrations/"],
    "always_dialectic": ["*.migration.ts", "**/security/**"],
    "always_simple": ["*.md", "*.json"]
  }
}
```

## 5. Mode Escalation

Modes can escalate during execution:

```typescript
class ModeEscalator {
  async checkEscalation(
    currentMode: ExecutionMode,
    context: ExecutionContext,
  ): Promise<ExecutionMode> {
    // Never escalate from full
    if (currentMode === 'dialectic_full') {
      return currentMode;
    }

    // Check for escalation triggers
    const triggers = await this.detectEscalationTriggers(context);

    if (triggers.touchesCriticalPath) {
      console.log('Escalating: Task touches critical path');
      return 'dialectic_full';
    }

    if (triggers.moreFilesThanExpected && currentMode === 'simple') {
      console.log('Escalating: More files affected than expected');
      return 'dialectic_light';
    }

    if (triggers.testFailuresDetected && currentMode === 'dialectic_light') {
      console.log('Escalating: Test failures require more rounds');
      return 'dialectic_full';
    }

    return currentMode;
  }

  private async detectEscalationTriggers(
    context: ExecutionContext,
  ): Promise<EscalationTriggers> {
    return {
      touchesCriticalPath: this.checkCriticalPaths(context.filesTouched),
      moreFilesThanExpected:
        context.filesTouched.length > context.expectedFiles * 1.5,
      testFailuresDetected: context.testResults?.failureCount > 0,
      securityConcernsRaised: this.detectSecurityConcerns(context.agentOutputs),
    };
  }
}
```

## 6. Mode De-escalation

In some cases, modes can be de-escalated to save resources:

```typescript
class ModeDeescalator {
  async checkDeescalation(
    currentMode: ExecutionMode,
    context: ExecutionContext,
  ): Promise<ExecutionMode> {
    // Never de-escalate from simple
    if (currentMode === 'simple') {
      return currentMode;
    }

    // Check for de-escalation opportunities
    if (currentMode === 'dialectic_light') {
      // If critic found no issues, could have been simple
      if (context.criticOutput?.issues.length === 0) {
        // Don't actually de-escalate mid-task, but log for learning
        this.logPotentialDeescalation('dialectic_light', 'simple', context);
      }
    }

    // Dialectic full → light if early rounds succeed easily
    if (currentMode === 'dialectic_full' && context.round === 1) {
      if (
        context.testsPass &&
        context.criticOutput?.overall_assessment === 'brief'
      ) {
        console.log('Note: This task might not need full dialectic mode');
        // Could offer user to continue in light mode
      }
    }

    return currentMode;
  }
}
```

## 7. CLI Mode Interface

### 7.1 Mode Display

```
$ dial "Fix the pagination bug"

[Auto-selected mode: dialectic_light]
  Reason: Bug fix affecting 3 files

Would you like to:
  [Enter] Continue with dialectic_light
  [s]     Switch to simple (faster, less thorough)
  [f]     Switch to full (slower, more thorough)

> _
```

### 7.2 Mode Override Commands

```bash
# Force specific mode
dial --mode simple "Fix the typo"
dial --mode full "Refactor auth"

# Interactive mode
dial --mode auto "Fix something"  # Default

# During session
/mode simple     # Switch to simple
/mode full       # Switch to full
/mode auto       # Return to auto-selection
```

### 7.3 Mode Status Display

```
$ dial "Add user validation"

[Mode: dialectic_light] [Round 1/1] [Budget: 42k/100k tokens]

── Proposer ───────────────────────────────────────────────────
Analyzing validation requirements...
...
```

## 8. Mode Analytics

Track mode usage for optimization:

```typescript
interface ModeUsageRecord {
  sessionId: string;
  timestamp: string;
  selectedMode: ExecutionMode;
  selectionReason: string;
  actualFilesTouched: number;
  tokensUsed: number;
  outcome: 'success' | 'partial' | 'failed';
  wasEscalated: boolean;
  couldHaveDeescalated: boolean;
}

class ModeAnalytics {
  async recordUsage(record: ModeUsageRecord): Promise<void> {
    await fs.appendFile(
      '~/.dial/analytics/mode_usage.jsonl',
      JSON.stringify(record) + '\n',
    );
  }

  async getRecommendations(): Promise<ModeRecommendation[]> {
    const usage = await this.loadUsage();

    // Analyze patterns
    const recommendations: ModeRecommendation[] = [];

    // Check if user often escalates from simple
    const simpleEscalations = usage.filter(
      (u) => u.selectedMode === 'simple' && u.wasEscalated,
    );
    if (simpleEscalations.length > 5) {
      recommendations.push({
        type: 'config_change',
        message: 'Consider setting default mode to dialectic_light',
        reason: `${simpleEscalations.length} recent tasks escalated from simple mode`,
      });
    }

    return recommendations;
  }
}
```

## 9. Testing Mode Selection

```typescript
// Test cases for mode selector
describe('ModeSelector', () => {
  const selector = new RuleBasedModeSelector();

  describe('read_only detection', () => {
    test.each([
      'Explain how authentication works',
      'What does the validateToken function do?',
      'List all API endpoints',
      'How is the database schema organized?',
    ])('selects read_only for: %s', async (prompt) => {
      const mode = await selector.selectMode({
        prompt,
        repoContext: {} as any,
      });
      expect(mode).toBe('read_only');
    });
  });

  describe('simple detection', () => {
    test.each([
      'Fix the typo in README.md',
      'Add a comment to calculateTotal',
      'Rename tmp to tempResult',
    ])('selects simple for: %s', async (prompt) => {
      const mode = await selector.selectMode({
        prompt,
        repoContext: {} as any,
      });
      expect(mode).toBe('simple');
    });
  });

  describe('critical path escalation', () => {
    test('escalates to full for auth changes', async () => {
      const mode = await selector.selectMode({
        prompt: 'Update the login function',
        repoContext: {} as any,
        estimatedFiles: ['src/auth/login.ts'],
      });
      expect(mode).toBe('dialectic_full');
    });
  });
});
```

## 10. Future Enhancements

### 10.1 Learned Mode Selection

Use historical data to improve selection:

```typescript
class LearnedModeSelector implements ModeSelector {
  // Train on past sessions to predict optimal mode
  // Features: prompt embedding, file patterns, project type
  // Label: actual mode that succeeded
}
```

### 10.2 Cost-Aware Selection

Factor in token costs:

```typescript
class CostAwareModeSelector implements ModeSelector {
  // Consider remaining budget
  // Estimate cost of each mode
  // Balance quality vs cost
}
```

### 10.3 Team Mode Policies

Allow team-wide mode policies:

```typescript
interface TeamModePolicy {
  requireFullForPaths: string[];
  requireReviewerApproval: boolean;
  maxAutoEscalations: number;
}
```
