/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DialecticIntegration,
  createDialecticIntegration,
} from './dialectic-integration.js';
import type { Config } from '../config/config.js';
import type { ContentGenerator } from '../core/contentGenerator.js';

describe('DialecticIntegration', () => {
  let mockConfig: Config;
  let mockContentGenerator: ContentGenerator;

  beforeEach(() => {
    // Create mock ContentGenerator
    mockContentGenerator = {
      generateContent: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'Mock response' }],
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      }),
      generateContentStream: vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield {
            candidates: [
              {
                content: { parts: [{ text: 'Streamed response' }] },
              },
            ],
          };
        },
      }),
    } as unknown as ContentGenerator;

    // Create mock Config
    mockConfig = {
      getContentGenerator: vi.fn().mockReturnValue(mockContentGenerator),
      getModel: vi.fn().mockReturnValue('gemini-2.0-flash-001'),
      getProjectRoot: vi.fn().mockReturnValue('/tmp/test-project'),
    } as unknown as Config;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createDialecticIntegration', () => {
    it('should create a DialecticIntegration instance', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration).toBeInstanceOf(DialecticIntegration);
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialize is called', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.isInitialized()).toBe(false);
    });

    it('should return true after initialize is called', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();
      expect(integration.isInitialized()).toBe(true);
    });
  });

  describe('requiresDialectic', () => {
    it('should return false for ask mode', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.requiresDialectic('ask')).toBe(false);
    });

    it('should return false for quick mode', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.requiresDialectic('quick')).toBe(false);
    });

    it('should return true for review mode', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.requiresDialectic('review')).toBe(true);
    });

    it('should return true for safe mode', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.requiresDialectic('safe')).toBe(true);
    });
  });

  describe('onEvent / offEvent', () => {
    it('should allow registering and unregistering event handlers', async () => {
      const integration = createDialecticIntegration(mockConfig);
      const handler = vi.fn();

      integration.onEvent(handler);
      await integration.initialize();

      // Execute to trigger events
      await integration.execute('test prompt', 'review');

      expect(handler).toHaveBeenCalled();

      // Clear and remove handler
      handler.mockClear();
      integration.offEvent(handler);

      // Execute again
      await integration.execute('test prompt 2', 'review');

      // Handler should not be called again
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    it('should throw if not initialized', async () => {
      const integration = createDialecticIntegration(mockConfig);

      await expect(integration.execute('test', 'review')).rejects.toThrow(
        'DialecticIntegration not initialized',
      );
    });

    it('should return early for non-dialectic modes', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();

      const result = await integration.execute('test', 'quick');

      expect(result.usedDialectic).toBe(false);
      expect(result.mode).toBe('quick');
      expect(result.success).toBe(true);
    });

    it('should use dialectic for review mode', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();

      const result = await integration.execute(
        'Fix the bug in main.ts',
        'review',
      );

      expect(result.mode).toBe('review');
      // The result depends on the dialectic execution
      expect(result.success).toBeDefined();
    });

    it('should use dialectic for safe mode', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();

      const result = await integration.execute(
        'Refactor the authentication system',
        'safe',
      );

      expect(result.mode).toBe('safe');
      expect(result.success).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset the coordinator state', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();

      // Execute something
      await integration.execute('test', 'review');

      // Reset
      integration.reset();

      // Should be able to execute again
      const result = await integration.execute('test2', 'review');
      expect(result).toBeDefined();
    });
  });

  describe('getCoordinator', () => {
    it('should return null before initialization', () => {
      const integration = createDialecticIntegration(mockConfig);
      expect(integration.getCoordinator()).toBeNull();
    });

    it('should return coordinator after initialization', async () => {
      const integration = createDialecticIntegration(mockConfig);
      await integration.initialize();
      expect(integration.getCoordinator()).not.toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw if ContentGenerator is not available', async () => {
      const configWithoutGenerator = {
        ...mockConfig,
        getContentGenerator: vi.fn().mockReturnValue(null),
      } as unknown as Config;

      const integration = createDialecticIntegration(configWithoutGenerator);

      await expect(integration.initialize()).rejects.toThrow(
        'ContentGenerator not available',
      );
    });
  });
});
