/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  SessionSummaryData,
  TaskInfo,
  ExecutionMetadata,
  SessionChanges,
  SessionLearnings,
  SessionDecision,
  RoundMemoryData,
  MicroSummary,
} from './types.js';
import { RoundMemory } from './round-memory.js';

/**
 * Manages session-level memory.
 *
 * Session memory is task-scoped and contains:
 * - Task TODO and progress
 * - Accepted decisions
 * - Known pitfalls
 * - Open questions
 *
 * Sessions are archived after completion.
 */
export class SessionMemory {
  private _sessionId: string;
  private _baseDir: string;
  private _projectDir: string;
  private _roundMemory: RoundMemory;
  private taskInfo: TaskInfo | null = null;
  private startTime: Date;

  constructor(projectDir: string = process.cwd()) {
    this._projectDir = projectDir;
    this._sessionId = this.generateSessionId();
    this._baseDir = path.join(projectDir, '.dial', 'sessions', this._sessionId);
    this._roundMemory = new RoundMemory(this._sessionId, projectDir);
    this.startTime = new Date();
  }

  /**
   * Private constructor for loading existing sessions.
   */
  private static createFromExisting(
    sessionId: string,
    projectDir: string,
    sessionDir: string,
  ): SessionMemory {
    const session = new SessionMemory(projectDir);
    session._sessionId = sessionId;
    session._baseDir = sessionDir;
    session._roundMemory = new RoundMemory(sessionId, projectDir);
    return session;
  }

  /**
   * Generate a session ID based on timestamp and task description.
   */
  private generateSessionId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return timestamp;
  }

  /**
   * Initialize the session memory.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this._baseDir, { recursive: true });
    await this._roundMemory.initialize();
  }

  /**
   * Set the task information for this session.
   */
  setTask(task: TaskInfo): void {
    this.taskInfo = task;
  }

  /**
   * Get the round memory manager.
   */
  getRoundMemory(): RoundMemory {
    return this._roundMemory;
  }

  /**
   * Get the session ID.
   */
  getSessionId(): string {
    return this._sessionId;
  }

  /**
   * Load an existing session by ID.
   */
  static async load(
    sessionId: string,
    projectDir: string = process.cwd(),
  ): Promise<SessionMemory | null> {
    const sessionDir = path.join(projectDir, '.dial', 'sessions', sessionId);

    try {
      await fs.access(sessionDir);

      const session = SessionMemory.createFromExisting(
        sessionId,
        projectDir,
        sessionDir,
      );

      // Load round data
      await session._roundMemory.loadAllRounds();

      // Try to load summary if it exists
      const summaryPath = path.join(sessionDir, 'session_summary.json');
      try {
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        const summary = JSON.parse(summaryContent) as SessionSummaryData;
        session.taskInfo = summary.task;
        session.startTime = new Date(summary.createdAt);
      } catch {
        // No summary yet
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * List all available sessions.
   */
  static async listSessions(
    projectDir: string = process.cwd(),
  ): Promise<string[]> {
    const sessionsDir = path.join(projectDir, '.dial', 'sessions');

    try {
      const dirs = await fs.readdir(sessionsDir);
      return dirs.sort().reverse();
    } catch {
      return [];
    }
  }

  /**
   * Get recent sessions with summaries.
   */
  static async getRecentSessions(
    limit: number = 10,
    projectDir: string = process.cwd(),
  ): Promise<SessionSummaryData[]> {
    const sessionIds = await SessionMemory.listSessions(projectDir);
    const summaries: SessionSummaryData[] = [];

    for (const sessionId of sessionIds.slice(0, limit)) {
      const summaryPath = path.join(
        projectDir,
        '.dial',
        'sessions',
        sessionId,
        'session_summary.json',
      );

      try {
        const content = await fs.readFile(summaryPath, 'utf-8');
        summaries.push(JSON.parse(content) as SessionSummaryData);
      } catch {
        // No summary for this session
      }
    }

    return summaries;
  }

  /**
   * Generate and save the session summary.
   */
  async complete(): Promise<SessionSummaryData> {
    if (!this.taskInfo) {
      throw new Error('Task info not set. Call setTask() first.');
    }

    const rounds = this._roundMemory.getAllRounds();
    const microSummaries = await this._roundMemory.loadMicroSummaries();

    const summary = this.generateSummary(rounds, microSummaries);
    await this.saveSummary(summary);

    return summary;
  }

  /**
   * Generate a session summary from rounds and micro-summaries.
   */
  private generateSummary(
    rounds: RoundMemoryData[],
    microSummaries: MicroSummary[],
  ): SessionSummaryData {
    if (!this.taskInfo) {
      throw new Error('Task info not set');
    }

    // Calculate execution metadata
    const execution: ExecutionMetadata = {
      mode: this.determineMode(rounds),
      roundsExecuted: rounds.length,
      totalTokens: this._roundMemory.getTotalTokenUsage(),
      finalOutcome: this.determineFinalOutcome(rounds),
    };

    // Calculate changes
    const changes = this.calculateChanges(rounds);

    // Extract learnings
    const learnings = this.extractLearnings(rounds, microSummaries);

    // Generate human summary
    const humanSummary = this.generateHumanSummary(
      this.taskInfo,
      execution,
      changes,
      learnings,
    );

    return {
      sessionId: this._sessionId,
      taskId: rounds[0]?.taskId || 'unknown',
      createdAt: this.startTime.toISOString(),
      completedAt: new Date().toISOString(),
      task: this.taskInfo,
      execution,
      changes,
      learnings,
      humanSummary,
    };
  }

  /**
   * Determine the execution mode based on rounds.
   */
  private determineMode(rounds: RoundMemoryData[]): ExecutionMetadata['mode'] {
    if (rounds.length === 0) return 'simple';

    // Check if any round has full dialectic data
    const hasFullDialectic = rounds.some(
      (r) =>
        r.thesis.summary &&
        r.antithesis.issues.length > 0 &&
        r.synthesis.decisions.length > 0,
    );

    if (hasFullDialectic && rounds.length > 1) {
      return 'dialectic_full';
    } else if (hasFullDialectic) {
      return 'dialectic_light';
    }

    return 'simple';
  }

  /**
   * Determine the final outcome based on rounds.
   */
  private determineFinalOutcome(
    rounds: RoundMemoryData[],
  ): 'success' | 'partial' | 'failed' {
    if (rounds.length === 0) return 'partial';

    const lastRound = rounds[rounds.length - 1];
    return lastRound.outcome;
  }

  /**
   * Calculate changes made during the session.
   */
  private calculateChanges(rounds: RoundMemoryData[]): SessionChanges {
    const filesCreated = new Set<string>();
    const filesModified = new Set<string>();
    const filesDeleted = new Set<string>();
    let patchesApplied = 0;

    for (const round of rounds) {
      for (const patch of round.synthesis.finalPatches) {
        if (patch.success) {
          patchesApplied++;
          switch (patch.type) {
            case 'create':
              filesCreated.add(patch.file);
              break;
            case 'modify':
              filesModified.add(patch.file);
              break;
            case 'delete':
              filesDeleted.add(patch.file);
              break;
            default:
              // Handle unknown patch types
              break;
          }
        }
      }
    }

    return {
      patchesApplied,
      filesCreated: Array.from(filesCreated),
      filesModified: Array.from(filesModified),
      filesDeleted: Array.from(filesDeleted),
    };
  }

  /**
   * Extract learnings from rounds and micro-summaries.
   */
  private extractLearnings(
    rounds: RoundMemoryData[],
    microSummaries: MicroSummary[],
  ): SessionLearnings {
    const decisionsMade: SessionDecision[] = [];
    const patternsDiscovered: SessionLearnings['patternsDiscovered'] = [];
    const antiPatternsEncountered: SessionLearnings['antiPatternsEncountered'] =
      [];
    const openQuestions: string[] = [];

    // Extract decisions from synthesis
    for (const round of rounds) {
      for (const decision of round.synthesis.decisions) {
        if (decision.resolution === 'accepted') {
          decisionsMade.push({
            scope: round.problem.filesInvolved[0]?.split('/')[0] || 'global',
            type: 'pattern',
            summary: decision.issue,
            reasoning: decision.reasoning,
            confidence: round.synthesis.confidence,
          });
        }
      }

      // Extract anti-patterns from critique
      for (const issue of round.antithesis.issues) {
        if (issue.severity === 'high' || issue.severity === 'critical') {
          antiPatternsEncountered.push({
            name: issue.category,
            description: issue.description,
            consequence: `Found in ${issue.location}`,
            avoidance: issue.suggestion,
          });
        }
      }

      // Extract open questions from missing considerations
      openQuestions.push(...round.antithesis.missingConsiderations);
    }

    // Extract patterns from micro-summaries
    for (const summary of microSummaries) {
      if (summary.patternDiscovered) {
        patternsDiscovered.push({
          name: `Pattern from round ${summary.round}`,
          description: summary.patternDiscovered,
          whenToUse: `When dealing with ${summary.taskId}`,
        });
      }
    }

    return {
      decisionsMade,
      patternsDiscovered,
      antiPatternsEncountered,
      openQuestions: [...new Set(openQuestions)],
    };
  }

  /**
   * Generate a human-readable summary.
   */
  private generateHumanSummary(
    task: TaskInfo,
    execution: ExecutionMetadata,
    changes: SessionChanges,
    learnings: SessionLearnings,
  ): string {
    const lines: string[] = [];

    lines.push(`Task: ${task.interpretedGoal}`);
    lines.push(`Mode: ${execution.mode}, ${execution.roundsExecuted} rounds`);
    lines.push(`Outcome: ${execution.finalOutcome}`);
    lines.push('');

    if (changes.patchesApplied > 0) {
      lines.push(`Changes: ${changes.patchesApplied} patches applied`);
      if (changes.filesCreated.length > 0) {
        lines.push(`  Created: ${changes.filesCreated.join(', ')}`);
      }
      if (changes.filesModified.length > 0) {
        lines.push(`  Modified: ${changes.filesModified.join(', ')}`);
      }
      if (changes.filesDeleted.length > 0) {
        lines.push(`  Deleted: ${changes.filesDeleted.join(', ')}`);
      }
      lines.push('');
    }

    if (learnings.decisionsMade.length > 0) {
      lines.push('Key decisions:');
      for (const decision of learnings.decisionsMade.slice(0, 3)) {
        lines.push(`  - ${decision.summary}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Save the session summary to disk.
   */
  private async saveSummary(summary: SessionSummaryData): Promise<void> {
    const filePath = path.join(this._baseDir, 'session_summary.json');
    await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf-8');
  }

  /**
   * Get the base directory for this session.
   */
  getBaseDir(): string {
    return this._baseDir;
  }

  /**
   * Get the task info.
   */
  getTaskInfo(): TaskInfo | null {
    return this.taskInfo;
  }

  /**
   * Get the project directory.
   */
  getProjectDir(): string {
    return this._projectDir;
  }
}
