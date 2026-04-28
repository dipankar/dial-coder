/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm/llm-client.js';
import type { TokenUsage } from '../llm/types.js';
import type { Decision, Pattern } from '../memory/types.js';
import { ProposerAgent } from '../agents/proposer-agent.js';
import { CriticAgent } from '../agents/critic-agent.js';
import { SynthesizerAgent } from '../agents/synthesizer-agent.js';
import { SafetyClassifier } from './safety-classifier.js';
import type {
  AgentsConfig,
  TaskDescription,
  FileContent,
  FailureInfo,
  ProposerContext,
  CriticContext,
  SynthesizerContext,
  ThesisOutput,
  AntithesisOutput,
  SynthesisOutput,
  RoundResult,
  RoundOutcome,
  VerificationResult,
  FinalPatch,
} from '../agents/types.js';

/**
 * Round execution options.
 */
export interface RoundOptions {
  task: TaskDescription;
  sessionId: string;
  round: number;
  relevantFiles: FileContent[];
  projectDecisions: Decision[];
  projectInvariants: string[];
  codePatterns: Pattern[];
  sessionHistory?: Array<{
    round: number;
    keyDecision: string;
    outcome: string;
  }>;
  previousFailures?: FailureInfo[];
  failurePatterns?: Decision[];
  hints?: string[];
  userPreferences?: {
    strictSecurity?: boolean;
    strictPerformance?: boolean;
    preferSimplicity?: boolean;
  };
}

/**
 * Verification function type.
 */
export type VerifyFunction = (
  patches: FinalPatch[],
  testCommand?: string,
) => Promise<VerificationResult>;

/**
 * Patch application function type.
 */
export type ApplyPatchFunction = (patch: FinalPatch) => Promise<boolean>;

/**
 * Token usage for a round, broken down by phase.
 */
export interface RoundTokenUsage {
  thesis: TokenUsage;
  antithesis: TokenUsage;
  synthesis: TokenUsage;
  total: TokenUsage;
}

/**
 * Round event types.
 */
export type RoundEvent =
  | { type: 'thesis_start' }
  | { type: 'thesis_complete'; output: ThesisOutput; tokenUsage?: TokenUsage }
  | { type: 'antithesis_start' }
  | {
      type: 'antithesis_complete';
      output: AntithesisOutput;
      tokenUsage?: TokenUsage;
    }
  | { type: 'synthesis_start' }
  | {
      type: 'synthesis_complete';
      output: SynthesisOutput;
      tokenUsage?: TokenUsage;
    }
  | { type: 'verification_start' }
  | { type: 'verification_complete'; result: VerificationResult }
  | {
      type: 'round_complete';
      result: RoundResult;
      tokenUsage?: RoundTokenUsage;
    }
  | { type: 'error'; error: Error };

/**
 * Event handler type.
 */
export type RoundEventHandler = (event: RoundEvent) => void;

/**
 * Manages a single dialectic round.
 *
 * A round consists of:
 * 1. Thesis (Proposer generates plan)
 * 2. Antithesis (Critic reviews plan)
 * 3. Synthesis (Synthesizer reconciles)
 * 4. Verification (Apply patches and run tests)
 */
export class RoundManager {
  private proposer: ProposerAgent;
  private critic: CriticAgent;
  private synthesizer: SynthesizerAgent;
  private verifyFn: VerifyFunction;
  private applyPatchFn: ApplyPatchFunction;
  private eventHandlers: RoundEventHandler[] = [];
  private safetyClassifier = new SafetyClassifier();

  constructor(
    config: AgentsConfig,
    llmClients: {
      proposer: LLMClient;
      critic: LLMClient;
      synthesizer: LLMClient;
    },
    verifyFn: VerifyFunction,
    applyPatchFn: ApplyPatchFunction,
  ) {
    // Initialize agents
    this.proposer = new ProposerAgent(config.proposer);
    this.proposer.setLLMClient(llmClients.proposer);

    this.critic = new CriticAgent(config.critic);
    this.critic.setLLMClient(llmClients.critic);

    this.synthesizer = new SynthesizerAgent(config.synthesizer);
    this.synthesizer.setLLMClient(llmClients.synthesizer);

    this.verifyFn = verifyFn;
    this.applyPatchFn = applyPatchFn;
  }

  /**
   * Add an event handler.
   */
  onEvent(handler: RoundEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler.
   */
  offEvent(handler: RoundEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit an event to all handlers.
   */
  private emit(event: RoundEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Execute a single dialectic round.
   */
  async execute(options: RoundOptions): Promise<RoundResult> {
    try {
      // Track token usage per phase
      const zeroUsage = (): TokenUsage => ({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      let thesisTokens: TokenUsage = zeroUsage();
      let antithesisTokens: TokenUsage = zeroUsage();
      let synthesisTokens: TokenUsage = zeroUsage();

      // Phase 1: Thesis (Proposer)
      this.emit({ type: 'thesis_start' });
      const thesis = await this.generateThesis(options);
      thesisTokens = this.proposer.getLastTokenUsage() ?? zeroUsage();
      this.emit({
        type: 'thesis_complete',
        output: thesis,
        tokenUsage: thesisTokens,
      });

      // Phase 2: Antithesis (Critic)
      this.emit({ type: 'antithesis_start' });
      const antithesis = await this.generateAntithesis(options, thesis);
      antithesisTokens = this.critic.getLastTokenUsage() ?? zeroUsage();
      this.emit({
        type: 'antithesis_complete',
        output: antithesis,
        tokenUsage: antithesisTokens,
      });

      // Phase 3: Synthesis (Synthesizer)
      this.emit({ type: 'synthesis_start' });
      const synthesis = await this.generateSynthesis(
        options,
        thesis,
        antithesis,
      );
      synthesisTokens = this.synthesizer.getLastTokenUsage() ?? zeroUsage();
      this.emit({
        type: 'synthesis_complete',
        output: synthesis,
        tokenUsage: synthesisTokens,
      });

      // Phase 4: Verification
      this.emit({ type: 'verification_start' });
      const verification = await this.verify(synthesis.patches, options.task);
      this.emit({ type: 'verification_complete', result: verification });

      // Determine outcome
      const outcome = this.determineOutcome(verification, synthesis);

      const result: RoundResult = {
        round: options.round,
        thesis,
        antithesis,
        synthesis,
        verification,
        outcome,
      };

      // Calculate total token usage for the round
      const roundTokenUsage: RoundTokenUsage = {
        thesis: thesisTokens,
        antithesis: antithesisTokens,
        synthesis: synthesisTokens,
        total: {
          promptTokens:
            thesisTokens.promptTokens +
            antithesisTokens.promptTokens +
            synthesisTokens.promptTokens,
          completionTokens:
            thesisTokens.completionTokens +
            antithesisTokens.completionTokens +
            synthesisTokens.completionTokens,
          totalTokens:
            thesisTokens.totalTokens +
            antithesisTokens.totalTokens +
            synthesisTokens.totalTokens,
        },
      };

      this.emit({
        type: 'round_complete',
        result,
        tokenUsage: roundTokenUsage,
      });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'error', error: err });
      throw err;
    }
  }

  /**
   * Generate thesis using Proposer agent.
   */
  private async generateThesis(options: RoundOptions): Promise<ThesisOutput> {
    const context: ProposerContext = {
      task: options.task,
      sessionId: options.sessionId,
      round: options.round,
      relevantFiles: options.relevantFiles,
      projectDecisions: options.projectDecisions,
      sessionHistory: options.sessionHistory || [],
      previousFailures: options.previousFailures,
      hints: options.hints,
    };

    return this.proposer.generate(context);
  }

  /**
   * Generate antithesis using Critic agent.
   */
  private async generateAntithesis(
    options: RoundOptions,
    thesis: ThesisOutput,
  ): Promise<AntithesisOutput> {
    const context: CriticContext = {
      task: options.task,
      sessionId: options.sessionId,
      round: options.round,
      relevantFiles: options.relevantFiles,
      thesis,
      projectDecisions: options.projectDecisions,
      failurePatterns: options.failurePatterns || [],
      userPreferences: options.userPreferences,
    };

    return this.critic.generate(context);
  }

  /**
   * Generate synthesis using Synthesizer agent.
   */
  private async generateSynthesis(
    options: RoundOptions,
    thesis: ThesisOutput,
    antithesis: AntithesisOutput,
  ): Promise<SynthesisOutput> {
    const context: SynthesizerContext = {
      task: options.task,
      sessionId: options.sessionId,
      round: options.round,
      relevantFiles: options.relevantFiles,
      thesis,
      antithesis,
      projectInvariants: options.projectInvariants,
      codePatterns: options.codePatterns,
    };

    return this.synthesizer.generate(context);
  }

  /**
   * Apply patches and run verification.
   */
  private async verify(
    patches: FinalPatch[],
    task: TaskDescription,
  ): Promise<VerificationResult> {
    // Safety classification before applying patches
    const safetyInput = {
      userText: task.originalPrompt,
      patches: patches.map((p) => ({
        file: p.file,
        action: p.action,
        content: p.content,
        search: p.search,
        replace: p.replace,
      })),
      testCommand: task.testCommand,
    };
    const verdict = this.safetyClassifier.classify(safetyInput);
    if (verdict === 'block') {
      return {
        success: false,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        failingTests: [],
        output: 'Safety classifier blocked potentially dangerous operation.',
        duration: 0,
      };
    }
    if (verdict === 'ask') {
      return {
        success: false,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        failingTests: [],
        output:
          'Safety classifier requires user confirmation for this operation.',
        duration: 0,
      };
    }

    // Apply each patch
    for (const patch of patches) {
      const success = await this.applyPatchFn(patch);
      if (!success) {
        return {
          success: false,
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          failingTests: [],
          output: `Failed to apply patch: ${patch.file} (${patch.action})`,
          duration: 0,
        };
      }
    }

    // Run verification
    return this.verifyFn(patches, task.testCommand);
  }

  /**
   * Determine the round outcome based on verification and synthesis.
   */
  private determineOutcome(
    verification: VerificationResult,
    synthesis: SynthesisOutput,
  ): RoundOutcome {
    if (verification.success) {
      return 'success';
    }

    // Partial success if some tests passed or confidence was low anyway
    if (verification.testsPassed > 0 || synthesis.confidence === 'low') {
      return 'partial';
    }

    return 'failed';
  }

  /**
   * Execute thesis-only mode (skip critic and synthesizer).
   */
  async executeSimple(options: RoundOptions): Promise<RoundResult> {
    try {
      // Track token usage
      const zeroUsage = (): TokenUsage => ({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      // Phase 1: Thesis (Proposer)
      this.emit({ type: 'thesis_start' });
      const thesis = await this.generateThesis(options);
      const thesisTokens = this.proposer.getLastTokenUsage() ?? zeroUsage();
      this.emit({
        type: 'thesis_complete',
        output: thesis,
        tokenUsage: thesisTokens,
      });

      // Convert thesis patches to final patches
      const finalPatches: FinalPatch[] = thesis.patches.map((p) => ({
        file: p.file,
        action: p.action,
        content: p.code,
        replace: p.code,
        search: p.location,
        description: p.description,
      }));

      // Create minimal antithesis and synthesis
      const antithesis: AntithesisOutput = {
        overallAssessment: 'brief',
        strengths: [],
        issues: [],
        missingConsiderations: [],
        questions: [],
      };

      const synthesis: SynthesisOutput = {
        resolutionSummary: 'Direct application (simple mode)',
        decisions: [],
        finalPlan: thesis.plan,
        patches: finalPatches,
        testsToRun: options.task.testCommand ? [options.task.testCommand] : [],
        confidence: 'medium',
      };

      // Phase 4: Verification
      this.emit({ type: 'verification_start' });
      const verification = await this.verify(finalPatches, options.task);
      this.emit({ type: 'verification_complete', result: verification });

      const outcome = this.determineOutcome(verification, synthesis);

      const result: RoundResult = {
        round: options.round,
        thesis,
        antithesis,
        synthesis,
        verification,
        outcome,
      };

      // Token usage for simple mode (only thesis)
      const roundTokenUsage: RoundTokenUsage = {
        thesis: thesisTokens,
        antithesis: zeroUsage(),
        synthesis: zeroUsage(),
        total: thesisTokens,
      };

      this.emit({
        type: 'round_complete',
        result,
        tokenUsage: roundTokenUsage,
      });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'error', error: err });
      throw err;
    }
  }
}
