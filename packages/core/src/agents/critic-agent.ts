/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent, isNonEmptyString, isArray, isOneOf } from './base-agent.js';
import type { ValidationResult } from './base-agent.js';
import { CRITIC_SYSTEM_PROMPT } from './prompts.js';
import type {
  CriticContext,
  AntithesisOutput,
  CriticIssue,
  AgentLLMConfig,
  IssueSeverity,
  IssueCategory,
  OverallAssessment,
} from './types.js';
import { AGENT_DISPLAY_NAMES } from './types.js';

const VALID_SEVERITIES: readonly IssueSeverity[] = [
  'low',
  'medium',
  'high',
  'critical',
];
const VALID_CATEGORIES: readonly IssueCategory[] = [
  'correctness',
  'security',
  'performance',
  'maintainability',
  'edge_case',
];
const VALID_ASSESSMENTS: readonly OverallAssessment[] = [
  'brief',
  'acceptable',
  'concerning',
  'critical',
];

/**
 * Critic agent (Antithesis generator).
 *
 * Responsible for:
 * - Analyzing proposals for weaknesses
 * - Identifying bugs, security issues, and edge cases
 * - Providing constructive suggestions
 */
export class CriticAgent extends BaseAgent<CriticContext, AntithesisOutput> {
  readonly role = 'critic' as const;
  readonly displayName = AGENT_DISPLAY_NAMES.critic;

  constructor(config: AgentLLMConfig) {
    super(config, CRITIC_SYSTEM_PROMPT);
  }

  /**
   * Format the critic context for the LLM.
   */
  protected formatContext(context: CriticContext): string {
    const sections: string[] = [];

    // Task description
    sections.push('## Task');
    sections.push(`ID: ${context.task.id}`);
    sections.push(`Description: ${context.task.description}`);
    if (context.task.constraints?.length) {
      sections.push(
        `Constraints:\n${context.task.constraints.map((c) => `- ${c}`).join('\n')}`,
      );
    }

    // Thesis to review
    sections.push('\n## Proposal (Thesis)');
    sections.push(`### Analysis`);
    sections.push(context.thesis.analysis);
    sections.push(`\n### Approach`);
    sections.push(context.thesis.approach);
    sections.push(`\n### Plan`);
    for (let i = 0; i < context.thesis.plan.length; i++) {
      sections.push(`${i + 1}. ${context.thesis.plan[i]}`);
    }
    sections.push(`\n### Proposed Patches`);
    for (const patch of context.thesis.patches) {
      sections.push(`\n#### ${patch.file} (${patch.action})`);
      if (patch.location) {
        sections.push(`Location: ${patch.location}`);
      }
      sections.push(`Description: ${patch.description}`);
      if (patch.code) {
        sections.push('```');
        sections.push(patch.code);
        sections.push('```');
      }
    }
    sections.push(`\n### Identified Risks`);
    for (const risk of context.thesis.risks) {
      sections.push(`- ${risk}`);
    }

    // Relevant files for context
    if (context.relevantFiles.length > 0) {
      sections.push('\n## Relevant Files');
      for (const file of context.relevantFiles) {
        sections.push(`\n### ${file.path}`);
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
      }
    }

    // Failure patterns to watch for
    if (context.failurePatterns.length > 0) {
      sections.push('\n## Known Failure Patterns');
      for (const pattern of context.failurePatterns) {
        sections.push(`- [${pattern.scope}] ${pattern.summary}`);
        if (pattern.reasoning) {
          sections.push(`  Context: ${pattern.reasoning}`);
        }
      }
    }

    // User preferences
    if (context.userPreferences) {
      sections.push('\n## Review Preferences');
      if (context.userPreferences.strictSecurity) {
        sections.push(
          '- Security: STRICT - Flag all potential security issues',
        );
      }
      if (context.userPreferences.strictPerformance) {
        sections.push('- Performance: STRICT - Flag all performance concerns');
      }
      if (context.userPreferences.preferSimplicity) {
        sections.push('- Simplicity: Preferred - Flag unnecessary complexity');
      }
    }

    return sections.join('\n');
  }

  /**
   * Validate the antithesis output.
   */
  protected validateOutput(output: AntithesisOutput): ValidationResult {
    const errors: string[] = [];

    // Validate overall assessment
    if (!isOneOf(output.overallAssessment, VALID_ASSESSMENTS)) {
      errors.push(
        `overallAssessment must be one of: ${VALID_ASSESSMENTS.join(', ')}`,
      );
    }

    // Validate strengths array
    if (!isArray(output.strengths)) {
      errors.push('strengths must be an array');
    } else {
      for (let i = 0; i < output.strengths.length; i++) {
        if (!isNonEmptyString(output.strengths[i])) {
          errors.push(`strengths[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate issues array
    if (!isArray(output.issues)) {
      errors.push('issues must be an array');
    } else {
      for (let i = 0; i < output.issues.length; i++) {
        const issueErrors = this.validateIssue(output.issues[i], i);
        errors.push(...issueErrors);
      }
    }

    // Validate missing considerations array
    if (!isArray(output.missingConsiderations)) {
      errors.push('missingConsiderations must be an array');
    } else {
      for (let i = 0; i < output.missingConsiderations.length; i++) {
        if (!isNonEmptyString(output.missingConsiderations[i])) {
          errors.push(`missingConsiderations[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate questions array
    if (!isArray(output.questions)) {
      errors.push('questions must be an array');
    } else {
      for (let i = 0; i < output.questions.length; i++) {
        if (!isNonEmptyString(output.questions[i])) {
          errors.push(`questions[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate confidence if present
    if (output.confidence !== undefined) {
      if (
        typeof output.confidence !== 'number' ||
        output.confidence < 0 ||
        output.confidence > 1
      ) {
        errors.push('confidence must be a number between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single issue.
   */
  private validateIssue(issue: CriticIssue, index: number): string[] {
    const errors: string[] = [];
    const prefix = `issues[${index}]`;

    if (!isOneOf(issue.severity, VALID_SEVERITIES)) {
      errors.push(
        `${prefix}.severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
      );
    }

    if (!isOneOf(issue.category, VALID_CATEGORIES)) {
      errors.push(
        `${prefix}.category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      );
    }

    if (!isNonEmptyString(issue.description)) {
      errors.push(`${prefix}.description must be a non-empty string`);
    }

    if (!isNonEmptyString(issue.location)) {
      errors.push(`${prefix}.location must be a non-empty string`);
    }

    if (!isNonEmptyString(issue.suggestion)) {
      errors.push(`${prefix}.suggestion must be a non-empty string`);
    }

    return errors;
  }
}
