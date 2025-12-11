/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAgent, isNonEmptyString, isArray, isOneOf } from './base-agent.js';
import type { ValidationResult } from './base-agent.js';
import { SYNTHESIZER_SYSTEM_PROMPT } from './prompts.js';
import type {
  SynthesizerContext,
  SynthesisOutput,
  SynthesisDecision,
  FinalPatch,
  AgentLLMConfig,
  ResolutionType,
  ConfidenceLevel,
} from './types.js';
import { AGENT_DISPLAY_NAMES } from './types.js';

const VALID_RESOLUTIONS: readonly ResolutionType[] = [
  'accepted',
  'rejected',
  'modified',
];
const VALID_CONFIDENCE: readonly ConfidenceLevel[] = ['low', 'medium', 'high'];
const VALID_ACTIONS: readonly string[] = ['edit', 'create', 'delete'];

/**
 * Synthesizer agent (Synthesis generator).
 *
 * Responsible for:
 * - Reconciling thesis and antithesis
 * - Producing final, improved patches
 * - Making decisions on each critique point
 */
export class SynthesizerAgent extends BaseAgent<
  SynthesizerContext,
  SynthesisOutput
> {
  readonly role = 'synthesizer' as const;
  readonly displayName = AGENT_DISPLAY_NAMES.synthesizer;

  constructor(config: AgentLLMConfig) {
    super(config, SYNTHESIZER_SYSTEM_PROMPT);
  }

  /**
   * Format the synthesizer context for the LLM.
   */
  protected formatContext(context: SynthesizerContext): string {
    const sections: string[] = [];

    // Task description
    sections.push('## Task');
    sections.push(`ID: ${context.task.id}`);
    sections.push(`Description: ${context.task.description}`);
    if (context.task.testCommand) {
      sections.push(`Test Command: ${context.task.testCommand}`);
    }

    // Original proposal (thesis)
    sections.push('\n## Original Proposal (Thesis)');
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

    // Critique (antithesis)
    sections.push('\n## Critique (Antithesis)');
    sections.push(
      `Overall Assessment: ${context.antithesis.overallAssessment}`,
    );

    if (context.antithesis.strengths.length > 0) {
      sections.push(`\n### Strengths`);
      for (const strength of context.antithesis.strengths) {
        sections.push(`- ${strength}`);
      }
    }

    if (context.antithesis.issues.length > 0) {
      sections.push(`\n### Issues to Address`);
      for (let i = 0; i < context.antithesis.issues.length; i++) {
        const issue = context.antithesis.issues[i];
        sections.push(
          `\n${i + 1}. **[${issue.severity.toUpperCase()}] ${issue.category}**`,
        );
        sections.push(`   - Description: ${issue.description}`);
        sections.push(`   - Location: ${issue.location}`);
        sections.push(`   - Suggestion: ${issue.suggestion}`);
      }
    }

    if (context.antithesis.missingConsiderations.length > 0) {
      sections.push(`\n### Missing Considerations`);
      for (const consideration of context.antithesis.missingConsiderations) {
        sections.push(`- ${consideration}`);
      }
    }

    if (context.antithesis.questions.length > 0) {
      sections.push(`\n### Questions`);
      for (const question of context.antithesis.questions) {
        sections.push(`- ${question}`);
      }
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

    // Project invariants
    if (context.projectInvariants.length > 0) {
      sections.push('\n## Project Invariants');
      for (let i = 0; i < context.projectInvariants.length; i++) {
        sections.push(`${i + 1}. ${context.projectInvariants[i]}`);
      }
    }

    // Code patterns
    if (context.codePatterns.length > 0) {
      sections.push('\n## Code Patterns');
      for (const pattern of context.codePatterns) {
        sections.push(`\n### ${pattern.name}`);
        sections.push(pattern.description);
        if (pattern.example) {
          sections.push('Example:');
          sections.push('```');
          sections.push(pattern.example);
          sections.push('```');
        }
      }
    }

    // Previous test results if available
    if (context.testResults) {
      sections.push('\n## Previous Test Results');
      sections.push(`Success: ${context.testResults.success}`);
      sections.push(
        `Tests: ${context.testResults.testsPassed}/${context.testResults.testsRun} passed`,
      );
      if (context.testResults.failingTests.length > 0) {
        sections.push('Failing tests:');
        for (const test of context.testResults.failingTests) {
          sections.push(`- ${test}`);
        }
      }
    }

    return sections.join('\n');
  }

  /**
   * Validate the synthesis output.
   */
  protected validateOutput(output: SynthesisOutput): ValidationResult {
    const errors: string[] = [];

    // Validate resolution summary
    if (!isNonEmptyString(output.resolutionSummary)) {
      errors.push('resolutionSummary must be a non-empty string');
    }

    // Validate decisions array
    if (!isArray(output.decisions)) {
      errors.push('decisions must be an array');
    } else {
      for (let i = 0; i < output.decisions.length; i++) {
        const decisionErrors = this.validateDecision(output.decisions[i], i);
        errors.push(...decisionErrors);
      }
    }

    // Validate final plan array
    if (!isArray(output.finalPlan)) {
      errors.push('finalPlan must be an array');
    } else if (output.finalPlan.length === 0) {
      errors.push('finalPlan must have at least one step');
    } else {
      for (let i = 0; i < output.finalPlan.length; i++) {
        if (!isNonEmptyString(output.finalPlan[i])) {
          errors.push(`finalPlan[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate patches array
    if (!isArray(output.patches)) {
      errors.push('patches must be an array');
    } else {
      for (let i = 0; i < output.patches.length; i++) {
        const patchErrors = this.validateFinalPatch(output.patches[i], i);
        errors.push(...patchErrors);
      }
    }

    // Validate tests to run array
    if (!isArray(output.testsToRun)) {
      errors.push('testsToRun must be an array');
    } else {
      for (let i = 0; i < output.testsToRun.length; i++) {
        if (!isNonEmptyString(output.testsToRun[i])) {
          errors.push(`testsToRun[${i}] must be a non-empty string`);
        }
      }
    }

    // Validate confidence
    if (!isOneOf(output.confidence, VALID_CONFIDENCE)) {
      errors.push(`confidence must be one of: ${VALID_CONFIDENCE.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single decision.
   */
  private validateDecision(
    decision: SynthesisDecision,
    index: number,
  ): string[] {
    const errors: string[] = [];
    const prefix = `decisions[${index}]`;

    if (!isNonEmptyString(decision.issue)) {
      errors.push(`${prefix}.issue must be a non-empty string`);
    }

    if (!isOneOf(decision.resolution, VALID_RESOLUTIONS)) {
      errors.push(
        `${prefix}.resolution must be one of: ${VALID_RESOLUTIONS.join(', ')}`,
      );
    }

    if (!isNonEmptyString(decision.reasoning)) {
      errors.push(`${prefix}.reasoning must be a non-empty string`);
    }

    return errors;
  }

  /**
   * Validate a final patch.
   */
  private validateFinalPatch(patch: FinalPatch, index: number): string[] {
    const errors: string[] = [];
    const prefix = `patches[${index}]`;

    if (!isNonEmptyString(patch.file)) {
      errors.push(`${prefix}.file must be a non-empty string`);
    }

    if (!VALID_ACTIONS.includes(patch.action)) {
      errors.push(
        `${prefix}.action must be one of: ${VALID_ACTIONS.join(', ')}`,
      );
    }

    if (!isNonEmptyString(patch.description)) {
      errors.push(`${prefix}.description must be a non-empty string`);
    }

    // Validate based on action type
    if (patch.action === 'edit') {
      if (!isNonEmptyString(patch.search)) {
        errors.push(`${prefix}.search is required for edit action`);
      }
      if (!isNonEmptyString(patch.replace)) {
        errors.push(`${prefix}.replace is required for edit action`);
      }
    } else if (patch.action === 'create') {
      if (!isNonEmptyString(patch.content)) {
        errors.push(`${prefix}.content is required for create action`);
      }
    }
    // delete action doesn't require additional fields

    return errors;
  }
}
