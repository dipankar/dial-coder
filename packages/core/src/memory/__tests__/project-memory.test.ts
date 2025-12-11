/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectMemory } from '../project-memory.js';
import type { SessionDecision, Pattern, ModuleIssue } from '../types.js';

describe('ProjectMemory', () => {
  let tempDir: string;
  let projectMemory: ProjectMemory;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-memory-test-'));
    projectMemory = new ProjectMemory(tempDir);
    await projectMemory.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should create directory structure', async () => {
      const dialDir = path.join(tempDir, '.dial');
      const projectDir = path.join(dialDir, 'project');
      const modulesDir = path.join(projectDir, 'modules');
      const sessionsDir = path.join(dialDir, 'sessions');

      expect(
        await fs
          .access(projectDir)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
      expect(
        await fs
          .access(modulesDir)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
      expect(
        await fs
          .access(sessionsDir)
          .then(() => true)
          .catch(() => false),
      ).toBe(true);
    });

    it('should create empty decisions file', async () => {
      const decisionsPath = path.join(
        tempDir,
        '.dial',
        'project',
        'decisions.jsonl',
      );
      const content = await fs.readFile(decisionsPath, 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('exists', () => {
    it('should return true after initialization', async () => {
      expect(await projectMemory.exists()).toBe(true);
    });

    it('should return false for non-existent project', async () => {
      const newMemory = new ProjectMemory('/non/existent/path');
      expect(await newMemory.exists()).toBe(false);
    });
  });

  describe('decisions', () => {
    it('should add and load decisions', async () => {
      const decision: SessionDecision = {
        scope: 'auth',
        type: 'invariant',
        summary: 'User IDs must be UUIDs',
        reasoning: 'Security and consistency',
        confidence: 'high',
      };

      await projectMemory.addDecision(decision, 'session-001');
      const decisions = await projectMemory.loadDecisions();

      expect(decisions).toHaveLength(1);
      expect(decisions[0].scope).toBe('auth');
      expect(decisions[0].summary).toBe('User IDs must be UUIDs');
    });

    it('should filter decisions by scope', async () => {
      await projectMemory.addDecision(
        {
          scope: 'auth',
          type: 'invariant',
          summary: 'Auth decision',
          reasoning: 'Reason',
          confidence: 'high',
        },
        'session-001',
      );

      await projectMemory.addDecision(
        {
          scope: 'api',
          type: 'pattern',
          summary: 'API decision',
          reasoning: 'Reason',
          confidence: 'medium',
        },
        'session-001',
      );

      await projectMemory.addDecision(
        {
          scope: 'global',
          type: 'constraint',
          summary: 'Global decision',
          reasoning: 'Reason',
          confidence: 'high',
        },
        'session-001',
      );

      const authDecisions = await projectMemory.getDecisions(['auth']);

      // Should include auth scope and global
      expect(authDecisions).toHaveLength(2);
      expect(authDecisions.some((d) => d.scope === 'auth')).toBe(true);
      expect(authDecisions.some((d) => d.scope === 'global')).toBe(true);
    });

    it('should get invariants', async () => {
      await projectMemory.addDecision(
        {
          scope: 'auth',
          type: 'invariant',
          summary: 'Must validate tokens',
          reasoning: 'Security',
          confidence: 'high',
        },
        'session-001',
      );

      await projectMemory.addDecision(
        {
          scope: 'auth',
          type: 'pattern',
          summary: 'Use middleware',
          reasoning: 'Consistency',
          confidence: 'medium',
        },
        'session-001',
      );

      const invariants = await projectMemory.getInvariants();

      expect(invariants).toHaveLength(1);
      expect(invariants[0]).toBe('Must validate tokens');
    });

    it('should get anti-patterns', async () => {
      // Add anti-pattern directly via rewriteDecisions since addDecision uses SessionDecision type
      // which doesn't include 'anti_pattern' (SessionDecision is for learned patterns during sessions)
      const antiPatternDecision = {
        id: 'test-anti-pattern',
        scope: 'api',
        type: 'anti_pattern' as const,
        summary: 'Never return raw errors',
        reasoning: 'Security',
        source: {
          sessionId: 'session-001',
          date: '2024-01-15',
        },
        metadata: {
          confidence: 'high' as const,
          timesReferenced: 0,
        },
      };
      await projectMemory.rewriteDecisions([antiPatternDecision]);

      const antiPatterns = await projectMemory.getAntiPatterns(['api']);

      expect(antiPatterns).toHaveLength(1);
      expect(antiPatterns[0].type).toBe('anti_pattern');
    });

    it('should mark decision as referenced', async () => {
      await projectMemory.addDecision(
        {
          scope: 'auth',
          type: 'invariant',
          summary: 'Test decision',
          reasoning: 'Test',
          confidence: 'high',
        },
        'session-001',
      );

      let decisions = await projectMemory.loadDecisions();
      const decisionId = decisions[0].id;
      expect(decisions[0].metadata.timesReferenced).toBe(0);

      await projectMemory.markDecisionReferenced(decisionId);

      // Clear cache to force reload
      projectMemory.clearCache();
      decisions = await projectMemory.loadDecisions();

      expect(decisions[0].metadata.timesReferenced).toBe(1);
      expect(decisions[0].metadata.lastReferenced).toBeDefined();
    });
  });

  describe('module memory', () => {
    it('should create and load module memory', async () => {
      const module = await projectMemory.updateModuleMemory('auth', {
        description: 'Authentication module',
        keyFiles: ['src/auth/index.ts'],
        dependencies: ['database'],
        patterns: [],
        invariants: ['Always validate tokens'],
        commonIssues: [],
        testCoverageNotes: 'Good coverage',
        recentChanges: [],
      });

      expect(module.module).toBe('auth');
      expect(module.description).toBe('Authentication module');

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded).not.toBeNull();
      expect(loaded?.description).toBe('Authentication module');
    });

    it('should add pattern to module', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth module',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      const pattern: Pattern = {
        name: 'Token refresh',
        description: 'Use refresh tokens for long sessions',
        whenToUse: 'When access tokens expire',
      };

      await projectMemory.addModulePattern('auth', pattern);

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded?.patterns).toHaveLength(1);
      expect(loaded?.patterns[0].name).toBe('Token refresh');
    });

    it('should add invariant to module', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth module',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      await projectMemory.addModuleInvariant('auth', 'Always hash passwords');

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded?.invariants).toContain('Always hash passwords');
    });

    it('should not add duplicate invariants', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth module',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      await projectMemory.addModuleInvariant('auth', 'Always hash passwords');
      await projectMemory.addModuleInvariant('auth', 'Always hash passwords');

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded?.invariants).toHaveLength(1);
    });

    it('should add issue to module', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth module',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      const issue: ModuleIssue = {
        description: 'Race condition in token refresh',
        severity: 'medium',
        mitigation: 'Use mutex lock',
      };

      await projectMemory.addModuleIssue('auth', issue);

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded?.commonIssues).toHaveLength(1);
      expect(loaded?.commonIssues[0].severity).toBe('medium');
    });

    it('should record module changes', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth module',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      await projectMemory.recordModuleChange('auth', {
        sessionId: 'session-001',
        date: '2024-01-15',
        description: 'Added token refresh',
        filesChanged: ['src/auth/refresh.ts'],
      });

      const loaded = await projectMemory.loadModuleMemory('auth');
      expect(loaded?.recentChanges).toHaveLength(1);
      expect(loaded?.recentChanges[0].description).toBe('Added token refresh');
    });

    it('should list all modules', async () => {
      await projectMemory.updateModuleMemory('auth', {
        description: 'Auth',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });
      await projectMemory.updateModuleMemory('api', {
        description: 'API',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });
      await projectMemory.updateModuleMemory('database', {
        description: 'DB',
        keyFiles: [],
        dependencies: [],
        patterns: [],
        invariants: [],
        commonIssues: [],
        testCoverageNotes: '',
        recentChanges: [],
      });

      const modules = await projectMemory.listModules();

      expect(modules).toHaveLength(3);
      expect(modules).toContain('auth');
      expect(modules).toContain('api');
      expect(modules).toContain('database');
    });
  });

  describe('architecture summary', () => {
    it('should save and load architecture summary', async () => {
      const content = '# Architecture\n\nThis is the architecture.';
      await projectMemory.saveArchitectureSummary(content);

      const loaded = await projectMemory.loadArchitectureSummary();
      expect(loaded).toBe(content);
    });

    it('should return null for non-existent summary', async () => {
      // Don't save anything
      const loaded = await projectMemory.loadArchitectureSummary();
      expect(loaded).toBeNull();
    });
  });

  describe('DIAL.md', () => {
    it('should save and load DIAL.md', async () => {
      const content = '# Project Context\n\nThis project is about...';
      await projectMemory.saveDialMd(content);

      const loaded = await projectMemory.loadDialMd();
      expect(loaded).toBe(content);
    });
  });
});
