/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import type { ComponentType, ErrorInfo } from 'react';
import { ErrorBoundary } from './ErrorBoundary.js';
import type { ErrorFallbackProps } from './ErrorFallback.js';

/**
 * Options for the withErrorBoundary HOC.
 */
export interface WithErrorBoundaryOptions {
  /** Name for the error boundary (defaults to wrapped component name) */
  name?: string;
  /** Custom fallback component */
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show the reset button */
  showReset?: boolean;
}

/**
 * Higher-order component that wraps a component with an error boundary.
 *
 * This provides a convenient way to add error handling to any component
 * without modifying its implementation.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const SafeComponent = withErrorBoundary(MyComponent);
 *
 * // With options
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   name: 'MyComponent',
 *   onError: (error) => console.error(error),
 * });
 *
 * // With custom fallback
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   FallbackComponent: CustomFallback,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {},
): ComponentType<P> {
  const {
    name = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    FallbackComponent,
    onError,
    showReset = true,
  } = options;

  const displayName = `withErrorBoundary(${name})`;

  function ComponentWithErrorBoundary(props: P): React.ReactElement {
    return (
      <ErrorBoundary
        name={name}
        FallbackComponent={FallbackComponent}
        onError={onError}
        showReset={showReset}
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }

  ComponentWithErrorBoundary.displayName = displayName;

  return ComponentWithErrorBoundary;
}

/**
 * Creates a specialized error boundary HOC with preset options.
 *
 * Useful for creating domain-specific error boundaries with consistent
 * behavior across an application.
 *
 * @example
 * ```tsx
 * // Create a dialog-specific error boundary
 * const withDialogErrorBoundary = createErrorBoundary({
 *   FallbackComponent: DialogErrorFallback,
 *   onError: (error) => logDialogError(error),
 * });
 *
 * // Use it
 * const SafeDialog = withDialogErrorBoundary(MyDialog);
 * ```
 */
export function createErrorBoundary(
  defaultOptions: WithErrorBoundaryOptions,
): <P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: Partial<WithErrorBoundaryOptions>,
) => ComponentType<P> {
  return function customWithErrorBoundary<P extends object>(
    WrappedComponent: ComponentType<P>,
    options: Partial<WithErrorBoundaryOptions> = {},
  ): ComponentType<P> {
    return withErrorBoundary(WrappedComponent, {
      ...defaultOptions,
      ...options,
    });
  };
}
