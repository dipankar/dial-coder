/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized Authentication Manager
 *
 * This module provides a unified interface for managing authentication
 * credentials across different providers (Google OAuth, Qwen OAuth, API keys).
 *
 * It is independent of any specific auth implementation and can be used
 * from anywhere in the codebase without circular dependencies.
 */

import { Storage } from '../config/storage.js';

/**
 * Result of a credential clearing operation
 */
export interface ClearCredentialsResult {
  success: boolean;
  errors: string[];
  clearedProviders: string[];
}

/**
 * Authentication provider types
 */
export type AuthProvider = 'google' | 'qwen' | 'all';

/**
 * Clears all cached credentials for the specified provider(s).
 *
 * This is the main entry point for clearing authentication state.
 * It handles all providers in a unified way without requiring
 * direct dependencies on specific auth modules.
 *
 * @param provider - The auth provider to clear, or 'all' for all providers
 * @returns Result indicating success/failure and which providers were cleared
 */
export async function clearAllCredentials(
  provider: AuthProvider = 'all',
): Promise<ClearCredentialsResult> {
  const result: ClearCredentialsResult = {
    success: true,
    errors: [],
    clearedProviders: [],
  };

  const clearOperations: Array<{
    name: string;
    condition: boolean;
    clear: () => Promise<void>;
  }> = [
    {
      name: 'google',
      condition: provider === 'all' || provider === 'google',
      clear: clearGoogleCredentials,
    },
    {
      name: 'qwen',
      condition: provider === 'all' || provider === 'qwen',
      clear: clearQwenCredentialsInternal,
    },
  ];

  for (const op of clearOperations) {
    if (op.condition) {
      try {
        await op.clear();
        result.clearedProviders.push(op.name);
      } catch (error) {
        result.success = false;
        result.errors.push(
          `Failed to clear ${op.name} credentials: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return result;
}

/**
 * Clear Google OAuth credentials
 */
async function clearGoogleCredentials(): Promise<void> {
  // Dynamically import to avoid circular dependencies
  try {
    const { OAuthCredentialStorage } = await import(
      '../code_assist/oauth-credential-storage.js'
    );
    const { UserAccountManager } = await import(
      '../utils/userAccountManager.js'
    );
    const userAccountManager = new UserAccountManager();
    const { clearOauthClientCache, getUseEncryptedStorageFlag } = await import(
      '../code_assist/oauth2.js'
    );

    const useEncryptedStorage = getUseEncryptedStorageFlag();
    if (useEncryptedStorage) {
      await OAuthCredentialStorage.clearCredentials();
    } else {
      const fs = await import('node:fs/promises');
      await fs.rm(Storage.getOAuthCredsPath(), { force: true });
    }

    await userAccountManager.clearCachedGoogleAccount();
    clearOauthClientCache();
  } catch (error) {
    // Google auth module may not be available
    console.debug('Could not clear Google credentials:', error);
    throw error;
  }
}

/**
 * Clear Qwen OAuth credentials
 */
async function clearQwenCredentialsInternal(): Promise<void> {
  try {
    const { SharedTokenManager } = await import(
      '../qwen/sharedTokenManager.js'
    );
    const { clearQwenCredentials } = await import('../qwen/qwenOAuth2.js');

    const sharedManager = SharedTokenManager.getInstance();
    sharedManager.clearCache();

    await clearQwenCredentials();
  } catch (error) {
    // Qwen auth module may not be available
    console.debug('Could not clear Qwen credentials:', error);
    throw error;
  }
}

/**
 * Check if any credentials are currently stored
 *
 * @param provider - The provider to check, or 'all' to check any
 * @returns True if credentials exist for the specified provider(s)
 */
export async function hasStoredCredentials(
  provider: AuthProvider = 'all',
): Promise<boolean> {
  const checks: Array<{
    condition: boolean;
    check: () => Promise<boolean>;
  }> = [
    {
      condition: provider === 'all' || provider === 'google',
      check: hasGoogleCredentials,
    },
    {
      condition: provider === 'all' || provider === 'qwen',
      check: hasQwenCredentials,
    },
  ];

  for (const { condition, check } of checks) {
    if (condition) {
      try {
        if (await check()) {
          return true;
        }
      } catch {
        // Ignore check failures
      }
    }
  }

  return false;
}

/**
 * Check if Google credentials exist
 */
async function hasGoogleCredentials(): Promise<boolean> {
  try {
    const { OAuthCredentialStorage } = await import(
      '../code_assist/oauth-credential-storage.js'
    );
    const { getUseEncryptedStorageFlag } = await import(
      '../code_assist/oauth2.js'
    );

    const useEncryptedStorage = getUseEncryptedStorageFlag();
    if (useEncryptedStorage) {
      const creds = await OAuthCredentialStorage.loadCredentials();
      return creds !== null;
    } else {
      const fs = await import('node:fs/promises');
      try {
        await fs.access(Storage.getOAuthCredsPath());
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

/**
 * Check if Qwen credentials exist
 */
async function hasQwenCredentials(): Promise<boolean> {
  try {
    const { SharedTokenManager } = await import(
      '../qwen/sharedTokenManager.js'
    );
    const manager = SharedTokenManager.getInstance();
    const credentials = manager.getCurrentCredentials();
    return credentials !== null;
  } catch {
    return false;
  }
}
