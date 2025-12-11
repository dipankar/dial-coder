/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Decision, SessionSummaryData, MemoryConfig } from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import type { ProjectMemory } from './project-memory.js';
import { SessionMemory } from './session-memory.js';

/**
 * Handles memory compaction operations.
 *
 * Compaction involves:
 * - Summarizing sessions into summaries
 * - Removing stale decisions
 * - Merging similar decisions
 * - Updating architecture summaries
 */
export class MemoryCompactor {
  private projectMemory: ProjectMemory;
  private config: MemoryConfig;

  constructor(
    projectMemory: ProjectMemory,
    config: Partial<MemoryConfig> = {},
  ) {
    this.projectMemory = projectMemory;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * Compact a session by generating a summary.
   */
  async compactSession(sessionId: string): Promise<SessionSummaryData | null> {
    const session = await SessionMemory.load(
      sessionId,
      this.projectMemory.getProjectDir(),
    );

    if (!session) {
      return null;
    }

    return session.complete();
  }

  /**
   * Run periodic project memory maintenance.
   */
  async compactProject(): Promise<CompactionResult> {
    const result: CompactionResult = {
      decisionsRemoved: 0,
      decisionsMerged: 0,
      sessionsArchived: 0,
    };

    // 1. Remove stale decisions
    const staleCount = await this.removeStaleDecisions();
    result.decisionsRemoved = staleCount;

    // 2. Merge similar decisions
    const mergedCount = await this.mergeSimilarDecisions();
    result.decisionsMerged = mergedCount;

    // 3. Update architecture summary
    await this.updateArchitectureSummary();

    return result;
  }

  /**
   * Remove stale decisions that are old and never referenced.
   */
  private async removeStaleDecisions(): Promise<number> {
    const decisions = await this.projectMemory.loadDecisions();
    const staleThreshold = new Date();
    staleThreshold.setDate(
      staleThreshold.getDate() - this.config.staleThresholdDays,
    );

    const activeDecisions = decisions.filter((d) => {
      // Keep if referenced
      if (d.metadata.timesReferenced > 0) return true;

      // Keep if high confidence
      if (d.metadata.confidence === 'high') return true;

      // Keep if recent
      const decisionDate = new Date(d.source.date);
      return decisionDate > staleThreshold;
    });

    const removedCount = decisions.length - activeDecisions.length;

    if (removedCount > 0) {
      await this.projectMemory.rewriteDecisions(activeDecisions);
    }

    return removedCount;
  }

  /**
   * Merge similar decisions within the same scope.
   */
  private async mergeSimilarDecisions(): Promise<number> {
    const decisions = await this.projectMemory.loadDecisions();

    // Group by scope
    const byScope = this.groupBy(decisions, (d) => d.scope);
    const mergedDecisions: Decision[] = [];
    let mergeCount = 0;

    for (const [_scope, scopeDecisions] of Object.entries(byScope)) {
      // Only attempt merge if there are many decisions
      if (scopeDecisions.length <= 5) {
        mergedDecisions.push(...scopeDecisions);
        continue;
      }

      // Find duplicates by similarity
      const merged = this.mergeDuplicates(scopeDecisions);
      mergeCount += scopeDecisions.length - merged.length;
      mergedDecisions.push(...merged);
    }

    if (mergeCount > 0) {
      await this.projectMemory.rewriteDecisions(mergedDecisions);
    }

    return mergeCount;
  }

  /**
   * Merge duplicate decisions based on similarity.
   */
  private mergeDuplicates(decisions: Decision[]): Decision[] {
    const merged: Decision[] = [];
    const used = new Set<string>();

    for (const decision of decisions) {
      if (used.has(decision.id)) continue;

      // Find similar decisions
      const similar = decisions.filter(
        (d) =>
          !used.has(d.id) &&
          d.id !== decision.id &&
          this.areSimilar(decision, d),
      );

      if (similar.length > 0) {
        // Merge into one
        const mergedDecision = this.mergeDecisions(decision, similar);
        merged.push(mergedDecision);

        // Mark all as used
        used.add(decision.id);
        for (const s of similar) {
          used.add(s.id);
        }
      } else {
        merged.push(decision);
        used.add(decision.id);
      }
    }

    return merged;
  }

  /**
   * Check if two decisions are similar enough to merge.
   */
  private areSimilar(a: Decision, b: Decision): boolean {
    if (a.type !== b.type) return false;
    if (a.scope !== b.scope) return false;

    // Simple similarity: check if summaries share significant words
    const wordsA = this.extractKeywords(a.summary);
    const wordsB = this.extractKeywords(b.summary);

    const intersection = wordsA.filter((w) => wordsB.includes(w));
    const union = [...new Set([...wordsA, ...wordsB])];

    // Jaccard similarity > 0.5
    return intersection.length / union.length > 0.5;
  }

  /**
   * Extract keywords from text.
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'and',
      'but',
      'or',
      'nor',
      'so',
      'yet',
      'both',
      'either',
      'neither',
      'not',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'also',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Merge multiple decisions into one.
   */
  private mergeDecisions(primary: Decision, others: Decision[]): Decision {
    // Combine reasoning
    const allReasoning = [primary.reasoning, ...others.map((o) => o.reasoning)];
    const uniqueReasoning = [...new Set(allReasoning)];

    // Combine examples
    const allExamples = [
      ...(primary.examples || []),
      ...others.flatMap((o) => o.examples || []),
    ];
    const uniqueExamples = [...new Set(allExamples)];

    // Use highest confidence
    const confidences = [
      primary.metadata.confidence,
      ...others.map((o) => o.metadata.confidence),
    ];
    const bestConfidence = confidences.includes('high')
      ? 'high'
      : confidences.includes('medium')
        ? 'medium'
        : 'low';

    // Sum references
    const totalReferences =
      primary.metadata.timesReferenced +
      others.reduce((sum, o) => sum + o.metadata.timesReferenced, 0);

    return {
      ...primary,
      reasoning: uniqueReasoning.join(' '),
      examples: uniqueExamples.length > 0 ? uniqueExamples : undefined,
      metadata: {
        confidence: bestConfidence,
        timesReferenced: totalReferences,
        lastReferenced:
          primary.metadata.lastReferenced ||
          others.find((o) => o.metadata.lastReferenced)?.metadata
            .lastReferenced,
      },
    };
  }

  /**
   * Update the architecture summary based on current decisions.
   */
  private async updateArchitectureSummary(): Promise<void> {
    const decisions = await this.projectMemory.loadDecisions();

    // Group by type
    const invariants = decisions.filter((d) => d.type === 'invariant');
    const patterns = decisions.filter((d) => d.type === 'pattern');
    const antiPatterns = decisions.filter((d) => d.type === 'anti_pattern');

    let content = '# Project Architecture\n\n';
    content += '*Auto-generated from project decisions*\n\n';

    if (invariants.length > 0) {
      content += '## Invariants\n\n';
      content += 'These rules must always be followed:\n\n';
      for (const inv of invariants) {
        content += `- **${inv.scope}**: ${inv.summary}\n`;
      }
      content += '\n';
    }

    if (patterns.length > 0) {
      content += '## Patterns\n\n';
      content += 'Established patterns in this codebase:\n\n';
      for (const pat of patterns) {
        content += `### ${pat.scope}\n`;
        content += `${pat.summary}\n\n`;
        if (pat.examples && pat.examples.length > 0) {
          content += '```\n' + pat.examples[0] + '\n```\n\n';
        }
      }
    }

    if (antiPatterns.length > 0) {
      content += '## Anti-Patterns\n\n';
      content += 'Avoid these patterns:\n\n';
      for (const ap of antiPatterns) {
        content += `- **${ap.scope}**: ${ap.summary}\n`;
        content += `  - Reason: ${ap.reasoning}\n`;
      }
      content += '\n';
    }

    await this.projectMemory.saveArchitectureSummary(content);
  }

  /**
   * Group array items by a key function.
   */
  private groupBy<T>(
    array: T[],
    keyFn: (item: T) => string,
  ): Record<string, T[]> {
    const groups: Record<string, T[]> = {};
    for (const item of array) {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    return groups;
  }
}

/**
 * Result of a compaction operation.
 */
export interface CompactionResult {
  decisionsRemoved: number;
  decisionsMerged: number;
  sessionsArchived: number;
}
