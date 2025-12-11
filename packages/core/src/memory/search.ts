/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Decision,
  SessionSummaryData,
  ModuleMemoryData,
} from './types.js';
import type { ProjectMemory } from './project-memory.js';
import { SessionMemory } from './session-memory.js';

/**
 * Search result with relevance score.
 */
export interface SearchResult<T> {
  item: T;
  score: number;
  highlights: string[];
}

/**
 * Handles memory search and retrieval operations.
 *
 * Search capabilities include:
 * - Keyword search over decisions
 * - Semantic search (future: embeddings)
 * - Finding relevant modules
 * - Finding similar past sessions
 */
export class MemorySearch {
  private projectMemory: ProjectMemory;

  constructor(projectMemory: ProjectMemory) {
    this.projectMemory = projectMemory;
  }

  /**
   * Search decisions by keyword.
   */
  async searchDecisions(
    query: string,
    limit: number = 10,
  ): Promise<Array<SearchResult<Decision>>> {
    const decisions = await this.projectMemory.loadDecisions();
    const queryTerms = this.tokenize(query);

    const scored = decisions.map((decision) => {
      const text = `${decision.summary} ${decision.reasoning} ${decision.scope}`;
      const score = this.calculateScore(queryTerms, text);
      const highlights = this.findHighlights(queryTerms, text);

      return { item: decision, score, highlights };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search sessions by keyword.
   */
  async searchSessions(
    query: string,
    limit: number = 10,
  ): Promise<Array<SearchResult<SessionSummaryData>>> {
    const sessions = await SessionMemory.getRecentSessions(
      100,
      this.projectMemory.getProjectDir(),
    );
    const queryTerms = this.tokenize(query);

    const scored = sessions.map((session) => {
      const text = `${session.task.originalPrompt} ${session.task.interpretedGoal} ${session.humanSummary}`;
      const score = this.calculateScore(queryTerms, text);
      const highlights = this.findHighlights(queryTerms, text);

      return { item: session, score, highlights };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find modules relevant to given files.
   */
  async findRelevantModules(files: string[]): Promise<ModuleMemoryData[]> {
    const modules = await this.projectMemory.loadAllModules();

    return modules.filter((module) =>
      module.keyFiles.some((kf) =>
        files.some((f) => f.includes(kf) || kf.includes(f)),
      ),
    );
  }

  /**
   * Find modules by keyword search.
   */
  async searchModules(
    query: string,
    limit: number = 5,
  ): Promise<Array<SearchResult<ModuleMemoryData>>> {
    const modules = await this.projectMemory.loadAllModules();
    const queryTerms = this.tokenize(query);

    const scored = modules.map((module) => {
      const text = `${module.module} ${module.description} ${module.patterns.map((p) => p.name).join(' ')} ${module.invariants.join(' ')}`;
      const score = this.calculateScore(queryTerms, text);
      const highlights = this.findHighlights(queryTerms, text);

      return { item: module, score, highlights };
    });

    return scored
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find past sessions that touched similar files.
   */
  async findSimilarSessions(
    files: string[],
    limit: number = 5,
  ): Promise<SessionSummaryData[]> {
    const sessions = await SessionMemory.getRecentSessions(
      100,
      this.projectMemory.getProjectDir(),
    );

    const scored = sessions.map((session) => ({
      session,
      overlap: this.calculateFileOverlap(files, session.task.filesTouched),
    }));

    return scored
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, limit)
      .filter((s) => s.overlap > 0)
      .map((s) => s.session);
  }

  /**
   * Get decisions relevant to specific scopes, sorted by relevance.
   */
  async getRelevantDecisions(
    scopes: string[],
    query?: string,
  ): Promise<Decision[]> {
    const scopeDecisions = await this.projectMemory.getDecisions(scopes);

    if (!query) {
      // Sort by times referenced
      return scopeDecisions.sort(
        (a, b) => b.metadata.timesReferenced - a.metadata.timesReferenced,
      );
    }

    // If query provided, filter and sort by relevance
    const queryTerms = this.tokenize(query);
    const scored = scopeDecisions.map((decision) => {
      const text = `${decision.summary} ${decision.reasoning}`;
      const score = this.calculateScore(queryTerms, text);
      return { decision, score };
    });

    return scored.sort((a, b) => b.score - a.score).map((s) => s.decision);
  }

  /**
   * Get anti-patterns relevant to a query.
   */
  async getRelevantAntiPatterns(
    scopes: string[],
    query?: string,
  ): Promise<Decision[]> {
    const antiPatterns = await this.projectMemory.getAntiPatterns(scopes);

    if (!query) {
      return antiPatterns;
    }

    const queryTerms = this.tokenize(query);
    const scored = antiPatterns.map((ap) => {
      const text = `${ap.summary} ${ap.reasoning}`;
      const score = this.calculateScore(queryTerms, text);
      return { ap, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.ap);
  }

  /**
   * Tokenize text into search terms.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Calculate relevance score using TF-IDF-like scoring.
   */
  private calculateScore(queryTerms: string[], text: string): number {
    const textLower = text.toLowerCase();
    const textTerms = this.tokenize(text);
    let score = 0;

    for (const term of queryTerms) {
      // Exact match bonus
      if (textLower.includes(term)) {
        score += 2;
      }

      // Term frequency
      const frequency = textTerms.filter((t) => t === term).length;
      if (frequency > 0) {
        score += 1 + Math.log(frequency);
      }

      // Partial match (prefix)
      const prefixMatches = textTerms.filter((t) => t.startsWith(term)).length;
      if (prefixMatches > 0) {
        score += 0.5 * prefixMatches;
      }
    }

    // Normalize by query length
    return score / queryTerms.length;
  }

  /**
   * Find matching snippets for highlighting.
   */
  private findHighlights(queryTerms: string[], text: string): string[] {
    const highlights: string[] = [];
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      for (const term of queryTerms) {
        if (sentenceLower.includes(term)) {
          const trimmed = sentence.trim();
          if (trimmed.length > 0 && !highlights.includes(trimmed)) {
            highlights.push(trimmed);
          }
          break;
        }
      }
    }

    return highlights.slice(0, 3);
  }

  /**
   * Calculate file overlap between two lists.
   */
  private calculateFileOverlap(filesA: string[], filesB: string[]): number {
    if (filesA.length === 0 || filesB.length === 0) return 0;

    // Normalize file paths
    const normalizeFile = (f: string) => f.replace(/\\/g, '/').toLowerCase();
    const setA = new Set(filesA.map(normalizeFile));
    const setB = new Set(filesB.map(normalizeFile));

    // Count direct matches
    let matches = 0;
    for (const file of setA) {
      if (setB.has(file)) {
        matches++;
      } else {
        // Check for partial path matches (same filename in different dirs)
        const fileName = file.split('/').pop();
        for (const fileB of setB) {
          if (fileB.endsWith('/' + fileName) || fileB === fileName) {
            matches += 0.5;
            break;
          }
        }
      }
    }

    // Jaccard-like similarity
    const union = new Set([...setA, ...setB]);
    return matches / union.size;
  }
}
