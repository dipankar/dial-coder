/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  Decision,
  ModuleMemoryData,
  SessionDecision,
  Pattern,
  ModuleIssue,
  RecentChange,
} from './types.js';

/**
 * Manages project-level persistent memory.
 *
 * Project memory lives in .dial/ and includes:
 * - Architecture summaries (ARCHITECTURE.md)
 * - Decision records (decisions.jsonl)
 * - Module-specific patterns and invariants
 */
export class ProjectMemory {
  private projectDir: string;
  private dialDir: string;
  private decisionsCache: Decision[] | null = null;
  private moduleCache: Map<string, ModuleMemoryData> = new Map();

  constructor(projectDir: string = process.cwd()) {
    this.projectDir = projectDir;
    this.dialDir = path.join(projectDir, '.dial');
  }

  /**
   * Initialize the project memory directory structure.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.dialDir, 'project', 'modules'), {
      recursive: true,
    });
    await fs.mkdir(path.join(this.dialDir, 'sessions'), { recursive: true });

    // Create empty decisions file if it doesn't exist
    const decisionsPath = path.join(this.dialDir, 'project', 'decisions.jsonl');
    try {
      await fs.access(decisionsPath);
    } catch {
      await fs.writeFile(decisionsPath, '', 'utf-8');
    }
  }

  /**
   * Check if project memory exists.
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.dialDir);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Decision Management
  // ============================================================================

  /**
   * Load all decisions from the JSONL file.
   */
  async loadDecisions(): Promise<Decision[]> {
    if (this.decisionsCache) {
      return this.decisionsCache;
    }

    const filePath = path.join(this.dialDir, 'project', 'decisions.jsonl');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.decisionsCache = content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Decision);
      return this.decisionsCache;
    } catch {
      this.decisionsCache = [];
      return [];
    }
  }

  /**
   * Get decisions filtered by scope.
   */
  async getDecisions(scopes: string[]): Promise<Decision[]> {
    const allDecisions = await this.loadDecisions();
    return allDecisions.filter(
      (d) => scopes.includes(d.scope) || d.scope === 'global',
    );
  }

  /**
   * Get invariants (decisions of type 'invariant').
   */
  async getInvariants(): Promise<string[]> {
    const decisions = await this.loadDecisions();
    return decisions
      .filter((d) => d.type === 'invariant')
      .map((d) => d.summary);
  }

  /**
   * Get anti-patterns for specific scopes.
   */
  async getAntiPatterns(scopes: string[]): Promise<Decision[]> {
    const decisions = await this.getDecisions(scopes);
    return decisions.filter((d) => d.type === 'anti_pattern');
  }

  /**
   * Get patterns for specific scopes.
   */
  async getPatterns(scopes: string[]): Promise<Decision[]> {
    const decisions = await this.getDecisions(scopes);
    return decisions.filter((d) => d.type === 'pattern');
  }

  /**
   * Add a new decision from a session.
   */
  async addDecision(
    decision: SessionDecision,
    sessionId: string,
    round?: number,
  ): Promise<void> {
    const projectDecision: Decision = {
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scope: decision.scope,
      type: decision.type === 'trade_off' ? 'heuristic' : decision.type,
      summary: decision.summary,
      reasoning: decision.reasoning,
      source: {
        sessionId,
        round,
        date: new Date().toISOString().split('T')[0],
      },
      metadata: {
        confidence: decision.confidence,
        timesReferenced: 0,
      },
    };

    await this.appendDecision(projectDecision);
  }

  /**
   * Append a decision to the JSONL file.
   */
  private async appendDecision(decision: Decision): Promise<void> {
    const filePath = path.join(this.dialDir, 'project', 'decisions.jsonl');
    await fs.appendFile(filePath, JSON.stringify(decision) + '\n', 'utf-8');

    // Invalidate cache
    this.decisionsCache = null;
  }

  /**
   * Update a decision's reference count.
   */
  async markDecisionReferenced(decisionId: string): Promise<void> {
    const decisions = await this.loadDecisions();
    const decision = decisions.find((d) => d.id === decisionId);

    if (decision) {
      decision.metadata.timesReferenced++;
      decision.metadata.lastReferenced = new Date().toISOString();
      await this.rewriteDecisions(decisions);
    }
  }

  /**
   * Rewrite all decisions (used after modifications).
   */
  async rewriteDecisions(decisions: Decision[]): Promise<void> {
    const filePath = path.join(this.dialDir, 'project', 'decisions.jsonl');
    const content = decisions.map((d) => JSON.stringify(d)).join('\n') + '\n';
    await fs.writeFile(filePath, content, 'utf-8');
    this.decisionsCache = decisions;
  }

  // ============================================================================
  // Module Memory Management
  // ============================================================================

  /**
   * Load module memory.
   */
  async loadModuleMemory(moduleName: string): Promise<ModuleMemoryData | null> {
    if (this.moduleCache.has(moduleName)) {
      return this.moduleCache.get(moduleName)!;
    }

    const filePath = path.join(
      this.dialDir,
      'project',
      'modules',
      `${moduleName}.json`,
    );

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const module = JSON.parse(content) as ModuleMemoryData;
      this.moduleCache.set(moduleName, module);
      return module;
    } catch {
      return null;
    }
  }

  /**
   * Save module memory.
   */
  async saveModuleMemory(module: ModuleMemoryData): Promise<void> {
    const filePath = path.join(
      this.dialDir,
      'project',
      'modules',
      `${module.module}.json`,
    );
    await fs.writeFile(filePath, JSON.stringify(module, null, 2), 'utf-8');
    this.moduleCache.set(module.module, module);
  }

  /**
   * Create or update module memory.
   */
  async updateModuleMemory(
    moduleName: string,
    updates: Partial<Omit<ModuleMemoryData, 'module' | 'lastUpdated'>>,
  ): Promise<ModuleMemoryData> {
    let module = await this.loadModuleMemory(moduleName);

    if (!module) {
      module = {
        module: moduleName,
        lastUpdated: new Date().toISOString(),
        description: '',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      };
    }

    // Apply updates
    Object.assign(module, updates, {
      lastUpdated: new Date().toISOString(),
    });

    await this.saveModuleMemory(module);
    return module;
  }

  /**
   * Add a pattern to a module.
   */
  async addModulePattern(moduleName: string, pattern: Pattern): Promise<void> {
    const module = await this.loadModuleMemory(moduleName);
    if (module) {
      module.patterns.push(pattern);
      module.lastUpdated = new Date().toISOString();
      await this.saveModuleMemory(module);
    }
  }

  /**
   * Add an invariant to a module.
   */
  async addModuleInvariant(
    moduleName: string,
    invariant: string,
  ): Promise<void> {
    const module = await this.loadModuleMemory(moduleName);
    if (module && !module.invariants.includes(invariant)) {
      module.invariants.push(invariant);
      module.lastUpdated = new Date().toISOString();
      await this.saveModuleMemory(module);
    }
  }

  /**
   * Add a known issue to a module.
   */
  async addModuleIssue(moduleName: string, issue: ModuleIssue): Promise<void> {
    const module = await this.loadModuleMemory(moduleName);
    if (module) {
      module.commonIssues.push(issue);
      module.lastUpdated = new Date().toISOString();
      await this.saveModuleMemory(module);
    }
  }

  /**
   * Record a recent change to a module.
   */
  async recordModuleChange(
    moduleName: string,
    change: RecentChange,
  ): Promise<void> {
    const module = await this.loadModuleMemory(moduleName);
    if (module) {
      module.recentChanges.unshift(change);
      // Keep only last 10 changes
      module.recentChanges = module.recentChanges.slice(0, 10);
      module.lastUpdated = new Date().toISOString();
      await this.saveModuleMemory(module);
    }
  }

  /**
   * List all module names.
   */
  async listModules(): Promise<string[]> {
    const modulesDir = path.join(this.dialDir, 'project', 'modules');

    try {
      const files = await fs.readdir(modulesDir);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Load all modules.
   */
  async loadAllModules(): Promise<ModuleMemoryData[]> {
    const moduleNames = await this.listModules();
    const modules: ModuleMemoryData[] = [];

    for (const name of moduleNames) {
      const module = await this.loadModuleMemory(name);
      if (module) {
        modules.push(module);
      }
    }

    return modules;
  }

  // ============================================================================
  // Architecture Summary
  // ============================================================================

  /**
   * Load the architecture summary.
   */
  async loadArchitectureSummary(): Promise<string | null> {
    const filePath = path.join(this.dialDir, 'project', 'ARCHITECTURE.md');

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Save the architecture summary.
   */
  async saveArchitectureSummary(content: string): Promise<void> {
    const filePath = path.join(this.dialDir, 'project', 'ARCHITECTURE.md');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Update the architecture summary with new information.
   */
  async appendToArchitectureSummary(
    section: string,
    content: string,
  ): Promise<void> {
    let current = await this.loadArchitectureSummary();
    if (!current) {
      current = '# Project Architecture\n\n';
    }

    // Check if section already exists
    const sectionHeader = `## ${section}`;
    if (current.includes(sectionHeader)) {
      // Append to existing section
      const sectionIndex = current.indexOf(sectionHeader);
      const nextSectionIndex = current.indexOf('\n## ', sectionIndex + 1);
      const insertPoint =
        nextSectionIndex > 0 ? nextSectionIndex : current.length;
      current =
        current.slice(0, insertPoint) +
        '\n' +
        content +
        '\n' +
        current.slice(insertPoint);
    } else {
      // Add new section
      current += `\n${sectionHeader}\n\n${content}\n`;
    }

    await this.saveArchitectureSummary(current);
  }

  // ============================================================================
  // DIAL.md Management
  // ============================================================================

  /**
   * Load DIAL.md (project context file).
   */
  async loadDialMd(): Promise<string | null> {
    const filePath = path.join(this.dialDir, 'DIAL.md');

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Save DIAL.md.
   */
  async saveDialMd(content: string): Promise<void> {
    const filePath = path.join(this.dialDir, 'DIAL.md');
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Get the project directory.
   */
  getProjectDir(): string {
    return this.projectDir;
  }

  /**
   * Get the .dial directory path.
   */
  getDialDir(): string {
    return this.dialDir;
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.decisionsCache = null;
    this.moduleCache.clear();
  }
}
