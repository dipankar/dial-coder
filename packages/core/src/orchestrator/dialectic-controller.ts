/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm/llm-client.js';
import type { TokenUsage } from '../llm/types.js';
import type { MemorySystem } from '../memory/memory-system.js';
import type { Decision, Pattern, TaskInfo } from '../memory/types.js';
import { ReflectorAgent } from '../agents/reflector-agent.js';
import { RoundManager } from './round-manager.js';
import type {
  RoundOptions,
  ApplyPatchFunction,
  VerifyFunction,
  RoundTokenUsage,
} from './round-manager.js';
import type { TokenProfiler } from './token-profiler.js';
import type {
  PerformanceTracker,
  TokenUsageData,
} from './performance-metrics.js';
import type {
  AgentsConfig,
  TaskDescription,
  FileContent,
  TaskResult,
  RoundResult,
  RoundOutcome,
  FinalPatch,
  ReflectionOutput,
  ReflectorContext,
  FailureInfo,
} from '../agents/types.js';
import { DEFAULT_AGENT_CONFIGS } from '../agents/types.js';

/**
 * Execution mode for the dialectic controller.
 */
export type ExecutionMode = 'simple' | 'dialectic_light' | 'dialectic_full';

/**
 * Controller configuration.
 */
export interface ControllerConfig {
  maxRounds: number;
  mode: ExecutionMode;
  agentConfigs: AgentsConfig;
  collectReflections: boolean;
}

/**
 * Default controller configuration.
 */
export const DEFAULT_CONTROLLER_CONFIG: ControllerConfig = {
  maxRounds: 3,
  mode: 'dialectic_full',
  agentConfigs: DEFAULT_AGENT_CONFIGS,
  collectReflections: true,
};

/**
 * Controller event types.
 */
export type ControllerEvent =
  | { type: 'task_start'; task: TaskDescription }
  | { type: 'round_start'; round: number }
  | { type: 'round_end'; round: number; result: RoundResult }
  | { type: 'reflection_start' }
  | { type: 'reflection_complete'; output: ReflectionOutput }
  | { type: 'task_complete'; result: TaskResult }
  | { type: 'task_failed'; error: Error }
  | { type: 'status'; message: string };

/**
 * Event handler type.
 */
export type ControllerEventHandler = (event: ControllerEvent) => void;

/**
 * File provider function type.
 */
export type FileProvider = (files: string[]) => Promise<FileContent[]>;

/**
 * File discovery function type.
 */
export type FileDiscoveryFunction = (
  task: TaskDescription,
) => Promise<string[]>;

/**
 * Optional tracking dependencies.
 */
export interface TrackingDependencies {
  tokenProfiler?: TokenProfiler;
  performanceTracker?: PerformanceTracker;
}

/**
 * Dialectic Controller.
 *
 * Orchestrates the full dialectic loop:
 * 1. Run rounds until success or max rounds
 * 2. Collect reflections after completion
 * 3. Update memory with learnings
 */
export class DialecticController {
  private config: ControllerConfig;
  private roundManager: RoundManager;
  private reflector: ReflectorAgent;
  private memorySystem: MemorySystem;
  private fileProvider: FileProvider;
  private fileDiscovery: FileDiscoveryFunction;
  private eventHandlers: ControllerEventHandler[] = [];
  private roundResults: RoundResult[] = [];

  // Optional tracking
  private tokenProfiler?: TokenProfiler;
  private performanceTracker?: PerformanceTracker;
  private roundTokenUsage: Map<number, RoundTokenUsage> = new Map();

  constructor(
    config: Partial<ControllerConfig>,
    llmClients: {
      proposer: LLMClient;
      critic: LLMClient;
      synthesizer: LLMClient;
      reflector: LLMClient;
    },
    memorySystem: MemorySystem,
    fileProvider: FileProvider,
    fileDiscovery: FileDiscoveryFunction,
    verifyFn: VerifyFunction,
    applyPatchFn: ApplyPatchFunction,
    tracking?: TrackingDependencies,
  ) {
    this.config = { ...DEFAULT_CONTROLLER_CONFIG, ...config };
    this.memorySystem = memorySystem;
    this.fileProvider = fileProvider;
    this.fileDiscovery = fileDiscovery;

    // Set up optional tracking
    this.tokenProfiler = tracking?.tokenProfiler;
    this.performanceTracker = tracking?.performanceTracker;

    // Initialize round manager
    this.roundManager = new RoundManager(
      this.config.agentConfigs,
      {
        proposer: llmClients.proposer,
        critic: llmClients.critic,
        synthesizer: llmClients.synthesizer,
      },
      verifyFn,
      applyPatchFn,
    );

    // Set up round manager event handler for token tracking
    this.roundManager.onEvent((event) => {
      this.handleRoundEvent(event);
    });

    // Initialize reflector
    this.reflector = new ReflectorAgent(this.config.agentConfigs.reflector);
    this.reflector.setLLMClient(llmClients.reflector);
  }

  /**
   * Handle round manager events for token tracking.
   */
  private handleRoundEvent(
    event: import('./round-manager.js').RoundEvent,
  ): void {
    // Track token usage from agent completions
    if (event.type === 'thesis_complete' && event.tokenUsage) {
      this.recordAgentUsage('Planner', event.tokenUsage);
    } else if (event.type === 'antithesis_complete' && event.tokenUsage) {
      this.recordAgentUsage('Reviewer', event.tokenUsage);
    } else if (event.type === 'synthesis_complete' && event.tokenUsage) {
      this.recordAgentUsage('Resolver', event.tokenUsage);
    } else if (event.type === 'round_complete' && event.tokenUsage) {
      // Store round token usage for later reference
      this.roundTokenUsage.set(event.result.round, event.tokenUsage);
    }
  }

  /**
   * Record agent token usage to profiler and tracker.
   */
  private recordAgentUsage(agentName: string, usage: TokenUsage): void {
    // Record to token profiler
    if (this.tokenProfiler) {
      this.tokenProfiler.recordUsage(
        agentName,
        usage.promptTokens,
        usage.completionTokens,
      );
    }

    // Record to performance tracker (we don't have duration here, so use 0)
    if (this.performanceTracker) {
      const tokenData: TokenUsageData = {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      };
      this.performanceTracker.recordAgentInvocation(
        agentName,
        0,
        tokenData,
        true,
        false,
      );
    }
  }

  /**
   * Add an event handler.
   */
  onEvent(handler: ControllerEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler.
   */
  offEvent(handler: ControllerEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit an event to all handlers.
   */
  private emit(event: ControllerEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Execute a task using the dialectic process.
   */
  async execute(task: TaskDescription): Promise<TaskResult> {
    this.roundResults = [];
    this.emit({ type: 'task_start', task });

    try {
      // Convert TaskDescription to TaskInfo for memory system
      const taskInfo: TaskInfo = {
        originalPrompt: task.originalPrompt,
        interpretedGoal: task.description,
        filesTouched: [],
        scope: [],
      };

      // Start session in memory system
      const session = await this.memorySystem.startSession(taskInfo);
      const sessionId = session.getSessionId();

      // Discover relevant files
      this.emit({ type: 'status', message: 'Discovering relevant files...' });
      const relevantFilePaths = await this.fileDiscovery(task);
      const relevantFiles = await this.fileProvider(relevantFilePaths);

      // Load context from memory
      this.emit({ type: 'status', message: 'Loading context from memory...' });
      const scopes = this.extractScopes(relevantFilePaths);
      const projectDecisions = await this.memorySystem.getDecisions(scopes);
      const projectInvariants = await this.memorySystem.getInvariants();
      const failurePatterns = (
        await this.memorySystem.getDecisions(['anti_pattern'])
      ).filter((d: Decision) => d.type === 'anti_pattern');

      // Get code patterns from modules
      const codePatterns: Pattern[] = [];
      for (const scope of scopes) {
        const moduleMemory = await this.memorySystem.getModuleMemory(scope);
        if (moduleMemory?.patterns) {
          codePatterns.push(...moduleMemory.patterns);
        }
      }

      // Execute rounds
      let lastOutcome: RoundOutcome = 'failed';
      const failures: FailureInfo[] = [];

      for (let round = 1; round <= this.config.maxRounds; round++) {
        this.emit({ type: 'round_start', round });

        const roundOptions: RoundOptions = {
          task,
          sessionId,
          round,
          relevantFiles,
          projectDecisions,
          projectInvariants,
          codePatterns,
          sessionHistory: this.buildSessionHistory(),
          previousFailures: failures.length > 0 ? failures : undefined,
          failurePatterns,
        };

        let result: RoundResult;
        if (this.config.mode === 'simple') {
          result = await this.roundManager.executeSimple(roundOptions);
        } else {
          result = await this.roundManager.execute(roundOptions);
        }

        this.roundResults.push(result);
        lastOutcome = result.outcome;
        this.emit({ type: 'round_end', round, result });

        // Store round in memory
        await this.storeRound(result, task.id, sessionId);

        // Check if we succeeded
        if (result.outcome === 'success') {
          break;
        }

        // Record failure for next round
        if (result.outcome === 'failed' || result.outcome === 'partial') {
          failures.push({
            round,
            testOutput: result.verification.output,
            failingTests: result.verification.failingTests,
            analysis: this.analyzeFailure(result),
          });
        }
      }

      // Collect reflections if enabled
      let reflection: ReflectionOutput | undefined;
      if (this.config.collectReflections && this.config.mode !== 'simple') {
        this.emit({ type: 'reflection_start' });
        reflection = await this.collectReflection(
          task,
          sessionId,
          lastOutcome,
          projectDecisions,
          codePatterns,
        );

        // Track Learner token usage
        const reflectorUsage = this.reflector.getLastTokenUsage();
        if (reflectorUsage) {
          this.recordAgentUsage('Learner', reflectorUsage);
        }

        this.emit({ type: 'reflection_complete', output: reflection });

        // Update memory with learnings
        if (reflection.memoryUpdates.addToDecisions) {
          await this.updateMemory(reflection, sessionId);
        }
      }

      // End session
      await this.memorySystem.endSession();

      // Build task result
      const taskResult = this.buildTaskResult(task, sessionId, lastOutcome);
      this.emit({ type: 'task_complete', result: taskResult });

      return taskResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit({ type: 'task_failed', error: err });
      throw err;
    }
  }

  /**
   * Extract scopes from file paths.
   */
  private extractScopes(files: string[]): string[] {
    const scopes = new Set<string>();

    for (const file of files) {
      const parts = file.replace(/\\/g, '/').split('/');
      for (const part of parts) {
        if (part && !part.includes('.') && part !== 'src') {
          scopes.add(part.toLowerCase());
        }
      }
    }

    scopes.add('global');
    return Array.from(scopes);
  }

  /**
   * Build session history from previous rounds.
   */
  private buildSessionHistory(): Array<{
    round: number;
    keyDecision: string;
    outcome: string;
  }> {
    return this.roundResults.map((r) => ({
      round: r.round,
      keyDecision: r.synthesis.resolutionSummary,
      outcome: r.outcome,
    }));
  }

  /**
   * Analyze a failed round.
   */
  private analyzeFailure(result: RoundResult): string {
    const issues = result.antithesis.issues
      .filter((i) => i.severity === 'critical' || i.severity === 'high')
      .map((i) => i.description);

    if (issues.length > 0) {
      return `Critical issues identified: ${issues.join('; ')}`;
    }

    if (result.verification.failingTests.length > 0) {
      return `Tests failed: ${result.verification.failingTests.slice(0, 3).join(', ')}`;
    }

    return 'Unknown failure cause';
  }

  /**
   * Store round data in memory.
   */
  private async storeRound(
    result: RoundResult,
    taskId: string,
    _sessionId: string,
  ): Promise<void> {
    const roundMemory = this.memorySystem.getRoundMemory();
    if (!roundMemory) return;

    // Create and save round using memory system's API
    const problemContext = {
      description: result.thesis.analysis,
      constraints: [],
      filesInvolved: result.synthesis.patches.map((p) => p.file),
    };

    roundMemory.createRound(taskId, result.round, problemContext);

    // Update the round with thesis, antithesis, and synthesis data
    const roundData = roundMemory.getRound(result.round);
    if (roundData) {
      roundData.outcome = result.outcome;
      roundData.thesis = {
        summary: result.thesis.approach,
        approach: result.thesis.approach,
        patches: result.thesis.patches.map((p) => ({
          file: p.file,
          description: p.description,
          type:
            p.action === 'edit'
              ? ('modify' as const)
              : (p.action as 'create' | 'delete'),
        })),
        risks: result.thesis.risks,
        tokenUsage: 0,
      };
      roundData.antithesis = {
        overallAssessment: result.antithesis.overallAssessment,
        strengths: result.antithesis.strengths,
        issues: result.antithesis.issues.map((i) => ({
          severity: i.severity,
          category: i.category,
          description: i.description,
          location: i.location,
          suggestion: i.suggestion,
        })),
        missingConsiderations: result.antithesis.missingConsiderations,
        tokenUsage: 0,
      };
      roundData.synthesis = {
        resolutionSummary: result.synthesis.resolutionSummary,
        confidence: result.synthesis.confidence,
        decisions: result.synthesis.decisions.map((d) => ({
          issue: d.issue,
          resolution: d.resolution,
          reasoning: d.reasoning,
        })),
        finalPatches: result.synthesis.patches.map((p) => ({
          file: p.file,
          description: p.description,
          type:
            p.action === 'edit'
              ? ('modify' as const)
              : (p.action as 'create' | 'delete'),
          appliedAt: new Date().toISOString(),
          success: true,
        })),
        tokenUsage: 0,
      };
      roundData.verification = {
        testsRun: result.verification.failingTests,
        passed: result.verification.success,
        failures: result.verification.failingTests.map((t) => ({
          testName: t,
          file: '',
          error: result.verification.output,
        })),
        output: result.verification.output,
      };

      await roundMemory.saveRound(result.round);
    }
  }

  /**
   * Collect reflection on the completed rounds.
   */
  private async collectReflection(
    task: TaskDescription,
    sessionId: string,
    finalOutcome: RoundOutcome,
    existingDecisions: Decision[],
    existingPatterns: Pattern[],
  ): Promise<ReflectionOutput> {
    const reflectorContext: ReflectorContext = {
      task,
      sessionId,
      allRounds: this.roundResults,
      finalOutcome,
      existingDecisions,
      existingPatterns,
    };

    return this.reflector.generate(reflectorContext);
  }

  /**
   * Update memory with reflection learnings.
   */
  private async updateMemory(
    reflection: ReflectionOutput,
    sessionId: string,
  ): Promise<void> {
    // Add decisions to project memory
    for (const decision of reflection.decisionsToRecord) {
      await this.memorySystem.addDecision(
        {
          scope: decision.scope,
          type:
            decision.type === 'invariant'
              ? 'invariant'
              : decision.type === 'pattern'
                ? 'pattern'
                : 'constraint',
          summary: decision.summary,
          reasoning: decision.reasoning,
          confidence: 'medium',
        },
        sessionId,
      );
    }

    // Add lessons as module patterns
    for (const lesson of reflection.lessonsLearned) {
      if (lesson.type === 'pattern' && lesson.appliesTo.length > 0) {
        const moduleName = lesson.appliesTo[0];
        await this.memorySystem.addModulePattern(moduleName, {
          name: `Learned: ${lesson.description.slice(0, 50)}`,
          description: lesson.description,
          whenToUse: `When working on ${moduleName} module`,
        });
      }
    }
  }

  /**
   * Build the final task result.
   */
  private buildTaskResult(
    task: TaskDescription,
    sessionId: string,
    outcome: RoundOutcome,
  ): TaskResult {
    // Collect all applied patches from successful rounds
    const patches: FinalPatch[] = [];
    for (const round of this.roundResults) {
      if (round.outcome === 'success' || round.outcome === 'partial') {
        patches.push(...round.synthesis.patches);
      }
    }

    // Generate summary
    const summary = this.generateSummary(task, outcome);

    return {
      success: outcome === 'success',
      rounds: this.roundResults.length,
      patches,
      summary,
      sessionId,
    };
  }

  /**
   * Generate a human-readable summary.
   */
  private generateSummary(
    task: TaskDescription,
    outcome: RoundOutcome,
  ): string {
    const lines: string[] = [];

    lines.push(`Task: ${task.description}`);
    lines.push(`Outcome: ${outcome}`);
    lines.push(`Rounds: ${this.roundResults.length}`);

    if (outcome === 'success') {
      const lastRound = this.roundResults[this.roundResults.length - 1];
      lines.push(`Patches applied: ${lastRound.synthesis.patches.length}`);
      lines.push(
        `Tests passed: ${lastRound.verification.testsPassed}/${lastRound.verification.testsRun}`,
      );
    } else {
      const lastRound = this.roundResults[this.roundResults.length - 1];
      if (lastRound) {
        lines.push(
          `Failing tests: ${lastRound.verification.failingTests.join(', ')}`,
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Get the current round results.
   */
  getRoundResults(): RoundResult[] {
    return [...this.roundResults];
  }

  /**
   * Get the configuration.
   */
  getConfig(): ControllerConfig {
    return { ...this.config };
  }

  /**
   * Get token usage for a specific round.
   */
  getRoundTokenUsage(round: number): RoundTokenUsage | undefined {
    return this.roundTokenUsage.get(round);
  }

  /**
   * Get total token usage across all rounds.
   */
  getTotalTokenUsage(): TokenUsage {
    const total: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (const roundUsage of this.roundTokenUsage.values()) {
      total.promptTokens += roundUsage.total.promptTokens;
      total.completionTokens += roundUsage.total.completionTokens;
      total.totalTokens += roundUsage.total.totalTokens;
    }

    // Add reflector usage if available
    const reflectorUsage = this.reflector.getLastTokenUsage();
    if (reflectorUsage) {
      total.promptTokens += reflectorUsage.promptTokens;
      total.completionTokens += reflectorUsage.completionTokens;
      total.totalTokens += reflectorUsage.totalTokens;
    }

    return total;
  }

  /**
   * Get the token profiler if configured.
   */
  getTokenProfiler(): TokenProfiler | undefined {
    return this.tokenProfiler;
  }

  /**
   * Get the performance tracker if configured.
   */
  getPerformanceTracker(): PerformanceTracker | undefined {
    return this.performanceTracker;
  }
}
