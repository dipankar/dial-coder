/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple structured logger for the core package.
 *
 * This provides a consistent logging interface that can be extended
 * to integrate with more robust logging systems (e.g., OpenTelemetry,
 * structured JSON logging) in the future.
 *
 * Features:
 * - Module-based logging with automatic prefixes
 * - Log levels (debug, info, warn, error)
 * - Structured data support
 * - Environment-aware (respects DEBUG env var)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/**
 * Check if debug logging is enabled via environment variable
 */
function isDebugEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.DEBUG === 'true' ||
      process.env.DEBUG === '1' ||
      process.env.DIAL_DEBUG === 'true'
    );
  }
  return false;
}

/**
 * Format context object for logging
 */
function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }
  try {
    return ' ' + JSON.stringify(context);
  } catch {
    return ' [context not serializable]';
  }
}

/**
 * Create a logger instance for a specific module
 *
 * @param moduleName - The name of the module (used as prefix)
 * @returns A logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from '../utils/logger.js';
 *
 * const logger = createLogger('BfsFileSearch');
 * logger.debug('Starting search', { fileName: 'test.ts' });
 * ```
 */
export function createLogger(moduleName: string): Logger {
  const prefix = `[${moduleName}]`;

  return {
    debug(message: string, context?: LogContext): void {
      if (isDebugEnabled()) {
        console.debug(`[DEBUG] ${prefix} ${message}${formatContext(context)}`);
      }
    },

    info(message: string, context?: LogContext): void {
      console.info(`[INFO] ${prefix} ${message}${formatContext(context)}`);
    },

    warn(message: string, context?: LogContext): void {
      console.warn(`[WARN] ${prefix} ${message}${formatContext(context)}`);
    },

    error(message: string, context?: LogContext): void {
      console.error(`[ERROR] ${prefix} ${message}${formatContext(context)}`);
    },
  };
}

/**
 * Default logger for quick use without creating a named logger
 */
export const defaultLogger = createLogger('Core');

/**
 * Utility to wrap async operations with logging
 */
export async function withLogging<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext,
): Promise<T> {
  const startTime = Date.now();
  logger.debug(`Starting: ${operation}`, context);

  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.debug(`Completed: ${operation}`, {
      ...context,
      durationMs: duration,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed: ${operation}`, {
      ...context,
      durationMs: duration,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
