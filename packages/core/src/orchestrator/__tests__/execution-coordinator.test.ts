/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionCoordinator,
  createExecutionCoordinator,
  DEFAULT_COORDINATOR_CONFIG,
} from '../execution-coordinator.js';

describe('ExecutionCoordinator', () => {
  let coordinator: ExecutionCoordinator;

  beforeEach(() => {
    coordinator = new ExecutionCoordinator();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      expect(coordinator).toBeInstanceOf(ExecutionCoordinator);
      expect(coordinator.getCurrentMode()).toBe('simple');
    });

    it('should accept custom configuration', () => {
      const onModeSelected = vi.fn();
      const customCoordinator = new ExecutionCoordinator({
        defaultMode: 'safe',
        autoSelectMode: false,
        onModeSelected,
      });

      expect(customCoordinator).toBeInstanceOf(ExecutionCoordinator);
    });
  });

  describe('selectMode', () => {
    it('should auto-select mode for simple tasks', () => {
      const result = coordinator.selectMode('Fix typo in README');

      expect(result.mode).toBe('simple');
      expect(result.displayName).toBe('quick');
      expect(result.isAutoSelected).toBe(true);
    });

    it('should auto-select read_only for query tasks', () => {
      const result = coordinator.selectMode(
        'Explain how the auth module works',
      );

      expect(result.mode).toBe('read_only');
      expect(result.displayName).toBe('ask');
    });

    it('should auto-select dialectic_full for critical paths', () => {
      const result = coordinator.selectMode('Update src/auth/login.ts');

      expect(result.mode).toBe('dialectic_full');
      expect(result.displayName).toBe('safe');
    });

    it('should respect user-specified mode', () => {
      const result = coordinator.selectMode('Fix typo', { userMode: 'safe' });

      expect(result.mode).toBe('dialectic_full');
      expect(result.isAutoSelected).toBe(false);
    });

    it('should call onModeSelected callback', () => {
      const onModeSelected = vi.fn();
      const customCoordinator = new ExecutionCoordinator({ onModeSelected });

      customCoordinator.selectMode('Fix typo');

      expect(onModeSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: expect.any(String),
          displayName: expect.any(String),
        }),
      );
    });
  });

  describe('analyzePrompt', () => {
    it('should return mode selection without executing', () => {
      const result = coordinator.analyzePrompt('Refactor authentication');

      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasons');
    });
  });

  describe('hasDialecticDependencies', () => {
    it('should return false when no dependencies set', () => {
      expect(coordinator.hasDialecticDependencies()).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute simple mode without dialectic', async () => {
      const result = await coordinator.execute('Fix typo in README');

      expect(result.mode).toBe('simple');
      expect(result.usedDialectic).toBe(false);
    });

    it('should throw error for dialectic mode without dependencies', async () => {
      await expect(
        coordinator.execute('Update src/auth/login.ts'),
      ).rejects.toThrow('dependencies are not configured');
    });
  });

  describe('forceEscalate', () => {
    it('should escalate to stricter mode', () => {
      const result = coordinator.forceEscalate('dialectic_full');

      expect(result).toBe(true);
      expect(coordinator.getCurrentMode()).toBe('dialectic_full');
    });

    it('should not allow downgrade', () => {
      coordinator.forceEscalate('dialectic_full');
      const result = coordinator.forceEscalate('simple');

      expect(result).toBe(false);
      expect(coordinator.getCurrentMode()).toBe('dialectic_full');
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      coordinator.forceEscalate('dialectic_full');
      coordinator.reset();

      expect(coordinator.getCurrentMode()).toBe('simple');
    });
  });

  describe('getSummary', () => {
    it('should return summary string', () => {
      const summary = coordinator.getSummary();

      expect(summary).toContain('Current mode');
      expect(summary).toContain('simple');
    });
  });
});

describe('createExecutionCoordinator', () => {
  it('should create coordinator with defaults', () => {
    const coordinator = createExecutionCoordinator();

    expect(coordinator).toBeInstanceOf(ExecutionCoordinator);
  });

  it('should create coordinator with custom config', () => {
    const coordinator = createExecutionCoordinator({
      autoSelectMode: false,
    });

    expect(coordinator).toBeInstanceOf(ExecutionCoordinator);
  });
});

describe('DEFAULT_COORDINATOR_CONFIG', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_COORDINATOR_CONFIG.autoSelectMode).toBe(true);
    expect(DEFAULT_COORDINATOR_CONFIG.enableEscalation).toBe(true);
  });
});
