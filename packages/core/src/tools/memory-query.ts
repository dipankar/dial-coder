/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';
import { MemorySystem } from '../memory/memory-system.js';

/**
 * Parameters for the memory_query tool
 */
export interface MemoryQueryToolParams {
  /**
   * The search query (keywords or phrases)
   */
  query: string;

  /**
   * Type of memory to search:
   * - "decisions": Project decisions, patterns, invariants
   * - "sessions": Past session summaries
   * - "modules": Module-specific patterns and invariants
   * - "all": Search across all types (default)
   */
  type?: 'decisions' | 'sessions' | 'modules' | 'all';

  /**
   * Maximum number of results to return (default 5)
   */
  limit?: number;
}

class MemoryQueryToolInvocation extends BaseToolInvocation<
  MemoryQueryToolParams,
  ToolResult
> {
  getDescription(): string {
    return `Query project memory: "${this.params.query}" (${this.params.type || 'all'})`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { query, type = 'all', limit = 5 } = this.params;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return {
        llmContent: 'Error: query parameter is required and must be a non-empty string.',
        returnDisplay: 'Error: query parameter is required.',
        error: {
          message: 'query parameter is required',
          type: ToolErrorType.INVALID_TOOL_PARAMS,
        },
      };
    }

    try {
      const memorySystem = new MemorySystem(process.cwd());
      const initialized = await memorySystem.isInitialized();

      if (!initialized) {
        return {
          llmContent: 'Project memory has not been initialized yet. No decisions, patterns, or session history is available.',
          returnDisplay: 'Project memory not initialized.',
        };
      }

      const sections: string[] = [];

      if (type === 'all' || type === 'decisions') {
        const decisions = await memorySystem.searchDecisions(query, limit);
        if (decisions.length > 0) {
          sections.push('## Decisions & Patterns');
          for (const result of decisions) {
            sections.push(
              `- [${result.item.scope}] ${result.item.summary} (${result.item.type}, confidence: ${result.item.metadata.confidence})`,
            );
            if (result.item.reasoning) {
              sections.push(`  Reasoning: ${result.item.reasoning}`);
            }
            if (result.highlights.length > 0) {
              sections.push(`  Highlights: ${result.highlights.join(' | ')}`);
            }
          }
          sections.push('');
        }
      }

      if (type === 'all' || type === 'sessions') {
        const sessions = await memorySystem.searchSessions(query, limit);
        if (sessions.length > 0) {
          sections.push('## Past Sessions');
          for (const result of sessions) {
            sections.push(
              `- ${result.item.task.interpretedGoal} (${result.item.execution.mode}, ${result.item.execution.roundsExecuted} rounds, ${result.item.execution.finalOutcome})`,
            );
            if (result.item.humanSummary) {
              const summary = result.item.humanSummary.split('\n').slice(0, 3).join(' ');
              sections.push(`  Summary: ${summary}`);
            }
          }
          sections.push('');
        }
      }

      if (type === 'all' || type === 'modules') {
        const search = memorySystem.getSearch();
        const modules = await search.searchModules(query, limit);
        if (modules.length > 0) {
          sections.push('## Modules');
          for (const result of modules) {
            sections.push(`- ${result.item.module}: ${result.item.description || 'No description'}`);
            if (result.item.patterns.length > 0) {
              sections.push(`  Patterns: ${result.item.patterns.map((p) => p.name).join(', ')}`);
            }
          }
          sections.push('');
        }
      }

      if (sections.length === 0) {
        return {
          llmContent: `No memory entries found for query "${query}".`,
          returnDisplay: `No results for "${query}".`,
        };
      }

      const content = sections.join('\n');
      return {
        llmContent: content,
        returnDisplay: `Found results for "${query}".`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error querying memory: ${message}`,
        returnDisplay: 'Error querying memory.',
        error: {
          message,
          type: ToolErrorType.MEMORY_TOOL_EXECUTION_ERROR,
        },
      };
    }
  }
}

/**
 * Query tool for searching project memory (decisions, patterns, sessions).
 */
export class MemoryQueryTool extends BaseDeclarativeTool<
  MemoryQueryToolParams,
  ToolResult
> {
  static readonly Name = ToolNames.MEMORY_QUERY;

  constructor() {
    super(
      MemoryQueryTool.Name,
      ToolDisplayNames.MEMORY_QUERY,
      'Search the project\'s accumulated memory for relevant decisions, patterns, past sessions, and module knowledge. Use this when you need context about how similar tasks were handled, what patterns exist in the codebase, or what decisions have been recorded.',
      Kind.Think,
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — keywords or phrases describing what you need from memory.',
          },
          type: {
            type: 'string',
            enum: ['decisions', 'sessions', 'modules', 'all'],
            description: 'What kind of memory to search. "decisions" = project decisions/patterns/invariants; "sessions" = past session summaries; "modules" = module-specific memory; "all" = everything (default).',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default 5).',
          },
        },
        required: ['query'],
      },
    );
  }

  protected override validateToolParamValues(
    params: MemoryQueryToolParams,
  ): string | null {
    if (!params.query || params.query.trim() === '') {
      return 'Parameter "query" must be a non-empty string.';
    }
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 50)) {
      return 'Parameter "limit" must be between 1 and 50.';
    }
    return null;
  }

  protected createInvocation(
    params: MemoryQueryToolParams,
  ): ToolInvocation<MemoryQueryToolParams, ToolResult> {
    return new MemoryQueryToolInvocation(params);
  }
}
