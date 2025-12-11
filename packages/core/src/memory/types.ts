/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Memory system type definitions for Dial's hierarchical memory.
 *
 * Memory hierarchy:
 * - Round Memory: Ephemeral, per-round storage
 * - Session Memory: Task-scoped, archived after completion
 * - Project Memory: Persistent in .dial/ directory
 * - Global Memory: User-wide in ~/.dial/global/
 */

// ============================================================================
// Round Memory Types
// ============================================================================

/**
 * Patch specification for proposed code changes.
 */
export interface PatchSpec {
  file: string;
  description: string;
  type: 'create' | 'modify' | 'delete';
  hunks?: Array<{
    startLine: number;
    endLine: number;
    content: string;
  }>;
}

/**
 * Applied patch with additional metadata.
 */
export interface AppliedPatch extends PatchSpec {
  appliedAt: string;
  success: boolean;
  error?: string;
}

/**
 * Issue identified during critique.
 */
export interface CritiqueIssue {
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

/**
 * Resolution decision for a critique issue.
 */
export interface ResolutionDecision {
  issue: string;
  resolution: 'accepted' | 'rejected' | 'modified';
  reasoning: string;
}

/**
 * Test failure information.
 */
export interface TestFailure {
  testName: string;
  file: string;
  error: string;
  stackTrace?: string;
}

/**
 * Problem context for a round.
 */
export interface ProblemContext {
  description: string;
  constraints: string[];
  filesInvolved: string[];
}

/**
 * Thesis (proposer) data for a round.
 */
export interface ThesisData {
  summary: string;
  approach: string;
  patches: PatchSpec[];
  risks: string[];
  tokenUsage: number;
}

/**
 * Antithesis (critic) data for a round.
 */
export interface AntithesisData {
  overallAssessment: 'brief' | 'acceptable' | 'concerning' | 'critical';
  strengths: string[];
  issues: CritiqueIssue[];
  missingConsiderations: string[];
  tokenUsage: number;
}

/**
 * Synthesis (synthesizer) data for a round.
 */
export interface SynthesisData {
  resolutionSummary: string;
  decisions: ResolutionDecision[];
  finalPatches: AppliedPatch[];
  confidence: 'low' | 'medium' | 'high';
  tokenUsage: number;
}

/**
 * Verification data for a round.
 */
export interface VerificationData {
  testsRun: string[];
  passed: boolean;
  failures: TestFailure[];
  output: string;
}

/**
 * Complete round memory structure.
 */
export interface RoundMemoryData {
  taskId: string;
  round: number;
  timestamp: string;

  problem: ProblemContext;
  thesis: ThesisData;
  antithesis: AntithesisData;
  synthesis: SynthesisData;
  verification: VerificationData;

  outcome: 'success' | 'partial' | 'failed';
}

// ============================================================================
// Micro-Summary Types
// ============================================================================

/**
 * Compact summary of a single round.
 */
export interface MicroSummary {
  round: number;
  taskId: string;
  timestamp: string;

  keyDecision: string;
  keyFailure?: string;
  criticInsight?: string;
  patternDiscovered?: string;
  outcome: 'success' | 'partial' | 'failed';
}

// ============================================================================
// Session Memory Types
// ============================================================================

/**
 * Task information for a session.
 */
export interface TaskInfo {
  originalPrompt: string;
  interpretedGoal: string;
  filesTouched: string[];
  scope: string[];
}

/**
 * Execution metadata for a session.
 */
export interface ExecutionMetadata {
  mode: 'read_only' | 'simple' | 'dialectic_light' | 'dialectic_full';
  roundsExecuted: number;
  totalTokens: number;
  finalOutcome: 'success' | 'partial' | 'failed';
}

/**
 * Changes made during a session.
 */
export interface SessionChanges {
  patchesApplied: number;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
}

/**
 * Decision made during a session.
 */
export interface SessionDecision {
  scope: string;
  type: 'invariant' | 'pattern' | 'constraint' | 'trade_off';
  summary: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Pattern discovered during a session.
 */
export interface Pattern {
  name: string;
  description: string;
  example?: string;
  whenToUse: string;
}

/**
 * Anti-pattern encountered during a session.
 */
export interface AntiPattern {
  name: string;
  description: string;
  consequence: string;
  avoidance: string;
}

/**
 * Learnings from a session.
 */
export interface SessionLearnings {
  decisionsMade: SessionDecision[];
  patternsDiscovered: Pattern[];
  antiPatternsEncountered: AntiPattern[];
  openQuestions: string[];
}

/**
 * Complete session summary structure.
 */
export interface SessionSummaryData {
  sessionId: string;
  taskId: string;
  createdAt: string;
  completedAt: string;

  task: TaskInfo;
  execution: ExecutionMetadata;
  changes: SessionChanges;
  learnings: SessionLearnings;

  humanSummary: string;
}

// ============================================================================
// Project Memory Types
// ============================================================================

/**
 * Source information for a decision.
 */
export interface DecisionSource {
  sessionId: string;
  round?: number;
  date: string;
}

/**
 * Metadata for a decision.
 */
export interface DecisionMetadata {
  confidence: 'low' | 'medium' | 'high';
  timesReferenced: number;
  lastReferenced?: string;
}

/**
 * Project-level decision record.
 */
export interface Decision {
  id: string;
  scope: string;
  type: 'invariant' | 'pattern' | 'constraint' | 'anti_pattern' | 'heuristic';

  summary: string;
  reasoning: string;
  examples?: string[];

  source: DecisionSource;
  metadata: DecisionMetadata;
}

/**
 * Known issue in a module.
 */
export interface ModuleIssue {
  description: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}

/**
 * Recent change to a module.
 */
export interface RecentChange {
  sessionId: string;
  date: string;
  description: string;
  filesChanged: string[];
}

/**
 * Module-specific memory.
 */
export interface ModuleMemoryData {
  module: string;
  lastUpdated: string;

  description: string;
  keyFiles: string[];
  dependencies: string[];

  patterns: Pattern[];
  invariants: string[];
  commonIssues: ModuleIssue[];
  testCoverageNotes: string;

  recentChanges: RecentChange[];
}

// ============================================================================
// Global Memory Types
// ============================================================================

/**
 * User coding style preferences.
 */
export interface CodingStylePreferences {
  preferFunctional: boolean;
  preferExplicitTypes: boolean;
  maxFunctionLength: number;
  commentStyle: 'jsdoc' | 'inline' | 'minimal';
}

/**
 * User review preferences.
 */
export interface ReviewPreferences {
  strictSecurity: boolean;
  strictPerformance: boolean;
  preferSimplicity: boolean;
}

/**
 * User testing preferences.
 */
export interface TestingPreferences {
  alwaysAddTests: boolean;
  preferredFramework?: string;
  coverageThreshold?: number;
}

/**
 * User UI preferences.
 */
export interface UIPreferences {
  verbosity: 'minimal' | 'normal' | 'verbose';
  showReasoning: boolean;
  showAlternatives: boolean;
}

/**
 * Complete user preferences.
 */
export interface UserPreferences {
  codingStyle: CodingStylePreferences;
  reviewPreferences: ReviewPreferences;
  testingPreferences: TestingPreferences;
  uiPreferences: UIPreferences;
}

/**
 * Meta-rule for cross-project heuristics.
 */
export interface MetaRule {
  id: string;
  rule: string;
  appliesWhen: string;
  source: 'user' | 'learned';
}

/**
 * Learned pattern with success tracking.
 */
export interface LearnedPattern {
  pattern: string;
  successRate: number;
  timesApplied: number;
  lastApplied: string;
}

/**
 * Global heuristics data.
 */
export interface GlobalHeuristics {
  metaRules: MetaRule[];
  learnedPatterns: LearnedPattern[];
}

// ============================================================================
// Memory Loader Types
// ============================================================================

/**
 * Memory loader for budget management.
 */
export interface MemoryLoader {
  load(): Promise<string>;
  priority: number;
  canTruncate: boolean;
  name: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Memory system configuration.
 */
export interface MemoryConfig {
  /** Maximum tokens for memory context. */
  maxContextTokens: number;
  /** Whether to enable memory encryption. */
  encryptionEnabled: boolean;
  /** Stale decision threshold in days. */
  staleThresholdDays: number;
  /** Maximum recent sessions to keep in active memory. */
  maxRecentSessions: number;
  /** Whether to auto-compact sessions. */
  autoCompact: boolean;
}

/**
 * Default memory configuration.
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxContextTokens: 8000,
  encryptionEnabled: false,
  staleThresholdDays: 90,
  maxRecentSessions: 100,
  autoCompact: true,
};
