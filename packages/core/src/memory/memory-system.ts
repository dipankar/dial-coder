/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  MemoryConfig,
  Decision,
  SessionSummaryData,
  ModuleMemoryData,
  ProblemContext,
  TaskInfo,
  SessionDecision,
  Pattern,
  RoundMemoryData,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import type { RoundMemory } from './round-memory.js';
import { SessionMemory } from './session-memory.js';
import { ProjectMemory } from './project-memory.js';
import { MemoryCompactor } from './compaction.js';
import { MemorySearch, type SearchResult } from './search.js';
import {
  TokenBudget,
  formatDecisionsForPrompt,
  formatInvariantsForPrompt,
  formatModuleForPrompt,
} from './budget.js';

/**
 * Context assembled for agent prompts.
 */
export interface AgentContext {
  task: TaskInfo;
  decisions: string;
  invariants: string;
  moduleContext: string;
  previousRounds: string;
  failures?: string;
  tokenUsage: number;
}

/**
 * Unified memory system interface.
 *
 * The MemorySystem provides a high-level interface for all memory operations,
 * coordinating between round, session, and project memory layers.
 */
export class MemorySystem {
  private projectMemory: ProjectMemory;
  private currentSession: SessionMemory | null = null;
  private compactor: MemoryCompactor;
  private search: MemorySearch;
  private config: MemoryConfig;

  constructor(
    projectDir: string = process.cwd(),
    config: Partial<MemoryConfig> = {},
  ) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.projectMemory = new ProjectMemory(projectDir);
    this.compactor = new MemoryCompactor(this.projectMemory, this.config);
    this.search = new MemorySearch(this.projectMemory);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the memory system for a project.
   */
  async initialize(): Promise<void> {
    await this.projectMemory.initialize();
  }

  /**
   * Check if memory is initialized for this project.
   */
  async isInitialized(): Promise<boolean> {
    return this.projectMemory.exists();
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Start a new session.
   */
  async startSession(task: TaskInfo): Promise<SessionMemory> {
    this.currentSession = new SessionMemory(this.projectMemory.getProjectDir());
    await this.currentSession.initialize();
    this.currentSession.setTask(task);
    return this.currentSession;
  }

  /**
   * Get the current session.
   */
  getCurrentSession(): SessionMemory | null {
    return this.currentSession;
  }

  /**
   * Get the round memory for the current session.
   */
  getRoundMemory(): RoundMemory | null {
    return this.currentSession?.getRoundMemory() || null;
  }

  /**
   * End the current session and generate summary.
   */
  async endSession(): Promise<SessionSummaryData | null> {
    if (!this.currentSession) {
      return null;
    }

    const summary = await this.currentSession.complete();

    // Extract and save high-confidence decisions to project memory
    for (const decision of summary.learnings.decisionsMade) {
      if (decision.confidence !== 'low') {
        await this.projectMemory.addDecision(decision, summary.sessionId);
      }
    }

    // Auto-compact if enabled
    if (this.config.autoCompact) {
      await this.compactor.compactProject();
    }

    this.currentSession = null;
    return summary;
  }

  /**
   * Load an existing session.
   */
  async loadSession(sessionId: string): Promise<SessionMemory | null> {
    const session = await SessionMemory.load(
      sessionId,
      this.projectMemory.getProjectDir(),
    );
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  // ============================================================================
  // Round Management
  // ============================================================================

  /**
   * Start a new round in the current session.
   */
  startRound(taskId: string, problem: ProblemContext): RoundMemoryData | null {
    const roundMemory = this.getRoundMemory();
    if (!roundMemory) {
      return null;
    }

    const roundNumber = roundMemory.getRoundCount() + 1;
    return roundMemory.createRound(taskId, roundNumber, problem);
  }

  /**
   * Save the current round.
   */
  async saveRound(roundNumber: number): Promise<void> {
    const roundMemory = this.getRoundMemory();
    if (roundMemory) {
      await roundMemory.saveRound(roundNumber);
    }
  }

  // ============================================================================
  // Context Assembly
  // ============================================================================

  /**
   * Build context for the proposer agent.
   */
  async buildProposerContext(
    task: TaskInfo,
    maxTokens: number = 4000,
  ): Promise<AgentContext> {
    const budget = new TokenBudget(maxTokens);
    const scopes = this.extractScopes(task.filesTouched);

    // Load relevant decisions
    const decisions = await this.projectMemory.getDecisions(scopes);

    // Load invariants
    const invariants = await this.projectMemory.getInvariants();

    // Load module memory
    const relevantModules = await this.search.findRelevantModules(
      task.filesTouched,
    );
    const moduleContext = relevantModules
      .map((m) => formatModuleForPrompt(m))
      .join('\n\n');

    // Load micro-summaries from current session
    let previousRounds = 'This is the first round.';
    const roundMemory = this.getRoundMemory();
    if (roundMemory) {
      const summaries = await roundMemory.loadMicroSummaries();
      if (summaries.length > 0) {
        previousRounds = summaries
          .map((m) => `Round ${m.round}: ${m.keyDecision} (${m.outcome})`)
          .join('\n');
      }
    }

    // Format failures if any
    let failures: string | undefined;
    if (roundMemory?.hasFailures()) {
      const failedRounds = roundMemory
        .getAllRounds()
        .filter((r) => r.outcome === 'failed');
      failures = failedRounds
        .map(
          (r) =>
            `Round ${r.round}: ${r.verification.failures[0]?.error || 'Unknown failure'}`,
        )
        .join('\n');
    }

    // Calculate token usage
    const content = [
      formatDecisionsForPrompt(decisions),
      formatInvariantsForPrompt(invariants),
      moduleContext,
      previousRounds,
      failures || '',
    ].join('\n');
    const tokenUsage = budget.estimateTokens(content);

    return {
      task,
      decisions: formatDecisionsForPrompt(decisions),
      invariants: formatInvariantsForPrompt(invariants),
      moduleContext,
      previousRounds,
      failures,
      tokenUsage,
    };
  }

  /**
   * Build context for the critic agent.
   */
  async buildCriticContext(
    task: TaskInfo,
    maxTokens: number = 4000,
  ): Promise<{
    antiPatterns: string;
    decisions: string;
    tokenUsage: number;
  }> {
    const budget = new TokenBudget(maxTokens);
    const scopes = this.extractScopes(task.filesTouched);

    const antiPatterns = await this.projectMemory.getAntiPatterns(scopes);
    const decisions = await this.projectMemory.getDecisions(scopes);

    const antiPatternsText =
      antiPatterns.length > 0
        ? antiPatterns.map((a) => `- ${a.summary}`).join('\n')
        : 'None recorded.';

    const content = [
      antiPatternsText,
      formatDecisionsForPrompt(decisions),
    ].join('\n');
    const tokenUsage = budget.estimateTokens(content);

    return {
      antiPatterns: antiPatternsText,
      decisions: formatDecisionsForPrompt(decisions),
      tokenUsage,
    };
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search decisions by query.
   */
  async searchDecisions(
    query: string,
    limit?: number,
  ): Promise<Array<SearchResult<Decision>>> {
    return this.search.searchDecisions(query, limit);
  }

  /**
   * Search sessions by query.
   */
  async searchSessions(
    query: string,
    limit?: number,
  ): Promise<Array<SearchResult<SessionSummaryData>>> {
    return this.search.searchSessions(query, limit);
  }

  /**
   * Find similar past sessions.
   */
  async findSimilarSessions(
    files: string[],
    limit?: number,
  ): Promise<SessionSummaryData[]> {
    return this.search.findSimilarSessions(files, limit);
  }

  // ============================================================================
  // Project Memory Operations
  // ============================================================================

  /**
   * Add a decision to project memory.
   */
  async addDecision(
    decision: SessionDecision,
    sessionId: string,
  ): Promise<void> {
    await this.projectMemory.addDecision(decision, sessionId);
  }

  /**
   * Get all invariants.
   */
  async getInvariants(): Promise<string[]> {
    return this.projectMemory.getInvariants();
  }

  /**
   * Get decisions for scopes.
   */
  async getDecisions(scopes: string[]): Promise<Decision[]> {
    return this.projectMemory.getDecisions(scopes);
  }

  /**
   * Get module memory.
   */
  async getModuleMemory(moduleName: string): Promise<ModuleMemoryData | null> {
    return this.projectMemory.loadModuleMemory(moduleName);
  }

  /**
   * Update module memory.
   */
  async updateModuleMemory(
    moduleName: string,
    updates: Partial<Omit<ModuleMemoryData, 'module' | 'lastUpdated'>>,
  ): Promise<ModuleMemoryData> {
    return this.projectMemory.updateModuleMemory(moduleName, updates);
  }

  /**
   * Add a pattern to a module.
   */
  async addModulePattern(moduleName: string, pattern: Pattern): Promise<void> {
    await this.projectMemory.addModulePattern(moduleName, pattern);
  }

  // ============================================================================
  // Compaction Operations
  // ============================================================================

  /**
   * Run project memory compaction.
   */
  async compact(): Promise<{
    decisionsRemoved: number;
    decisionsMerged: number;
  }> {
    return this.compactor.compactProject();
  }

  // ============================================================================
  // Recent Sessions
  // ============================================================================

  /**
   * Get recent session summaries.
   */
  async getRecentSessions(limit?: number): Promise<SessionSummaryData[]> {
    return SessionMemory.getRecentSessions(
      limit || this.config.maxRecentSessions,
      this.projectMemory.getProjectDir(),
    );
  }

  /**
   * List all session IDs.
   */
  async listSessions(): Promise<string[]> {
    return SessionMemory.listSessions(this.projectMemory.getProjectDir());
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Extract scopes from file paths.
   */
  private extractScopes(files: string[]): string[] {
    const scopes = new Set<string>();

    for (const file of files) {
      // Extract directory components as potential scopes
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
   * Get the project memory instance.
   */
  getProjectMemory(): ProjectMemory {
    return this.projectMemory;
  }

  /**
   * Get the memory search instance.
   */
  getSearch(): MemorySearch {
    return this.search;
  }

  /**
   * Get the compactor instance.
   */
  getCompactor(): MemoryCompactor {
    return this.compactor;
  }
}
