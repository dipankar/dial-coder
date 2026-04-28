/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm/llm-client.js';
import type { Decision, Pattern } from '../memory/types.js';

/**
 * Agent role types in the dialectic system.
 */
export type AgentRole = 'proposer' | 'critic' | 'synthesizer' | 'reflector';

/**
 * User-facing agent names (for display).
 */
export const AGENT_DISPLAY_NAMES: Record<AgentRole, string> = {
  proposer: 'Planner',
  critic: 'Reviewer',
  synthesizer: 'Resolver',
  reflector: 'Learner',
};

// ============================================================================
// Task Context Types
// ============================================================================

/**
 * Task description for agents.
 */
export interface TaskDescription {
  id: string;
  description: string;
  originalPrompt: string;
  constraints?: string[];
  testCommand?: string;
}

/**
 * File content with path.
 */
export interface FileContent {
  path: string;
  content: string;
  language?: string;
}

/**
 * Previous failure information.
 */
export interface FailureInfo {
  round: number;
  testOutput: string;
  failingTests: string[];
  analysis: string;
}

/**
 * Full task context for agents.
 */
export interface TaskContext {
  task: TaskDescription;
  sessionId: string;
  round: number;
  relevantFiles: FileContent[];
  failures?: FailureInfo[];
  hints?: string[];
}

// ============================================================================
// Proposer (Thesis) Types
// ============================================================================

/**
 * Patch specification from proposer.
 */
export interface ProposedPatch {
  file: string;
  action: 'edit' | 'create' | 'delete';
  location?: string;
  description: string;
  code?: string;
}

/**
 * Proposer output (thesis).
 */
export interface ThesisOutput {
  analysis: string;
  approach: string;
  plan: string[];
  patches: ProposedPatch[];
  risks: string[];
  /** Confidence score 0-1 (1 = highly confident) */
  confidence?: number;
}

/**
 * Proposer context.
 */
export interface ProposerContext extends TaskContext {
  projectDecisions: Decision[];
  sessionHistory: Array<{
    round: number;
    keyDecision: string;
    outcome: string;
  }>;
  previousFailures?: FailureInfo[];
}

// ============================================================================
// Critic (Antithesis) Types
// ============================================================================

/**
 * Issue severity levels.
 */
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Issue categories.
 */
export type IssueCategory =
  | 'correctness'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'edge_case';

/**
 * Overall assessment levels.
 */
export type OverallAssessment =
  | 'brief'
  | 'acceptable'
  | 'concerning'
  | 'critical';

/**
 * Issue found by critic.
 */
export interface CriticIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  location: string;
  suggestion: string;
}

/**
 * Critic output (antithesis).
 */
export interface AntithesisOutput {
  overallAssessment: OverallAssessment;
  strengths: string[];
  issues: CriticIssue[];
  missingConsiderations: string[];
  questions: string[];
  /** Confidence score 0-1 (1 = highly confident in assessment) */
  confidence?: number;
}

/**
 * Critic context.
 */
export interface CriticContext extends TaskContext {
  thesis: ThesisOutput;
  projectDecisions: Decision[];
  failurePatterns: Decision[];
  userPreferences?: {
    strictSecurity?: boolean;
    strictPerformance?: boolean;
    preferSimplicity?: boolean;
  };
}

// ============================================================================
// Synthesizer (Synthesis) Types
// ============================================================================

/**
 * Resolution type for each issue.
 */
export type ResolutionType = 'accepted' | 'rejected' | 'modified';

/**
 * Decision on a specific issue.
 */
export interface SynthesisDecision {
  issue: string;
  resolution: ResolutionType;
  reasoning: string;
}

/**
 * Final patch to apply.
 */
export interface FinalPatch {
  file: string;
  action: 'edit' | 'create' | 'delete';
  search?: string;
  replace?: string;
  content?: string;
  description: string;
}

/**
 * Confidence level.
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Synthesizer output (synthesis).
 */
export interface SynthesisOutput {
  resolutionSummary: string;
  decisions: SynthesisDecision[];
  finalPlan: string[];
  patches: FinalPatch[];
  testsToRun: string[];
  confidence: ConfidenceLevel;
}

/**
 * Synthesizer context.
 */
export interface SynthesizerContext extends TaskContext {
  thesis: ThesisOutput;
  antithesis: AntithesisOutput;
  projectInvariants: string[];
  codePatterns: Pattern[];
  testResults?: VerificationResult;
}

// ============================================================================
// Reflector Types
// ============================================================================

/**
 * Lesson type.
 */
export type LessonType = 'pattern' | 'anti_pattern' | 'invariant' | 'heuristic';

/**
 * Lesson scope.
 */
export type LessonScope = 'project' | 'module' | 'file';

/**
 * Lesson learned from a round.
 */
export interface LessonLearned {
  type: LessonType;
  scope: LessonScope;
  description: string;
  appliesTo: string[];
}

/**
 * Decision to record.
 */
export interface DecisionToRecord {
  scope: string;
  type: 'invariant' | 'pattern' | 'constraint';
  summary: string;
  reasoning: string;
}

/**
 * Memory update instructions.
 */
export interface MemoryUpdates {
  addToArchitecture?: string;
  addToDecisions: boolean;
}

/**
 * Round outcome.
 */
export type RoundOutcome = 'success' | 'partial' | 'failed';

/**
 * Reflector output.
 */
export interface ReflectionOutput {
  roundOutcome: RoundOutcome;
  lessonsLearned: LessonLearned[];
  decisionsToRecord: DecisionToRecord[];
  improvementsForNextRound: string[];
  memoryUpdates: MemoryUpdates;
}

/**
 * Reflector context.
 */
export interface ReflectorContext {
  task: TaskDescription;
  sessionId: string;
  allRounds: RoundResult[];
  finalOutcome: RoundOutcome;
  existingDecisions: Decision[];
  existingPatterns: Pattern[];
}

// ============================================================================
// Verification Types
// ============================================================================

/**
 * Test result.
 */
export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

/**
 * Verification result.
 */
export interface VerificationResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  failingTests: string[];
  output: string;
  duration: number;
}

// ============================================================================
// Round Result Types
// ============================================================================

/**
 * Complete round result.
 */
export interface RoundResult {
  round: number;
  thesis: ThesisOutput;
  antithesis: AntithesisOutput;
  synthesis: SynthesisOutput;
  verification: VerificationResult;
  outcome: RoundOutcome;
  reflection?: ReflectionOutput;
}

/**
 * Task result.
 */
export interface TaskResult {
  success: boolean;
  rounds: number;
  patches: FinalPatch[];
  summary: string;
  sessionId: string;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

/**
 * Agent LLM configuration.
 */
export interface AgentLLMConfig {
  llm: string;
  temperature: number;
  responseFormat: 'json' | 'text';
  maxTokens?: number;
}

/**
 * Agent configuration.
 */
export interface AgentConfig {
  role: AgentRole;
  llmConfig: AgentLLMConfig;
  systemPrompt: string;
}

/**
 * Full agents configuration.
 */
export interface AgentsConfig {
  proposer: AgentLLMConfig;
  critic: AgentLLMConfig;
  synthesizer: AgentLLMConfig;
  reflector: AgentLLMConfig;
}

/**
 * Default agent configurations.
 */
export const DEFAULT_AGENT_CONFIGS: AgentsConfig = {
  proposer: {
    llm: 'default',
    temperature: 0.7,
    responseFormat: 'json',
  },
  critic: {
    llm: 'default',
    temperature: 0.3,
    responseFormat: 'json',
  },
  synthesizer: {
    llm: 'default',
    temperature: 0.2,
    responseFormat: 'json',
  },
  reflector: {
    llm: 'fast',
    temperature: 0.5,
    responseFormat: 'json',
  },
};

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Base agent interface.
 */
export interface Agent<TContext, TOutput> {
  readonly role: AgentRole;
  readonly displayName: string;

  generate(context: TContext): Promise<TOutput>;
}

/**
 * Agent with LLM client.
 */
export interface LLMAgent<TContext, TOutput> extends Agent<TContext, TOutput> {
  setLLMClient(client: LLMClient): void;
}
