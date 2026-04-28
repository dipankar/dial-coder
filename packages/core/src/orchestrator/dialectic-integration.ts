/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '../config/config.js';
import type { LLMClient } from '../llm/llm-client.js';
import type { UserMode } from './mode-config.js';
import { toInternalMode } from './mode-config.js';
import { createLLMClientFromContentGenerator } from '../llm/adapters/content-generator-adapter.js';
import { createProviderManager } from '../llm/provider-manager.js';
import { DEFAULT_AGENT_CONFIGS, type AgentsConfig } from '../agents/types.js';
import {
  ExecutionCoordinator,
  type AgentLLMClients,
  type DialecticDependencies,
} from './execution-coordinator.js';
import { MemorySystem } from '../memory/memory-system.js';
import type {
  TaskResult,
  FileContent,
  FinalPatch,
  VerificationResult,
  TaskDescription,
} from '../agents/types.js';
import { requiresDialectic } from './mode-selector.js';
import * as path from 'node:path';
import fs from 'node:fs/promises';
import { StandardFileSystemService } from '../services/fileSystemService.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { ShellExecutionService } from '../services/shellExecutionService.js';
import {
  normalizeEditStrings,
  maybeAugmentOldStringForDeletion,
  countOccurrences,
} from '../utils/editHelper.js';
import { safeLiteralReplace } from '../utils/textUtils.js';
import { globSync } from 'glob';

/**
 * Event types emitted during dialectic execution.
 */
export type DialecticEventType =
  | 'mode_selected'
  | 'round_start'
  | 'thesis_start'
  | 'thesis_complete'
  | 'antithesis_start'
  | 'antithesis_complete'
  | 'synthesis_start'
  | 'synthesis_complete'
  | 'round_complete'
  | 'execution_complete'
  | 'execution_error';

export interface DialecticEvent {
  type: DialecticEventType;
  mode?: UserMode;
  round?: number;
  message?: string;
  data?: unknown;
}

export type DialecticEventHandler = (event: DialecticEvent) => void;

/**
 * Result from dialectic execution.
 */
export interface DialecticExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** The mode that was used */
  mode: UserMode;
  /** Whether dialectic was actually used (vs direct execution) */
  usedDialectic: boolean;
  /** Response text for the user */
  response: string;
  /** Any error that occurred */
  error?: Error;
  /** Task result if dialectic was used */
  taskResult?: TaskResult;
}

/**
 * Integration layer for the dialectic system.
 *
 * This class provides a simple interface for:
 * - Creating the necessary LLM clients from the existing Config
 * - Running dialectic execution for review/safe modes
 * - Emitting events for UI updates
 *
 * @example
 * ```typescript
 * const integration = new DialecticIntegration(config);
 * await integration.initialize();
 *
 * integration.onEvent((event) => {
 *   console.log(`Dialectic: ${event.type} - ${event.message}`);
 * });
 *
 * const result = await integration.execute(prompt, 'review');
 * ```
 */
export class DialecticIntegration {
  private coordinator: ExecutionCoordinator | null = null;
  private llmClient: LLMClient | null = null;
  private eventHandlers: DialecticEventHandler[] = [];
  private initialized = false;

  constructor(private readonly config: Config) {}

  /**
   * Initialize the dialectic system.
   * Must be called before execute().
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const contentGenerator = this.config.getContentGenerator();
    if (!contentGenerator) {
      throw new Error(
        'ContentGenerator not available. Cannot initialize dialectic system.',
      );
    }

    const model = this.config.getModel();

    // Create LLM client from existing ContentGenerator
    this.llmClient = createLLMClientFromContentGenerator(
      contentGenerator,
      model,
      'dialectic-agent',
    );

    // Create coordinator with default config
    this.coordinator = new ExecutionCoordinator({
      autoSelectMode: false, // We'll use the userMode passed in
      enableEscalation: true,
      onModeSelected: (result) => {
        this.emitEvent({
          type: 'mode_selected',
          mode: result.displayName,
          message: `Mode selected: ${result.displayName} (${result.reasons.join(', ')})`,
        });
      },
    });

    // Set up multi-model provider resolution
    const providerManager = createProviderManager(this.config);
    await providerManager.initialize();

    const resolveClient = (role: keyof AgentsConfig): LLMClient => {
      const agentConfig = DEFAULT_AGENT_CONFIGS[role];
      const providerName = agentConfig.llm;
      if (providerName === 'default') {
        try {
          return providerManager.getDefaultClient();
        } catch {
          return this.llmClient!;
        }
      }
      if (providerName === 'fast') {
        for (const fastProvider of ['ollama', 'ollama-cloud']) {
          try {
            return providerManager.getClient(fastProvider);
          } catch {
            // fallback to next
          }
        }
        try {
          return providerManager.getDefaultClient();
        } catch {
          return this.llmClient!;
        }
      }
      try {
        return providerManager.getClient(providerName);
      } catch {
        return this.llmClient!;
      }
    };

    // Set up dialectic dependencies
    const agentClients: AgentLLMClients = {
      proposer: resolveClient('proposer'),
      critic: resolveClient('critic'),
      synthesizer: resolveClient('synthesizer'),
      reflector: resolveClient('reflector'),
    };

    // Create memory system for the project
    const projectRoot = this.config.getProjectRoot() || process.cwd();
    const memorySystem = new MemorySystem(projectRoot);

    const dependencies: DialecticDependencies = {
      llmClients: agentClients,
      memorySystem,
      fileProvider: this.createFileProvider(),
      fileDiscovery: this.createFileDiscovery(),
      verifyFn: this.createVerifyFunction(),
      applyPatchFn: this.createApplyPatchFunction(),
    };

    this.coordinator.setDialecticDependencies(dependencies);
    this.initialized = true;
  }

  /**
   * Check if the dialectic system is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register an event handler.
   */
  onEvent(handler: DialecticEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler.
   */
  offEvent(handler: DialecticEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Execute a prompt with the specified mode.
   *
   * @param prompt - The user's prompt
   * @param userMode - The execution mode (ask/quick/review/safe)
   * @returns Execution result
   */
  async execute(
    prompt: string,
    userMode: UserMode,
  ): Promise<DialecticExecutionResult> {
    if (!this.initialized || !this.coordinator) {
      throw new Error(
        'DialecticIntegration not initialized. Call initialize() first.',
      );
    }

    const internalMode = toInternalMode(userMode);

    // For non-dialectic modes, return early with indicator to use direct execution
    if (!requiresDialectic(internalMode)) {
      return {
        success: true,
        mode: userMode,
        usedDialectic: false,
        response: '', // Caller should use direct LLM execution
      };
    }

    this.emitEvent({
      type: 'round_start',
      mode: userMode,
      round: 1,
      message: `Starting dialectic execution in ${userMode} mode`,
    });

    try {
      // Execute through the coordinator
      const result = await this.coordinator.execute(prompt, {
        userMode,
        taskDescription: {
          id: `task-${Date.now()}`,
          description: prompt,
          originalPrompt: prompt,
        },
      });

      this.emitEvent({
        type: 'execution_complete',
        mode: userMode,
        message: 'Dialectic execution completed',
        data: result,
      });

      // Extract response from task result
      let response = '';
      if (result.taskResult) {
        if (result.taskResult.success) {
          response =
            result.taskResult.summary || 'Task completed successfully.';
        } else {
          response = `Task failed after ${result.taskResult.rounds} rounds: ${result.taskResult.summary}`;
        }
      }

      return {
        success: true,
        mode: userMode,
        usedDialectic: result.usedDialectic,
        response,
        taskResult: result.taskResult,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.emitEvent({
        type: 'execution_error',
        mode: userMode,
        message: `Dialectic execution failed: ${err.message}`,
        data: { error: err },
      });

      return {
        success: false,
        mode: userMode,
        usedDialectic: true,
        response: `Dialectic execution failed: ${err.message}`,
        error: err,
      };
    }
  }

  /**
   * Check if a mode requires dialectic execution.
   */
  requiresDialectic(userMode: UserMode): boolean {
    const internalMode = toInternalMode(userMode);
    return requiresDialectic(internalMode);
  }

  /**
   * Get the current coordinator for advanced usage.
   */
  getCoordinator(): ExecutionCoordinator | null {
    return this.coordinator;
  }

  /**
   * Reset the dialectic system state.
   */
  reset(): void {
    this.coordinator?.reset();
  }

  private emitEvent(event: DialecticEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in dialectic event handler:', e);
      }
    }
  }

  /**
   * Create a file provider that reads files by path.
   * FileProvider signature: (files: string[]) => Promise<FileContent[]>
   */
  private createFileProvider() {
    const fsService = new StandardFileSystemService();
    const projectRoot = this.config.getProjectRoot() || process.cwd();
    return async (files: string[]): Promise<FileContent[]> => {
      const results: FileContent[] = [];

      for (const file of files) {
        try {
          const fullPath = path.resolve(projectRoot, file);
          const content = await fsService.readTextFile(fullPath);
          results.push({ path: file, content });
        } catch {
          // Skip files that can't be read
        }
      }

      return results;
    };
  }

  /**
   * Create a file discovery function.
   * FileDiscoveryFunction signature: (task: TaskDescription) => Promise<string[]>
   * Discovers source files using glob and filters via FileDiscoveryService.
   */
  private createFileDiscovery() {
    const projectRoot = this.config.getProjectRoot() || process.cwd();
    const fileDiscoveryService = new FileDiscoveryService(projectRoot);
    return async (_task: TaskDescription): Promise<string[]> => {
      try {
        const patterns = [
          '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,c,cpp,h,hpp,md,json,yml,yaml}',
        ];
        const allFiles = patterns.flatMap((pattern) =>
          globSync(pattern, {
            cwd: projectRoot,
            nodir: true,
            absolute: false,
          }),
        );
        const uniqueFiles = [...new Set(allFiles)];
        const filtered = fileDiscoveryService.filterFiles(uniqueFiles, {
          respectGitIgnore: true,
          respectQwenIgnore: true,
        });
        return filtered.slice(0, 200);
      } catch {
        return [];
      }
    };
  }

  /**
   * Create a verify function for running tests.
   * VerifyFunction signature: (patches: FinalPatch[], testCommand?: string) => Promise<VerificationResult>
   * Runs the configured test command via ShellExecutionService.
   */
  private createVerifyFunction() {
    const projectRoot = this.config.getProjectRoot() || process.cwd();
    return async (
      _patches: FinalPatch[],
      testCommand?: string,
    ): Promise<VerificationResult> => {
      const command = testCommand || 'npm test';
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const handle = await ShellExecutionService.execute(
          command,
          projectRoot,
          () => {},
          controller.signal,
          false,
          {},
        );
        const result = await handle.result;
        const duration = Date.now() - startTime;
        if (result.exitCode === 0) {
          return {
            success: true,
            testsRun: 1,
            testsPassed: 1,
            testsFailed: 0,
            failingTests: [],
            output: result.output,
            duration,
          };
        }
        return {
          success: false,
          testsRun: 1,
          testsPassed: 0,
          testsFailed: 1,
          failingTests: [`Command failed: ${command}`],
          output:
            result.output || result.error?.message || 'Verification failed',
          duration,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        return {
          success: false,
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          failingTests: [],
          output: error instanceof Error ? error.message : String(error),
          duration,
        };
      }
    };
  }

  /**
   * Create a function for applying patches.
   * ApplyPatchFunction signature: (patch: FinalPatch) => Promise<boolean>
   * Applies edits using EditHelper normalization and FileSystemService.
   */
  private createApplyPatchFunction() {
    const fsService = new StandardFileSystemService();
    const projectRoot = this.config.getProjectRoot() || process.cwd();
    return async (patch: FinalPatch): Promise<boolean> => {
      try {
        const fullPath = path.resolve(projectRoot, patch.file);
        if (patch.action === 'create') {
          await fsService.writeTextFile(fullPath, patch.content || '');
          return true;
        }
        if (patch.action === 'delete') {
          await fs.unlink(fullPath);
          return true;
        }
        // edit
        const currentContent = await fsService.readTextFile(fullPath);
        const search = patch.search || '';
        const replace = patch.replace || '';
        const normalized = normalizeEditStrings(
          currentContent,
          search,
          replace,
        );
        const oldString = maybeAugmentOldStringForDeletion(
          currentContent,
          normalized.oldString,
          normalized.newString,
        );
        if (countOccurrences(currentContent, oldString) === 0) {
          return false;
        }
        const newContent = safeLiteralReplace(
          currentContent,
          oldString,
          normalized.newString,
        );
        await fsService.writeTextFile(fullPath, newContent);
        return true;
      } catch {
        return false;
      }
    };
  }
}

/**
 * Create a dialectic integration instance.
 */
export function createDialecticIntegration(
  config: Config,
): DialecticIntegration {
  return new DialecticIntegration(config);
}
