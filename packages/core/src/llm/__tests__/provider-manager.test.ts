/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderManager } from '../provider-manager.js';
import type { LLMClient } from '../llm-client.js';
import type { LLMSystemConfig, LLMCompletion } from '../types.js';
import type { Config } from '../../config/config.js';

// Create a mock LLMClient
function createMockClient(name: string, model: string): LLMClient {
  return {
    name,
    model,
    complete: vi.fn().mockResolvedValue({
      id: 'test-id',
      content: 'Hello!',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model,
    } as LLMCompletion),
    stream: vi.fn(),
    supportsTools: vi.fn().mockReturnValue(true),
    supportsJsonMode: vi.fn().mockReturnValue(true),
    estimateTokens: vi.fn().mockReturnValue(10),
  };
}

// Create a mock Config
function createMockConfig(): Config {
  return {
    getProxy: vi.fn().mockReturnValue(undefined),
    getCliVersion: vi.fn().mockReturnValue('1.0.0'),
  } as unknown as Config;
}

describe('ProviderManager', () => {
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = createMockConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new ProviderManager', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      expect(manager).toBeDefined();
    });
  });

  describe('registerClient', () => {
    it('should register a client', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      const client = createMockClient('test', 'test-model');

      manager.registerClient('test', client);
      expect(manager.listClients()).toContain('test');
    });
  });

  describe('getClient', () => {
    it('should return registered client', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      const client = createMockClient('test', 'test-model');

      manager.registerClient('test', client);
      expect(manager.getClient('test')).toBe(client);
    });

    it('should throw for unknown client', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      expect(() => manager.getClient('unknown')).toThrow();
    });
  });

  describe('getDefaultClient', () => {
    it('should return the default client', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'default',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      const client = createMockClient('default', 'default-model');

      manager.registerClient('default', client);
      expect(manager.getDefaultClient()).toBe(client);
    });
  });

  describe('listClients', () => {
    it('should list all registered clients', () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'client1',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);

      manager.registerClient('client1', createMockClient('client1', 'model1'));
      manager.registerClient('client2', createMockClient('client2', 'model2'));
      manager.registerClient('client3', createMockClient('client3', 'model3'));

      const clients = manager.listClients();
      expect(clients).toHaveLength(3);
      expect(clients).toContain('client1');
      expect(clients).toContain('client2');
      expect(clients).toContain('client3');
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for registered non-auth clients', async () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      manager.registerClient('test', createMockClient('test', 'model'));

      expect(await manager.isProviderAvailable('test')).toBe(true);
    });

    it('should return false for unregistered clients', async () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);

      expect(await manager.isProviderAvailable('unknown')).toBe(false);
    });
  });

  describe('getAvailableClient', () => {
    it('should return first available client', async () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'client1',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);
      const client1 = createMockClient('client1', 'model1');
      const client2 = createMockClient('client2', 'model2');

      manager.registerClient('client1', client1);
      manager.registerClient('client2', client2);

      const client = await manager.getAvailableClient(['client1', 'client2']);
      expect(client).toBe(client1);
    });

    it('should return null if no clients available', async () => {
      const llmConfig: LLMSystemConfig = {
        defaultProvider: 'test',
        providers: {},
      };

      const manager = new ProviderManager(llmConfig, mockConfig);

      const client = await manager.getAvailableClient(['unknown1', 'unknown2']);
      expect(client).toBeNull();
    });
  });
});
