/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dial Memory System
 *
 * Hierarchical memory for preserving context across rounds, sessions, and projects.
 *
 * @module memory
 */

// Types
export * from './types.js';

// Core memory classes
export { RoundMemory } from './round-memory.js';
export { SessionMemory } from './session-memory.js';
export { ProjectMemory } from './project-memory.js';

// Memory operations
export { MemoryCompactor, type CompactionResult } from './compaction.js';
export { MemorySearch, type SearchResult } from './search.js';
export {
  TokenBudget,
  type BudgetAllocation,
  createMemoryLoaders,
  formatDecisionsForPrompt,
  formatInvariantsForPrompt,
  formatModuleForPrompt,
} from './budget.js';

// Main interface
export { MemorySystem, type AgentContext } from './memory-system.js';
