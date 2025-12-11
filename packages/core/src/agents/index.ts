/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  AgentRole,
  TaskDescription,
  FileContent,
  FailureInfo,
  TaskContext,
  ProposedPatch,
  ThesisOutput,
  ProposerContext,
  IssueSeverity,
  IssueCategory,
  OverallAssessment,
  CriticIssue,
  AntithesisOutput,
  CriticContext,
  ResolutionType,
  SynthesisDecision,
  FinalPatch,
  ConfidenceLevel,
  SynthesisOutput,
  SynthesizerContext,
  LessonType,
  LessonScope,
  LessonLearned,
  DecisionToRecord,
  MemoryUpdates,
  RoundOutcome,
  ReflectionOutput,
  ReflectorContext,
  TestResult,
  VerificationResult,
  RoundResult,
  TaskResult,
  AgentLLMConfig,
  AgentConfig,
  AgentsConfig,
  Agent,
  LLMAgent,
} from './types.js';

export { AGENT_DISPLAY_NAMES, DEFAULT_AGENT_CONFIGS } from './types.js';

// Base classes
export { BaseAgent, AgentOutputError } from './base-agent.js';
export type { ValidationResult as AgentValidationResult } from './base-agent.js';

// Prompts
export {
  PROPOSER_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
  SYNTHESIZER_SYSTEM_PROMPT,
  REFLECTOR_SYSTEM_PROMPT,
  getSystemPrompt,
} from './prompts.js';

// Agent implementations
export { ProposerAgent } from './proposer-agent.js';
export { CriticAgent } from './critic-agent.js';
export { SynthesizerAgent } from './synthesizer-agent.js';
export { ReflectorAgent } from './reflector-agent.js';
