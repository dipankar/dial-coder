/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  RoundMemoryData,
  MicroSummary,
  ProblemContext,
  ThesisData,
  AntithesisData,
  SynthesisData,
  VerificationData,
} from './types.js';

/**
 * Manages per-round memory storage.
 *
 * Round memory is ephemeral and lives for the duration of a task.
 * It stores the full thesis/antithesis/synthesis data, tool calls,
 * and test results.
 */
export class RoundMemory {
  private sessionId: string;
  private baseDir: string;
  private rounds: Map<number, RoundMemoryData> = new Map();

  constructor(sessionId: string, projectDir: string = process.cwd()) {
    this.sessionId = sessionId;
    this.baseDir = path.join(projectDir, '.dial', 'sessions', sessionId);
  }

  /**
   * Initialize the round memory directory.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Create a new round with initial problem context.
   */
  createRound(
    taskId: string,
    roundNumber: number,
    problem: ProblemContext,
  ): RoundMemoryData {
    const round: RoundMemoryData = {
      taskId,
      round: roundNumber,
      timestamp: new Date().toISOString(),
      problem,
      thesis: {
        summary: '',
        approach: '',
        patches: [],
        risks: [],
        tokenUsage: 0,
      },
      antithesis: {
        overallAssessment: 'acceptable',
        strengths: [],
        issues: [],
        missingConsiderations: [],
        tokenUsage: 0,
      },
      synthesis: {
        resolutionSummary: '',
        decisions: [],
        finalPatches: [],
        confidence: 'medium',
        tokenUsage: 0,
      },
      verification: {
        testsRun: [],
        passed: false,
        failures: [],
        output: '',
      },
      outcome: 'partial',
    };

    this.rounds.set(roundNumber, round);
    return round;
  }

  /**
   * Get a specific round.
   */
  getRound(roundNumber: number): RoundMemoryData | undefined {
    return this.rounds.get(roundNumber);
  }

  /**
   * Get all rounds.
   */
  getAllRounds(): RoundMemoryData[] {
    return Array.from(this.rounds.values()).sort((a, b) => a.round - b.round);
  }

  /**
   * Get the current (latest) round.
   */
  getCurrentRound(): RoundMemoryData | undefined {
    const rounds = this.getAllRounds();
    return rounds.length > 0 ? rounds[rounds.length - 1] : undefined;
  }

  /**
   * Update thesis data for a round.
   */
  updateThesis(roundNumber: number, thesis: ThesisData): void {
    const round = this.rounds.get(roundNumber);
    if (round) {
      round.thesis = thesis;
    }
  }

  /**
   * Update antithesis data for a round.
   */
  updateAntithesis(roundNumber: number, antithesis: AntithesisData): void {
    const round = this.rounds.get(roundNumber);
    if (round) {
      round.antithesis = antithesis;
    }
  }

  /**
   * Update synthesis data for a round.
   */
  updateSynthesis(roundNumber: number, synthesis: SynthesisData): void {
    const round = this.rounds.get(roundNumber);
    if (round) {
      round.synthesis = synthesis;
    }
  }

  /**
   * Update verification data for a round.
   */
  updateVerification(
    roundNumber: number,
    verification: VerificationData,
  ): void {
    const round = this.rounds.get(roundNumber);
    if (round) {
      round.verification = verification;
    }
  }

  /**
   * Set the outcome for a round.
   */
  setOutcome(
    roundNumber: number,
    outcome: 'success' | 'partial' | 'failed',
  ): void {
    const round = this.rounds.get(roundNumber);
    if (round) {
      round.outcome = outcome;
    }
  }

  /**
   * Save a round to disk.
   */
  async saveRound(roundNumber: number): Promise<void> {
    const round = this.rounds.get(roundNumber);
    if (!round) {
      throw new Error(`Round ${roundNumber} not found`);
    }

    const filename = `round_${roundNumber.toString().padStart(3, '0')}.json`;
    const filePath = path.join(this.baseDir, filename);

    await fs.writeFile(filePath, JSON.stringify(round, null, 2), 'utf-8');

    // Also append micro-summary
    const microSummary = this.extractMicroSummary(round);
    await this.appendMicroSummary(microSummary);
  }

  /**
   * Load a round from disk.
   */
  async loadRound(roundNumber: number): Promise<RoundMemoryData | null> {
    const filename = `round_${roundNumber.toString().padStart(3, '0')}.json`;
    const filePath = path.join(this.baseDir, filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const round = JSON.parse(content) as RoundMemoryData;
      this.rounds.set(roundNumber, round);
      return round;
    } catch {
      return null;
    }
  }

  /**
   * Load all rounds from disk.
   */
  async loadAllRounds(): Promise<RoundMemoryData[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const roundFiles = files.filter(
        (f) => f.startsWith('round_') && f.endsWith('.json'),
      );

      for (const file of roundFiles) {
        const roundNumber = parseInt(
          file.replace('round_', '').replace('.json', ''),
          10,
        );
        await this.loadRound(roundNumber);
      }

      return this.getAllRounds();
    } catch {
      return [];
    }
  }

  /**
   * Extract a micro-summary from a round.
   */
  extractMicroSummary(round: RoundMemoryData): MicroSummary {
    // Find the most important decision
    let keyDecision = round.synthesis.resolutionSummary;
    if (round.synthesis.decisions.length > 0) {
      const accepted = round.synthesis.decisions.find(
        (d) => d.resolution === 'accepted',
      );
      if (accepted) {
        keyDecision = accepted.reasoning;
      }
    }

    // Find key failure if any
    let keyFailure: string | undefined;
    if (round.outcome === 'failed' || round.verification.failures.length > 0) {
      keyFailure = round.verification.failures[0]?.error || 'Unknown failure';
    }

    // Find most useful critique insight
    let criticInsight: string | undefined;
    if (round.antithesis.issues.length > 0) {
      const highPriority = round.antithesis.issues.find(
        (i) => i.severity === 'high' || i.severity === 'critical',
      );
      criticInsight =
        highPriority?.suggestion || round.antithesis.issues[0]?.suggestion;
    }

    return {
      round: round.round,
      taskId: round.taskId,
      timestamp: round.timestamp,
      keyDecision,
      keyFailure,
      criticInsight,
      outcome: round.outcome,
    };
  }

  /**
   * Append a micro-summary to the JSONL file.
   */
  private async appendMicroSummary(summary: MicroSummary): Promise<void> {
    const filePath = path.join(this.baseDir, 'micro_summaries.jsonl');
    await fs.appendFile(filePath, JSON.stringify(summary) + '\n', 'utf-8');
  }

  /**
   * Load all micro-summaries for this session.
   */
  async loadMicroSummaries(): Promise<MicroSummary[]> {
    const filePath = path.join(this.baseDir, 'micro_summaries.jsonl');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as MicroSummary);
    } catch {
      return [];
    }
  }

  /**
   * Get total token usage across all rounds.
   */
  getTotalTokenUsage(): number {
    let total = 0;
    for (const round of this.rounds.values()) {
      total += round.thesis.tokenUsage;
      total += round.antithesis.tokenUsage;
      total += round.synthesis.tokenUsage;
    }
    return total;
  }

  /**
   * Check if any round failed.
   */
  hasFailures(): boolean {
    for (const round of this.rounds.values()) {
      if (round.outcome === 'failed') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get the number of rounds.
   */
  getRoundCount(): number {
    return this.rounds.size;
  }
}
