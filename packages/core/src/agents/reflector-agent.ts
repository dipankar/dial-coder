/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent, isNonEmptyString, isArray, isOneOf } from './base-agent.js';
import type { ValidationResult } from './base-agent.js';
import { REFLECTOR_SYSTEM_PROMPT } from './prompts.js';
import type {
  ReflectorContext,
  ReflectionOutput,
  LessonLearned,
  DecisionToRecord,
  AgentLLMConfig,
  LessonType,
  LessonScope,
  RoundOutcome,
} from './types.js';
import { AGENT_DISPLAY_NAMES } from './types.js';

const VALID_LESSON_TYPES: readonly LessonType[] = [
  'pattern',
  'anti_pattern',
  'invariant',
  'heuristic',
];
const VALID_LESSON_SCOPES: readonly LessonScope[] = [
  'project',
  'module',
  'file',
];
const VALID_OUTCOMES: readonly RoundOutcome[] = [
  'success',
  'partial',
  'failed',
];
const VALID_DECISION_TYPES: readonly string[] = [
  'invariant',
  'pattern',
  'constraint',
];

/**
 * Reflector agent (Learning extractor).
 *
 * Responsible for:
 * - Extracting lessons from completed rounds
 * - Identifying patterns and anti-patterns
 * - Suggesting memory updates
 */
export class ReflectorAgent extends BaseAgent<
  ReflectorContext,
  ReflectionOutput
> {
  readonly role = 'reflector' as const;
  readonly displayName = AGENT_DISPLAY_NAMES.reflector;

  constructor(config: AgentLLMConfig) {
    super(config, REFLECTOR_SYSTEM_PROMPT);
  }

  /**
   * Format the reflector context for the LLM.
   */
  protected formatContext(context: ReflectorContext): string {
    const sections: string[] = [];

    // Task description
    sections.push('## Task');
    sections.push(`ID: ${context.task.id}`);
    sections.push(`Description: ${context.task.description}`);
    sections.push(`Final Outcome: ${context.finalOutcome}`);

    // Session info
    sections.push('\n## Session');
    sections.push(`Session ID: ${context.sessionId}`);
    sections.push(`Total Rounds: ${context.allRounds.length}`);

    // Round summaries
    sections.push('\n## Round Summaries');
    for (const round of context.allRounds) {
      sections.push(`\n### Round ${round.round}`);
      sections.push(`Outcome: ${round.outcome}`);

      // Thesis summary
      sections.push('\n**Thesis (Proposal)**');
      sections.push(`Approach: ${round.thesis.approach}`);
      sections.push(`Risks identified: ${round.thesis.risks.length}`);

      // Antithesis summary
      sections.push('\n**Antithesis (Critique)**');
      sections.push(`Assessment: ${round.antithesis.overallAssessment}`);
      sections.push(`Issues found: ${round.antithesis.issues.length}`);
      const criticalIssues = round.antithesis.issues.filter(
        (i) => i.severity === 'critical' || i.severity === 'high',
      );
      if (criticalIssues.length > 0) {
        sections.push('Critical/High issues:');
        for (const issue of criticalIssues) {
          sections.push(`- [${issue.severity}] ${issue.description}`);
        }
      }

      // Synthesis summary
      sections.push('\n**Synthesis (Resolution)**');
      sections.push(`Confidence: ${round.synthesis.confidence}`);
      sections.push(`Decisions made: ${round.synthesis.decisions.length}`);
      sections.push(`Patches: ${round.synthesis.patches.length}`);

      // Verification summary
      sections.push('\n**Verification**');
      sections.push(`Success: ${round.verification.success}`);
      sections.push(
        `Tests: ${round.verification.testsPassed}/${round.verification.testsRun} passed`,
      );
      if (round.verification.failingTests.length > 0) {
        sections.push('Failing tests:');
        for (const test of round.verification.failingTests.slice(0, 5)) {
          sections.push(`- ${test}`);
        }
      }
    }

    // Existing decisions (to avoid duplicates)
    if (context.existingDecisions.length > 0) {
      sections.push('\n## Existing Project Decisions');
      sections.push('(Do not duplicate these)');
      for (const decision of context.existingDecisions.slice(0, 20)) {
        sections.push(`- [${decision.scope}] ${decision.summary}`);
      }
    }

    // Existing patterns
    if (context.existingPatterns.length > 0) {
      sections.push('\n## Existing Patterns');
      sections.push('(Do not duplicate these)');
      for (const pattern of context.existingPatterns.slice(0, 10)) {
        sections.push(`- ${pattern.name}: ${pattern.description}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Validate the reflection output.
   */
  protected validateOutput(output: ReflectionOutput): ValidationResult {
    const errors: string[] = [];

    // Validate round outcome
    if (!isOneOf(output.roundOutcome, VALID_OUTCOMES)) {
      errors.push(`roundOutcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }

    // Validate lessons learned array
    if (!isArray(output.lessonsLearned)) {
      errors.push('lessonsLearned must be an array');
    } else {
      for (let i = 0; i < output.lessonsLearned.length; i++) {
        const lessonErrors = this.validateLesson(output.lessonsLearned[i], i);
        errors.push(...lessonErrors);
      }
    }

    // Validate decisions to record array
    if (!isArray(output.decisionsToRecord)) {
      errors.push('decisionsToRecord must be an array');
    } else {
      for (let i = 0; i < output.decisionsToRecord.length; i++) {
        const decisionErrors = this.validateDecisionToRecord(
          output.decisionsToRecord[i],
          i,
        );
        errors.push(...decisionErrors);
      }
    }

    // Validate improvements array
    if (!isArray(output.improvementsForNextRound)) {
      errors.push('improvementsForNextRound must be an array');
    } else {
      for (let i = 0; i < output.improvementsForNextRound.length; i++) {
        if (!isNonEmptyString(output.improvementsForNextRound[i])) {
          errors.push(
            `improvementsForNextRound[${i}] must be a non-empty string`,
          );
        }
      }
    }

    // Validate memory updates
    if (!output.memoryUpdates || typeof output.memoryUpdates !== 'object') {
      errors.push('memoryUpdates must be an object');
    } else {
      if (typeof output.memoryUpdates.addToDecisions !== 'boolean') {
        errors.push('memoryUpdates.addToDecisions must be a boolean');
      }
      // addToArchitecture is optional string
      if (
        output.memoryUpdates.addToArchitecture !== undefined &&
        typeof output.memoryUpdates.addToArchitecture !== 'string'
      ) {
        errors.push(
          'memoryUpdates.addToArchitecture must be a string if provided',
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single lesson.
   */
  private validateLesson(lesson: LessonLearned, index: number): string[] {
    const errors: string[] = [];
    const prefix = `lessonsLearned[${index}]`;

    if (!isOneOf(lesson.type, VALID_LESSON_TYPES)) {
      errors.push(
        `${prefix}.type must be one of: ${VALID_LESSON_TYPES.join(', ')}`,
      );
    }

    if (!isOneOf(lesson.scope, VALID_LESSON_SCOPES)) {
      errors.push(
        `${prefix}.scope must be one of: ${VALID_LESSON_SCOPES.join(', ')}`,
      );
    }

    if (!isNonEmptyString(lesson.description)) {
      errors.push(`${prefix}.description must be a non-empty string`);
    }

    if (!isArray(lesson.appliesTo)) {
      errors.push(`${prefix}.appliesTo must be an array`);
    }

    return errors;
  }

  /**
   * Validate a decision to record.
   */
  private validateDecisionToRecord(
    decision: DecisionToRecord,
    index: number,
  ): string[] {
    const errors: string[] = [];
    const prefix = `decisionsToRecord[${index}]`;

    if (!isNonEmptyString(decision.scope)) {
      errors.push(`${prefix}.scope must be a non-empty string`);
    }

    if (!VALID_DECISION_TYPES.includes(decision.type)) {
      errors.push(
        `${prefix}.type must be one of: ${VALID_DECISION_TYPES.join(', ')}`,
      );
    }

    if (!isNonEmptyString(decision.summary)) {
      errors.push(`${prefix}.summary must be a non-empty string`);
    }

    if (!isNonEmptyString(decision.reasoning)) {
      errors.push(`${prefix}.reasoning must be a non-empty string`);
    }

    return errors;
  }
}
