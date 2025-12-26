/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * State Context Slices
 *
 * This module exports domain-specific state contexts that decompose the monolithic
 * UIState into focused, manageable slices. Each slice manages a specific domain
 * of UI state, reducing unnecessary re-renders and improving code organization.
 *
 * Usage:
 * ```tsx
 * import { useDialogState, useDialogActions } from './contexts/state';
 *
 * // In a component that reads dialog state
 * const dialogState = useDialogState();
 *
 * // In a component that only needs to dispatch actions
 * const { setThemeDialogOpen } = useDialogActions();
 * ```
 *
 * State Slices:
 * - DialogState: Dialog visibility flags and confirmation requests
 * - StreamingState: Streaming/loading/processing indicators
 * - HistoryState: Conversation history and message queues
 * - SessionState: Session statistics and user preferences
 * - TerminalState: Terminal dimensions and layout calculations
 * - AuthState: Authentication state and initialization
 */

// Dialog State - manages all dialog visibility and confirmation requests
export {
  DialogStateProvider,
  useDialogContext,
  useDialogState,
  useDialogActions,
  useAnyDialogOpen,
  type DialogState,
  type DialogActions,
  type DialogContextValue,
  type ProQuotaDialogRequest,
  type WelcomeBackInfo,
} from './DialogStateContext.js';

// Streaming State - manages streaming, loading, and processing state
export {
  StreamingStateProvider,
  useStreamingContext,
  useStreamingState,
  useStreamingActions,
  useIsProcessing,
  useIsWaitingForConfirmation,
  type StreamingUIState,
  type StreamingActions,
  type StreamingContextValue,
} from './StreamingStateContext.js';

// History State - manages conversation history and message queues
export {
  HistoryStateProvider,
  useHistoryContext,
  useHistoryState,
  useHistoryActions,
  useHasPendingItems,
  useIsQuitting,
  type HistoryUIState,
  type HistoryActions,
  type HistoryContextValue,
} from './HistoryStateContext.js';

// Session State - manages session statistics and user preferences
export {
  SessionUIStateProvider,
  useSessionUIContext,
  useSessionUIState,
  useSessionUIActions,
  useIsShellMode,
  useUserModeInfo,
  type SessionUIState,
  type SessionActions,
  type SessionContextValue,
} from './SessionStateContext.js';

// Terminal State - manages terminal dimensions and layout
export {
  TerminalStateProvider,
  useTerminalContext,
  useTerminalState,
  useTerminalActions,
  useTerminalDimensions,
  useContentAreaDimensions,
  type TerminalUIState,
  type TerminalActions,
  type TerminalContextValue,
} from './TerminalStateContext.js';

// Auth State - manages authentication and initialization state
export {
  AuthStateProvider,
  useAuthContext,
  useAuthState,
  useAuthActions,
  useIsAuthenticating,
  useIsInitialized,
  useHasAuthError,
  useQwenAuthStatus,
  type AuthUIState,
  type AuthActions,
  type AuthContextValue,
  type QwenAuthStatus,
} from './AuthStateContext.js';
