/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { ApprovalMode } from '@dial-coder/core';
import type { SessionStatsState } from '../SessionContext.js';
import type {
  UserMode,
  ModeSelectionInfo,
} from '../../hooks/useUserModeIndicator.js';

/**
 * State for session-level data and user preferences.
 * This context manages session statistics, user modes, and debug settings.
 */
export interface SessionUIState {
  // Session statistics
  sessionStats: SessionStatsState | null;

  // Shell state
  shellModeActive: boolean;
  activePtyId: number | undefined;
  embeddedShellFocused: boolean;

  // Display modes
  corgiMode: boolean;
  debugMessage: string;
  showErrorDetails: boolean;
  showToolDescriptions: boolean;

  // User execution mode
  userMode: UserMode;
  userModeIsManual: boolean;
  userModeAutoInfo: ModeSelectionInfo | null;
  showAutoAcceptIndicator: ApprovalMode;

  // Counters and status
  errorCount: number;
  isRestarting: boolean;
}

/**
 * Actions available for manipulating session state.
 */
export interface SessionActions {
  // Session statistics
  setSessionStats: (stats: SessionStatsState | null) => void;

  // Shell state
  setShellModeActive: (active: boolean) => void;
  setActivePtyId: (id: number | undefined) => void;
  setEmbeddedShellFocused: (focused: boolean) => void;

  // Display modes
  toggleCorgiMode: () => void;
  setCorgiMode: (enabled: boolean) => void;
  setDebugMessage: (message: string) => void;
  setShowErrorDetails: (show: boolean) => void;
  toggleShowErrorDetails: () => void;
  setShowToolDescriptions: (show: boolean) => void;
  toggleShowToolDescriptions: () => void;

  // User execution mode
  setUserMode: (mode: UserMode) => void;
  setUserModeIsManual: (isManual: boolean) => void;
  setUserModeAutoInfo: (info: ModeSelectionInfo | null) => void;
  setShowAutoAcceptIndicator: (mode: ApprovalMode) => void;

  // Counters and status
  incrementErrorCount: () => void;
  resetErrorCount: () => void;
  setIsRestarting: (isRestarting: boolean) => void;
}

/**
 * Combined context value for session state management.
 */
export interface SessionContextValue {
  state: SessionUIState;
  actions: SessionActions;
}

// Initial state
const initialSessionState: SessionUIState = {
  sessionStats: null,
  shellModeActive: false,
  activePtyId: undefined,
  embeddedShellFocused: false,
  corgiMode: false,
  debugMessage: '',
  showErrorDetails: false,
  showToolDescriptions: false,
  userMode: 'quick',
  userModeIsManual: false,
  userModeAutoInfo: null,
  showAutoAcceptIndicator: ApprovalMode.DEFAULT,
  errorCount: 0,
  isRestarting: false,
};

// Action types
type SessionAction =
  | { type: 'SET_SESSION_STATS'; payload: SessionStatsState | null }
  | { type: 'SET_SHELL_MODE_ACTIVE'; payload: boolean }
  | { type: 'SET_ACTIVE_PTY_ID'; payload: number | undefined }
  | { type: 'SET_EMBEDDED_SHELL_FOCUSED'; payload: boolean }
  | { type: 'TOGGLE_CORGI_MODE' }
  | { type: 'SET_CORGI_MODE'; payload: boolean }
  | { type: 'SET_DEBUG_MESSAGE'; payload: string }
  | { type: 'SET_SHOW_ERROR_DETAILS'; payload: boolean }
  | { type: 'TOGGLE_SHOW_ERROR_DETAILS' }
  | { type: 'SET_SHOW_TOOL_DESCRIPTIONS'; payload: boolean }
  | { type: 'TOGGLE_SHOW_TOOL_DESCRIPTIONS' }
  | { type: 'SET_USER_MODE'; payload: UserMode }
  | { type: 'SET_USER_MODE_IS_MANUAL'; payload: boolean }
  | { type: 'SET_USER_MODE_AUTO_INFO'; payload: ModeSelectionInfo | null }
  | { type: 'SET_SHOW_AUTO_ACCEPT_INDICATOR'; payload: ApprovalMode }
  | { type: 'INCREMENT_ERROR_COUNT' }
  | { type: 'RESET_ERROR_COUNT' }
  | { type: 'SET_IS_RESTARTING'; payload: boolean };

// Reducer
function sessionReducer(
  state: SessionUIState,
  action: SessionAction,
): SessionUIState {
  switch (action.type) {
    case 'SET_SESSION_STATS':
      return { ...state, sessionStats: action.payload };
    case 'SET_SHELL_MODE_ACTIVE':
      return { ...state, shellModeActive: action.payload };
    case 'SET_ACTIVE_PTY_ID':
      return { ...state, activePtyId: action.payload };
    case 'SET_EMBEDDED_SHELL_FOCUSED':
      return { ...state, embeddedShellFocused: action.payload };
    case 'TOGGLE_CORGI_MODE':
      return { ...state, corgiMode: !state.corgiMode };
    case 'SET_CORGI_MODE':
      return { ...state, corgiMode: action.payload };
    case 'SET_DEBUG_MESSAGE':
      return { ...state, debugMessage: action.payload };
    case 'SET_SHOW_ERROR_DETAILS':
      return { ...state, showErrorDetails: action.payload };
    case 'TOGGLE_SHOW_ERROR_DETAILS':
      return { ...state, showErrorDetails: !state.showErrorDetails };
    case 'SET_SHOW_TOOL_DESCRIPTIONS':
      return { ...state, showToolDescriptions: action.payload };
    case 'TOGGLE_SHOW_TOOL_DESCRIPTIONS':
      return { ...state, showToolDescriptions: !state.showToolDescriptions };
    case 'SET_USER_MODE':
      return { ...state, userMode: action.payload };
    case 'SET_USER_MODE_IS_MANUAL':
      return { ...state, userModeIsManual: action.payload };
    case 'SET_USER_MODE_AUTO_INFO':
      return { ...state, userModeAutoInfo: action.payload };
    case 'SET_SHOW_AUTO_ACCEPT_INDICATOR':
      return { ...state, showAutoAcceptIndicator: action.payload };
    case 'INCREMENT_ERROR_COUNT':
      return { ...state, errorCount: state.errorCount + 1 };
    case 'RESET_ERROR_COUNT':
      return { ...state, errorCount: 0 };
    case 'SET_IS_RESTARTING':
      return { ...state, isRestarting: action.payload };
    default:
      return state;
  }
}

// Create context
const SessionUIContext = createContext<SessionContextValue | null>(null);

/**
 * Provider component for session state management.
 * Wrap your application with this provider to enable session state.
 */
export function SessionUIStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  // Create memoized actions
  const actions = useMemo<SessionActions>(
    () => ({
      setSessionStats: (stats: SessionStatsState | null) =>
        dispatch({ type: 'SET_SESSION_STATS', payload: stats }),
      setShellModeActive: (active: boolean) =>
        dispatch({ type: 'SET_SHELL_MODE_ACTIVE', payload: active }),
      setActivePtyId: (id: number | undefined) =>
        dispatch({ type: 'SET_ACTIVE_PTY_ID', payload: id }),
      setEmbeddedShellFocused: (focused: boolean) =>
        dispatch({ type: 'SET_EMBEDDED_SHELL_FOCUSED', payload: focused }),
      toggleCorgiMode: () => dispatch({ type: 'TOGGLE_CORGI_MODE' }),
      setCorgiMode: (enabled: boolean) =>
        dispatch({ type: 'SET_CORGI_MODE', payload: enabled }),
      setDebugMessage: (message: string) =>
        dispatch({ type: 'SET_DEBUG_MESSAGE', payload: message }),
      setShowErrorDetails: (show: boolean) =>
        dispatch({ type: 'SET_SHOW_ERROR_DETAILS', payload: show }),
      toggleShowErrorDetails: () =>
        dispatch({ type: 'TOGGLE_SHOW_ERROR_DETAILS' }),
      setShowToolDescriptions: (show: boolean) =>
        dispatch({ type: 'SET_SHOW_TOOL_DESCRIPTIONS', payload: show }),
      toggleShowToolDescriptions: () =>
        dispatch({ type: 'TOGGLE_SHOW_TOOL_DESCRIPTIONS' }),
      setUserMode: (mode: UserMode) =>
        dispatch({ type: 'SET_USER_MODE', payload: mode }),
      setUserModeIsManual: (isManual: boolean) =>
        dispatch({ type: 'SET_USER_MODE_IS_MANUAL', payload: isManual }),
      setUserModeAutoInfo: (info: ModeSelectionInfo | null) =>
        dispatch({ type: 'SET_USER_MODE_AUTO_INFO', payload: info }),
      setShowAutoAcceptIndicator: (mode: ApprovalMode) =>
        dispatch({ type: 'SET_SHOW_AUTO_ACCEPT_INDICATOR', payload: mode }),
      incrementErrorCount: () => dispatch({ type: 'INCREMENT_ERROR_COUNT' }),
      resetErrorCount: () => dispatch({ type: 'RESET_ERROR_COUNT' }),
      setIsRestarting: (isRestarting: boolean) =>
        dispatch({ type: 'SET_IS_RESTARTING', payload: isRestarting }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <SessionUIContext.Provider value={value}>
      {children}
    </SessionUIContext.Provider>
  );
}

/**
 * Hook to access the full session context (state and actions).
 */
export function useSessionUIContext(): SessionContextValue {
  const context = useContext(SessionUIContext);
  if (!context) {
    throw new Error(
      'useSessionUIContext must be used within a SessionUIStateProvider',
    );
  }
  return context;
}

/**
 * Hook to access only session state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useSessionUIState(): SessionUIState {
  return useSessionUIContext().state;
}

/**
 * Hook to access only session actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useSessionUIActions(): SessionActions {
  return useSessionUIContext().actions;
}

/**
 * Hook to check if shell mode is currently active.
 */
export function useIsShellMode(): boolean {
  const state = useSessionUIState();
  return state.shellModeActive;
}

/**
 * Hook to get the current user mode with its metadata.
 */
export function useUserModeInfo(): {
  mode: UserMode;
  isManual: boolean;
  autoInfo: ModeSelectionInfo | null;
} {
  const state = useSessionUIState();
  return {
    mode: state.userMode,
    isManual: state.userModeIsManual,
    autoInfo: state.userModeAutoInfo,
  };
}
