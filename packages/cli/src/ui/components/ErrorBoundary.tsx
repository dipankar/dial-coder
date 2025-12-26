/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import type React from 'react';
import { ErrorFallback, type ErrorFallbackProps } from './ErrorFallback.js';

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional name for the boundary (used in error logging) */
  name?: string;
  /** Optional custom fallback component */
  FallbackComponent?: React.ComponentType<ErrorFallbackProps>;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional callback for retry attempts */
  onRetry?: () => void;
  /** Whether to show the reset button (default: true) */
  showReset?: boolean;
}

/**
 * State for the ErrorBoundary component.
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component for catching and handling React errors.
 *
 * Error boundaries are React components that catch JavaScript errors anywhere
 * in their child component tree, log those errors, and display a fallback UI
 * instead of the component tree that crashed.
 *
 * Note: Error boundaries must be class components as there's no hook equivalent
 * for componentDidCatch and getDerivedStateFromError.
 *
 * @example
 * ```tsx
 * <ErrorBoundary name="MainContent">
 *   <MainContent />
 * </ErrorBoundary>
 * ```
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   name="DialogManager"
 *   onError={(error) => logger.error('Dialog error', error)}
 *   FallbackComponent={CustomErrorFallback}
 * >
 *   <DialogManager />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught.
   * This lifecycle method is called during the "render" phase.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log the error and component stack.
   * This lifecycle method is called during the "commit" phase.
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { name, onError } = this.props;

    // Log the error
    console.error(
      `[ErrorBoundary${name ? `:${name}` : ''}] Caught error:`,
      error,
    );
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error callback
    if (onError) {
      onError(error, errorInfo);
    }
  }

  /**
   * Reset the error boundary state.
   */
  reset = (): void => {
    const { onRetry } = this.props;

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call optional retry callback
    if (onRetry) {
      onRetry();
    }
  };

  override render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      name,
      FallbackComponent = ErrorFallback,
      showReset = true,
    } = this.props;

    if (hasError && error) {
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          onReset={showReset ? this.reset : undefined}
          componentName={name}
        />
      );
    }

    return children;
  }
}
