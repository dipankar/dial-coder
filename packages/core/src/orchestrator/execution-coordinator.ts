/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMClient } from '../llm/llm-client.js';
import type { MemorySystem } from '../memory/memory-system.js';
import {
  ModeSelector,
  requiresDialectic,
  type ModeSelectionOptions,
} from './mode-selector.js';
import { ModeEscalationManager } from './mode-escalation.js';
import {
  DialecticController,
  type ControllerConfig,
  type ControllerEvent,
  type FileProvider,
  type FileDiscoveryFunction,
} from './dialectic-controller.js';
import {
  type VerifyFunction,
  type ApplyPatchFunction,
} from './round-manager.js';
import {
  toInternalMode,
  type InternalMode,
  type UserMode,
  type ModeSelectionResult,
} from './mode-config.js';
import type { TaskDescription, TaskResult } from '../agents/types.js';

/**
 * LLM clients for all agents in the dialectic process.
 */
export interface AgentLLMClients {
  proposer: LLMClient;
  critic: LLMClient;
  synthesizer: LLMClient;
  reflector: LLMClient;
}

/**
 * Configuration for the execution coordinator.
 */
export interface ExecutionCoordinatorConfig {
  /** Default user mode if not specified */
  defaultMode?: UserMode;
  /** Whether to enable automatic mode selection */
  autoSelectMode?: boolean;
  /** Whether to enable mode escalation */
  enableEscalation?: boolean;
  /** Callback for mode selection events */
  onModeSelected?: (result: ModeSelectionResult) => void;
  /** Callback for escalation events */
  onModeEscalated?: (
    fromMode: InternalMode,
    toMode: InternalMode,
    reason: string,
  ) => void;
}

/**
 * Default coordinator configuration.
 */
export const DEFAULT_COORDINATOR_CONFIG: ExecutionCoordinatorConfig = {
  autoSelectMode: true,
  enableEscalation: true,
};

/**
 * Result from execution coordination.
 */
export interface ExecutionCoordinatorResult {
  /** The mode that was used */
  mode: InternalMode;
  /** Display name shown to user */
  displayMode: UserMode;
  /** Whether mode was auto-selected */
  isAutoSelected: boolean;
  /** Mode selection confidence (0-1) */
  confidence: number;
  /** Reasons for mode selection */
  reasons: string[];
  /** Whether dialectic process was used */
  usedDialectic: boolean;
  /** Task result if dialectic was used */
  taskResult?: TaskResult;
  /** Token usage across all operations */
  tokensUsed: number;
}

/**
 * Dependencies needed for dialectic execution.
 */
export interface DialecticDependencies {
  llmClients: AgentLLMClients;
  memorySystem: MemorySystem;
  fileProvider: FileProvider;
  fileDiscovery: FileDiscoveryFunction;
  verifyFn: VerifyFunction;
  applyPatchFn: ApplyPatchFunction;
}

/**
 * Coordinates execution mode selection and routing.
 *
 * This class acts as the main integration point between the mode selection
 * system and the execution engine. It:
 *
 * 1. Analyzes incoming prompts to determine the appropriate execution mode
 * 2. Routes simple tasks directly to the LLM
 * 3. Routes complex tasks through the dialectic controller
 * 4. Manages mode escalation during execution
 * 5. Tracks token usage and execution metrics
 *
 * @example
 * ```typescript
 * const coordinator = new ExecutionCoordinator({
 *   autoSelectMode: true,
 *   enableEscalation: true,
 *   onModeSelected: (result) => console.log(`Mode: ${result.displayName}`),
 * });
 *
 * // For dialectic execution, provide dependencies
 * coordinator.setDialecticDependencies({
 *   llmClients: { proposer, critic, synthesizer, reflector },
 *   memorySystem,
 *   fileProvider,
 *   fileDiscovery,
 *   verifyFn,
 *   applyPatchFn,
 * });
 *
 * const result = await coordinator.execute(prompt, {
 *   affectedFiles: ['src/auth/login.ts'],
 * });
 * ```
 */
export class ExecutionCoordinator {
  private config: ExecutionCoordinatorConfig;
  private modeSelector: ModeSelector;
  private escalationManager: ModeEscalationManager | null = null;
  private dialecticController: DialecticController | null = null;
  private dialecticDeps: DialecticDependencies | null = null;
  private currentMode: InternalMode = 'simple';

  constructor(config: Partial<ExecutionCoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_COORDINATOR_CONFIG, ...config };
    this.modeSelector = new ModeSelector();
  }

  /**
   * Set dependencies required for dialectic execution.
   * This must be called before executing in dialectic modes.
   */
  setDialecticDependencies(deps: DialecticDependencies): void {
    this.dialecticDeps = deps;
  }

  /**
   * Check if dialectic dependencies are configured.
   */
  hasDialecticDependencies(): boolean {
    return this.dialecticDeps !== null;
  }

  /**
   * Initialize the dialectic controller with configuration.
   */
  private initializeDialecticController(
    config: Partial<ControllerConfig> = {},
  ): void {
    if (!this.dialecticDeps) {
      throw new Error(
        'Dialectic dependencies must be set before initializing controller',
      );
    }

    this.dialecticController = new DialecticController(
      config,
      this.dialecticDeps.llmClients,
      this.dialecticDeps.memorySystem,
      this.dialecticDeps.fileProvider,
      this.dialecticDeps.fileDiscovery,
      this.dialecticDeps.verifyFn,
      this.dialecticDeps.applyPatchFn,
    );

    // Set up event handlers
    this.dialecticController.onEvent(this.handleControllerEvent.bind(this));
  }

  /**
   * Select execution mode for a prompt.
   */
  selectMode(
    prompt: string,
    options: ModeSelectionOptions = {},
  ): ModeSelectionResult {
    // If user specified a mode, use it
    if (options.userMode) {
      const result = this.modeSelector.select(prompt, options);
      this.currentMode = result.mode;
      this.config.onModeSelected?.(result);
      return result;
    }

    // Auto-select if enabled
    if (this.config.autoSelectMode) {
      const result = this.modeSelector.select(prompt, options);
      this.currentMode = result.mode;
      this.config.onModeSelected?.(result);
      return result;
    }

    // Use default mode
    const defaultMode = this.config.defaultMode
      ? toInternalMode(this.config.defaultMode)
      : 'simple';

    const result = this.modeSelector.select(prompt, {
      ...options,
      userMode: this.config.defaultMode,
    });
    this.currentMode = defaultMode;
    this.config.onModeSelected?.(result);
    return result;
  }

  /**
   * Execute a task with automatic mode selection.
   */
  async execute(
    prompt: string,
    options: ModeSelectionOptions & {
      taskDescription?: Partial<TaskDescription>;
      controllerConfig?: Partial<ControllerConfig>;
    } = {},
  ): Promise<ExecutionCoordinatorResult> {
    // Select mode
    const modeResult = this.selectMode(prompt, options);

    // Initialize escalation manager if enabled
    if (this.config.enableEscalation) {
      this.escalationManager = new ModeEscalationManager(modeResult.mode);
    }

    const result: ExecutionCoordinatorResult = {
      mode: modeResult.mode,
      displayMode: modeResult.displayName,
      isAutoSelected: modeResult.isAutoSelected,
      confidence: modeResult.confidence,
      reasons: modeResult.reasons,
      usedDialectic: false,
      tokensUsed: 0,
    };

    // Route based on mode
    if (requiresDialectic(modeResult.mode)) {
      if (!this.dialecticDeps) {
        throw new Error(
          `Mode ${modeResult.displayName} requires dialectic execution, but dependencies are not configured. ` +
            'Call setDialecticDependencies() first.',
        );
      }

      result.usedDialectic = true;
      result.taskResult = await this.executeDialectic(
        prompt,
        modeResult.mode,
        options,
      );
      // Token usage would be tracked separately if needed
    }

    return result;
  }

  /**
   * Execute using the dialectic controller.
   */
  private async executeDialectic(
    prompt: string,
    _mode: InternalMode,
    options: {
      taskDescription?: Partial<TaskDescription>;
      controllerConfig?: Partial<ControllerConfig>;
    } = {},
  ): Promise<TaskResult> {
    // Ensure dialectic controller is initialized
    if (!this.dialecticController) {
      this.initializeDialecticController(options.controllerConfig);
    }

    if (!this.dialecticController) {
      throw new Error('Failed to initialize dialectic controller');
    }

    // Build task description
    const taskDescription: TaskDescription = {
      id: `task-${Date.now()}`,
      description: prompt,
      originalPrompt: prompt,
      ...options.taskDescription,
    };

    // Execute
    return this.dialecticController.execute(taskDescription);
  }

  /**
   * Handle events from the dialectic controller.
   */
  private handleControllerEvent(event: ControllerEvent): void {
    // Check for escalation triggers
    if (this.escalationManager && event.type === 'round_end' && event.result) {
      const escalationCheck = this.escalationManager.checkEscalation(
        event.result,
      );

      if (escalationCheck.shouldEscalate && escalationCheck.newMode) {
        this.escalationManager.escalate(
          escalationCheck.newMode,
          escalationCheck.reason ?? 'Automatic escalation',
          escalationCheck.trigger ?? 'multiple_rounds',
        );

        this.config.onModeEscalated?.(
          this.currentMode,
          escalationCheck.newMode,
          escalationCheck.reason ?? 'Automatic escalation',
        );

        this.currentMode = escalationCheck.newMode;
      }
    }
  }

  /**
   * Get the current execution mode.
   */
  getCurrentMode(): InternalMode {
    return this.currentMode;
  }

  /**
   * Get mode selection analysis for a prompt without executing.
   */
  analyzePrompt(
    prompt: string,
    options: ModeSelectionOptions = {},
  ): ModeSelectionResult {
    return this.modeSelector.select(prompt, options);
  }

  /**
   * Force escalation to a specific mode.
   */
  forceEscalate(newMode: InternalMode): boolean {
    if (!this.escalationManager) {
      this.escalationManager = new ModeEscalationManager(this.currentMode);
    }

    const event = this.escalationManager.forceEscalate(newMode);
    if (event) {
      this.currentMode = newMode;
      this.config.onModeEscalated?.(event.fromMode, event.toMode, event.reason);
      return true;
    }
    return false;
  }

  /**
   * Reset the coordinator state.
   */
  reset(): void {
    this.currentMode = 'simple';
    this.escalationManager = null;
    this.dialecticController = null;
  }

  /**
   * Get a summary of the current state.
   */
  getSummary(): string {
    const parts: string[] = [`Current mode: ${this.currentMode}`];

    if (this.escalationManager) {
      parts.push(this.escalationManager.getEscalationSummary());
    }

    if (this.dialecticDeps) {
      parts.push('Dialectic dependencies: configured');
    } else {
      parts.push('Dialectic dependencies: not configured');
    }

    return parts.join('\n');
  }
}

/**
 * Create an execution coordinator with default configuration.
 */
export function createExecutionCoordinator(
  config?: Partial<ExecutionCoordinatorConfig>,
): ExecutionCoordinator {
  return new ExecutionCoordinator(config);
}
