/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent, isNonEmptyString, isArray } from './base-agent.js';
import type { ValidationResult } from './base-agent.js';
import { PROPOSER_SYSTEM_PROMPT } from './prompts.js';
import type {
  ProposerContext,
  ThesisOutput,
  ProposedPatch,
  AgentLLMConfig,
} from './types.js';
import { AGENT_DISPLAY_NAMES } from './types.js';

/**
 * Proposer agent (Thesis generator).
 *
 * Responsible for:
 * - Analyzing the task and context
 * - Generating concrete plans and code patches
 * - Identifying potential risks
 */
export class ProposerAgent extends BaseAgent<ProposerContext, ThesisOutput> {
  readonly role = 'proposer' as const;
  readonly displayName = AGENT_DISPLAY_NAMES.proposer;

  constructor(config: AgentLLMConfig) {
    super(config, PROPOSER_SYSTEM_PROMPT);
  }

  /**
   * Format the proposer context for the LLM.
   */
  protected formatContext(context: ProposerContext): string {
    const sections: string[] = [];

    // Task description
    sections.push('## Task');
    sections.push(`ID: ${context.task.id}`);
    sections.push(`Description: ${context.task.description}`);
    sections.push(`Original Prompt: ${context.task.originalPrompt}`);
    if (context.task.constraints?.length) {
      sections.push(
        `Constraints:\n${context.task.constraints.map((c) => `- ${c}`).join('\n')}`,
      );
    }
    if (context.task.testCommand) {
      sections.push(`Test Command: ${context.task.testCommand}`);
    }

    // Session info
    sections.push('\n## Session');
    sections.push(`Session ID: ${context.sessionId}`);
    sections.push(`Round: ${context.round}`);

    // Relevant files
    if (context.relevantFiles.length > 0) {
      sections.push('\n## Relevant Files');
      for (const file of context.relevantFiles) {
        sections.push(`\n### ${file.path}`);
        if (file.language) {
          sections.push(`Language: ${file.language}`);
        }
        sections.push('```');
        sections.push(file.content);
        sections.push('```');
      }
    }

    // Project decisions
    if (context.projectDecisions.length > 0) {
      sections.push('\n## Project Decisions');
      for (const decision of context.projectDecisions) {
        sections.push(`- [${decision.scope}] ${decision.summary}`);
        if (decision.reasoning) {
          sections.push(`  Reasoning: ${decision.reasoning}`);
        }
      }
    }

    // Session history
    if (context.sessionHistory.length > 0) {
      sections.push('\n## Session History');
      for (const entry of context.sessionHistory) {
        sections.push(
          `- Round ${entry.round}: ${entry.keyDecision} → ${entry.outcome}`,
        );
      }
    }

    // Previous failures
    if (context.previousFailures && context.previousFailures.length > 0) {
      sections.push('\n## Previous Failures');
      for (const failure of context.previousFailures) {
        sections.push(`\n### Round ${failure.round}`);
        sections.push(`Analysis: ${failure.analysis}`);
        sections.push(`Failing Tests: ${failure.failingTests.join(', ')}`);
        sections.push('Output:');
        sections.push('```');
        sections.push(failure.testOutput.slice(0, 1000)); // Truncate long output
        sections.push('```');
      }
    }

    // Hints
    if (context.hints && context.hints.length > 0) {
      sections.push('\n## Hints');
      for (const hint of context.hints) {
        sections.push(`- ${hint}`);
      }
    }

    return sections.join('\n');
  }

  /**
   * Validate the thesis output.
   */
  protected validateOutput(output: ThesisOutput): ValidationResult {
    const errors: string[] = [];

    // Validate required string fields
    if (!isNonEmptyString(output.analysis)) {
      errors.push('analysis must be a non-empty string');
    }

    if (!isNonEmptyString(output.approach)) {
      errors.push('approach must be a non-empty string');
    }

    // Validate plan array
    if (!isArray(output.plan)) {
      errors.push('plan must be an array');
    } else if (output.plan.length === 0) {
      errors.push('plan must have at least one step');
    } else {
      for (let i = 0; i < output.plan.length; i++) {
        if (!isNonEmptyString(output.plan[i])) {
          errors.push(`plan[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate patches array
    if (!isArray(output.patches)) {
      errors.push('patches must be an array');
    } else {
      for (let i = 0; i < output.patches.length; i++) {
        const patchErrors = this.validatePatch(output.patches[i], i);
        errors.push(...patchErrors);
      }
    }

    // Validate risks array
    if (!isArray(output.risks)) {
      errors.push('risks must be an array');
    } else {
      for (let i = 0; i < output.risks.length; i++) {
        if (!isNonEmptyString(output.risks[i])) {
          errors.push(`risks[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate confidence if present
    if (output.confidence !== undefined) {
      if (typeof output.confidence !== 'number' || output.confidence < 0 || output.confidence > 1) {
        errors.push('confidence must be a number between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single patch.
   */
  private validatePatch(patch: ProposedPatch, index: number): string[] {
    const errors: string[] = [];
    const prefix = `patches[${index}]`;

    if (!isNonEmptyString(patch.file)) {
      errors.push(`${prefix}.file must be a non-empty string`);
    }

    const validActions = ['edit', 'create', 'delete'] as const;
    if (!validActions.includes(patch.action as (typeof validActions)[number])) {
      errors.push(
        `${prefix}.action must be one of: ${validActions.join(', ')}`,
      );
    }

    if (!isNonEmptyString(patch.description)) {
      errors.push(`${prefix}.description must be a non-empty string`);
    }

    // Code is required for create and edit actions
    if (patch.action !== 'delete' && !isNonEmptyString(patch.code)) {
      errors.push(`${prefix}.code is required for ${patch.action} action`);
    }

    return errors;
  }
}
