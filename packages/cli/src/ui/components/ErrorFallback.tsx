/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import type { ErrorInfo } from 'react';
import { Box, Text } from 'ink';

/**
 * Props for the ErrorFallback component.
 */
export interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error;
  /** React error info with component stack */
  errorInfo?: ErrorInfo | null;
  /** Optional callback to reset the error boundary */
  onReset?: () => void;
  /** Optional name of the component that errored */
  componentName?: string;
}

/**
 * Fallback UI displayed when an error boundary catches an error.
 *
 * This component provides a user-friendly error message in the terminal,
 * with optional details about the error and a reset option.
 *
 * @example
 * ```tsx
 * <ErrorFallback
 *   error={new Error('Something went wrong')}
 *   componentName="MainContent"
 *   onReset={() => window.location.reload()}
 * />
 * ```
 */
export function ErrorFallback({
  error,
  errorInfo,
  onReset,
  componentName,
}: ErrorFallbackProps): React.ReactElement {
  const title = componentName
    ? `Error in ${componentName}`
    : 'Something went wrong';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={1}
      paddingY={0}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text color="red" bold>
          {title}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="yellow">{error.name}:</Text>
        <Text wrap="wrap">{error.message}</Text>
      </Box>

      {process.env['NODE_ENV'] === 'development' && error.stack && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>
            Stack trace:
          </Text>
          <Text color="gray" dimColor wrap="wrap">
            {error.stack
              .split('\n')
              .slice(1, 5)
              .map((line) => line.trim())
              .join('\n')}
          </Text>
        </Box>
      )}

      {process.env['NODE_ENV'] === 'development' &&
        errorInfo?.componentStack && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="gray" dimColor>
              Component stack:
            </Text>
            <Text color="gray" dimColor wrap="wrap">
              {errorInfo.componentStack
                .split('\n')
                .slice(0, 5)
                .map((line) => line.trim())
                .filter(Boolean)
                .join('\n')}
            </Text>
          </Box>
        )}

      {onReset && (
        <Box>
          <Text color="cyan">Press Enter to try again, or Ctrl+C to exit.</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * A minimal error fallback for use in tight spaces or nested boundaries.
 */
export function MinimalErrorFallback({
  error,
  componentName,
}: ErrorFallbackProps): React.ReactElement {
  return (
    <Box>
      <Text color="red">
        Error{componentName ? ` in ${componentName}` : ''}: {error.message}
      </Text>
    </Box>
  );
}

/**
 * An inline error indicator for use when a full fallback isn't appropriate.
 */
export function InlineErrorFallback({
  error,
}: ErrorFallbackProps): React.ReactElement {
  return (
    <Text color="red">
      [Error: {error.message.slice(0, 50)}
      {error.message.length > 50 ? '...' : ''}]
    </Text>
  );
}
