/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralized Error Handling System
 *
 * This module provides a structured error handling framework with:
 * - Error categorization and codes
 * - Recovery suggestions
 * - Structured error information for logging/telemetry
 * - Consistent error handling patterns
 */

// ============================================================================
// Error Categories
// ============================================================================

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  CONFIGURATION = 'CONFIGURATION',
  NETWORK = 'NETWORK',
  TOOL_EXECUTION = 'TOOL_EXECUTION',
  LLM_PROVIDER = 'LLM_PROVIDER',
  FILE_SYSTEM = 'FILE_SYSTEM',
  SANDBOX = 'SANDBOX',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL = 'INTERNAL',
}

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Authentication (1xxx)
  AUTH_INVALID_CREDENTIALS: 1001,
  AUTH_TOKEN_EXPIRED: 1002,
  AUTH_OAUTH_FAILED: 1003,
  AUTH_API_KEY_MISSING: 1004,

  // Configuration (2xxx)
  CONFIG_INVALID_SETTING: 2001,
  CONFIG_FILE_NOT_FOUND: 2002,
  CONFIG_PARSE_ERROR: 2003,
  CONFIG_SCHEMA_MISMATCH: 2004,

  // Network (3xxx)
  NETWORK_TIMEOUT: 3001,
  NETWORK_CONNECTION_REFUSED: 3002,
  NETWORK_DNS_FAILURE: 3003,
  NETWORK_SSL_ERROR: 3004,

  // Tool Execution (4xxx)
  TOOL_NOT_FOUND: 4001,
  TOOL_EXECUTION_FAILED: 4002,
  TOOL_PERMISSION_DENIED: 4003,
  TOOL_TIMEOUT: 4004,
  TOOL_INVALID_ARGS: 4005,

  // LLM Provider (5xxx)
  LLM_QUOTA_EXCEEDED: 5001,
  LLM_MODEL_NOT_FOUND: 5002,
  LLM_CONTEXT_TOO_LONG: 5003,
  LLM_CONTENT_FILTERED: 5004,
  LLM_RESPONSE_INVALID: 5005,

  // File System (6xxx)
  FS_FILE_NOT_FOUND: 6001,
  FS_PERMISSION_DENIED: 6002,
  FS_DISK_FULL: 6003,
  FS_PATH_TOO_LONG: 6004,

  // Sandbox (7xxx)
  SANDBOX_NOT_AVAILABLE: 7001,
  SANDBOX_BUILD_FAILED: 7002,
  SANDBOX_EXECUTION_FAILED: 7003,

  // Validation (8xxx)
  VALIDATION_REQUIRED_FIELD: 8001,
  VALIDATION_INVALID_FORMAT: 8002,
  VALIDATION_OUT_OF_RANGE: 8003,

  // Rate Limit (9xxx)
  RATE_LIMIT_EXCEEDED: 9001,
  RATE_LIMIT_QUOTA_EXHAUSTED: 9002,

  // Internal (10xxx)
  INTERNAL_ERROR: 10001,
  INTERNAL_ASSERTION_FAILED: 10002,
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Structured Error Information
// ============================================================================

export interface ErrorInfo {
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
  recoveryHint?: string;
  isRetryable: boolean;
  timestamp: Date;
}

// ============================================================================
// Base Error Class
// ============================================================================

export class DialError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly details: Record<string, unknown>;
  readonly recoveryHint?: string;
  readonly isRetryable: boolean;
  readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    category: ErrorCategory,
    options?: {
      cause?: Error;
      details?: Record<string, unknown>;
      recoveryHint?: string;
      isRetryable?: boolean;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'DialError';
    this.code = code;
    this.category = category;
    this.details = options?.details ?? {};
    this.recoveryHint = options?.recoveryHint;
    this.isRetryable = options?.isRetryable ?? false;
    this.timestamp = new Date();
  }

  toErrorInfo(): ErrorInfo {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      details: this.details,
      cause: this.cause instanceof Error ? this.cause : undefined,
      recoveryHint: this.recoveryHint,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      details: this.details,
      recoveryHint: this.recoveryHint,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

export class AuthenticationError extends DialError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.AUTH_INVALID_CREDENTIALS,
    options?: { cause?: Error; details?: Record<string, unknown> },
  ) {
    super(message, code, ErrorCategory.AUTHENTICATION, {
      ...options,
      recoveryHint: 'Check your credentials and try authenticating again.',
      isRetryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends DialError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.NETWORK_CONNECTION_REFUSED,
    options?: { cause?: Error; details?: Record<string, unknown> },
  ) {
    super(message, code, ErrorCategory.NETWORK, {
      ...options,
      recoveryHint: 'Check your network connection and try again.',
      isRetryable: true,
    });
    this.name = 'NetworkError';
  }
}

export class ToolExecutionError extends DialError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.TOOL_EXECUTION_FAILED,
    options?: { cause?: Error; details?: Record<string, unknown> },
  ) {
    super(message, code, ErrorCategory.TOOL_EXECUTION, {
      ...options,
      recoveryHint: 'Check tool arguments and try again.',
      isRetryable: false,
    });
    this.name = 'ToolExecutionError';
  }
}

export class RateLimitError extends DialError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    options?: {
      cause?: Error;
      details?: Record<string, unknown>;
      retryAfter?: number;
    },
  ) {
    super(message, ErrorCodes.RATE_LIMIT_EXCEEDED, ErrorCategory.RATE_LIMIT, {
      ...options,
      recoveryHint: options?.retryAfter
        ? `Wait ${options.retryAfter} seconds before retrying.`
        : 'Wait a moment before retrying.',
      isRetryable: true,
    });
    this.name = 'RateLimitError';
    this.retryAfter = options?.retryAfter;
  }
}

// ============================================================================
// Error Handler
// ============================================================================

export interface ErrorHandler {
  handle(error: unknown): void;
  handleAsync(error: unknown): Promise<void>;
}

export class DefaultErrorHandler implements ErrorHandler {
  private readonly onError?: (info: ErrorInfo) => void;

  constructor(options?: { onError?: (info: ErrorInfo) => void }) {
    this.onError = options?.onError;
  }

  handle(error: unknown): void {
    const info = this.normalizeError(error);
    this.onError?.(info);
  }

  async handleAsync(error: unknown): Promise<void> {
    this.handle(error);
  }

  private normalizeError(error: unknown): ErrorInfo {
    if (error instanceof DialError) {
      return error.toErrorInfo();
    }

    if (error instanceof Error) {
      return {
        code: ErrorCodes.INTERNAL_ERROR,
        category: ErrorCategory.INTERNAL,
        message: error.message,
        cause: error,
        isRetryable: false,
        timestamp: new Date(),
      };
    }

    return {
      code: ErrorCodes.INTERNAL_ERROR,
      category: ErrorCategory.INTERNAL,
      message: getErrorMessage(error),
      isRetryable: false,
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// Error Recovery
// ============================================================================

export function getRecoveryHint(error: unknown): string | undefined {
  if (error instanceof DialError) {
    return error.recoveryHint;
  }

  // Provide hints for common error patterns
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('econnrefused') || msg.includes('connection refused')) {
      return 'Check if the service is running and the network is available.';
    }

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'The operation timed out. Try again or increase the timeout.';
    }

    if (msg.includes('enoent') || msg.includes('no such file')) {
      return 'The file or directory does not exist. Check the path.';
    }

    if (msg.includes('permission denied') || msg.includes('eacces')) {
      return 'Permission denied. Check file permissions or run with appropriate privileges.';
    }

    if (msg.includes('quota') || msg.includes('rate limit')) {
      return 'Rate limit or quota exceeded. Wait before retrying.';
    }
  }

  return undefined;
}

// ============================================================================
// Utility Functions
// ============================================================================

interface GaxiosError {
  response?: {
    data?: unknown;
  };
}

export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function isDialError(error: unknown): error is DialError {
  return error instanceof DialError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof DialError) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('rate limit')
    );
  }

  return false;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return 'Failed to get error details';
  }
}

export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (error instanceof DialError) {
    return error.code;
  }
  return undefined;
}

export function getErrorCategory(error: unknown): ErrorCategory | undefined {
  if (error instanceof DialError) {
    return error.category;
  }
  return undefined;
}

export class FatalError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

export class FatalAuthenticationError extends FatalError {
  constructor(message: string) {
    super(message, 41);
  }
}
export class FatalInputError extends FatalError {
  constructor(message: string) {
    super(message, 42);
  }
}
export class FatalSandboxError extends FatalError {
  constructor(message: string) {
    super(message, 44);
  }
}
export class FatalConfigError extends FatalError {
  constructor(message: string) {
    super(message, 52);
  }
}
export class FatalTurnLimitedError extends FatalError {
  constructor(message: string) {
    super(message, 53);
  }
}
export class FatalToolExecutionError extends FatalError {
  constructor(message: string) {
    super(message, 54);
  }
}
export class FatalCancellationError extends FatalError {
  constructor(message: string) {
    super(message, 130); // Standard exit code for SIGINT
  }
}

export class ForbiddenError extends Error {}
export class UnauthorizedError extends Error {}
export class BadRequestError extends Error {}

interface ResponseData {
  error?: {
    code?: number;
    message?: string;
  };
}

export function toFriendlyError(error: unknown): unknown {
  if (error && typeof error === 'object' && 'response' in error) {
    const gaxiosError = error as GaxiosError;
    const data = parseResponseData(gaxiosError);
    if (data.error && data.error.message && data.error.code) {
      switch (data.error.code) {
        case 400:
          return new BadRequestError(data.error.message);
        case 401:
          return new UnauthorizedError(data.error.message);
        case 403:
          // It's import to pass the message here since it might
          // explain the cause like "the cloud project you're
          // using doesn't have code assist enabled".
          return new ForbiddenError(data.error.message);
        default:
      }
    }
  }
  return error;
}

function parseResponseData(error: GaxiosError): ResponseData {
  // Inexplicably, Gaxios sometimes doesn't JSONify the response data.
  if (typeof error.response?.data === 'string') {
    return JSON.parse(error.response?.data) as ResponseData;
  }
  return error.response?.data as ResponseData;
}
