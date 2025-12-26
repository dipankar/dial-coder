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
import type { AuthType, UserTierId, IdeInfo } from '@dial-code/dial-core';
import type { QwenAuthState } from '../../hooks/useQwenAuth.js';
import type { RestartReason } from '../../hooks/useIdeTrustListener.js';

/**
 * Auth status for Qwen OAuth flow.
 */
export type QwenAuthStatus =
  | 'idle'
  | 'polling'
  | 'success'
  | 'error'
  | 'timeout'
  | 'rate_limit';

/**
 * State for authentication-related data.
 * This context manages auth state, errors, and initialization status.
 */
export interface AuthUIState {
  // Core auth state
  isAuthenticating: boolean;
  authError: string | null;
  pendingAuthType: AuthType | undefined;

  // Qwen OAuth state (complex object, managed by useQwenAuth hook)
  qwenAuthState: QwenAuthState;

  // Initialization state
  isConfigInitialized: boolean;

  // User tier
  userTier: UserTierId | undefined;

  // IDE context
  currentIDE: IdeInfo | null;
  ideTrustRestartReason: RestartReason;
  shouldShowIdePrompt: boolean;
  isTrustedFolder: boolean | undefined;
}

/**
 * Actions available for manipulating auth state.
 */
export interface AuthActions {
  // Core auth state
  setIsAuthenticating: (isAuthenticating: boolean) => void;
  setAuthError: (error: string | null) => void;
  setPendingAuthType: (authType: AuthType | undefined) => void;

  // Qwen OAuth state
  setQwenAuthState: (state: QwenAuthState) => void;
  updateQwenAuthStatus: (status: QwenAuthStatus) => void;
  setQwenAuthMessage: (message: string | null) => void;

  // Initialization state
  setIsConfigInitialized: (initialized: boolean) => void;

  // User tier
  setUserTier: (tier: UserTierId | undefined) => void;

  // IDE context
  setCurrentIDE: (ide: IdeInfo | null) => void;
  setIdeTrustRestartReason: (reason: RestartReason) => void;
  setShouldShowIdePrompt: (show: boolean) => void;
  setIsTrustedFolder: (trusted: boolean | undefined) => void;

  // Utility actions
  clearAuthError: () => void;
  resetAuthState: () => void;
}

/**
 * Combined context value for auth state management.
 */
export interface AuthContextValue {
  state: AuthUIState;
  actions: AuthActions;
}

// Initial Qwen auth state
const initialQwenAuthState: QwenAuthState = {
  deviceAuth: null,
  authStatus: 'idle',
  authMessage: null,
};

// Initial state
const initialAuthState: AuthUIState = {
  isAuthenticating: false,
  authError: null,
  pendingAuthType: undefined,
  qwenAuthState: initialQwenAuthState,
  isConfigInitialized: false,
  userTier: undefined,
  currentIDE: null,
  ideTrustRestartReason: 'NONE',
  shouldShowIdePrompt: false,
  isTrustedFolder: undefined,
};

// Action types
type AuthAction =
  | { type: 'SET_IS_AUTHENTICATING'; payload: boolean }
  | { type: 'SET_AUTH_ERROR'; payload: string | null }
  | { type: 'SET_PENDING_AUTH_TYPE'; payload: AuthType | undefined }
  | { type: 'SET_QWEN_AUTH_STATE'; payload: QwenAuthState }
  | { type: 'UPDATE_QWEN_AUTH_STATUS'; payload: QwenAuthStatus }
  | { type: 'SET_QWEN_AUTH_MESSAGE'; payload: string | null }
  | { type: 'SET_IS_CONFIG_INITIALIZED'; payload: boolean }
  | { type: 'SET_USER_TIER'; payload: UserTierId | undefined }
  | { type: 'SET_CURRENT_IDE'; payload: IdeInfo | null }
  | { type: 'SET_IDE_TRUST_RESTART_REASON'; payload: RestartReason }
  | { type: 'SET_SHOULD_SHOW_IDE_PROMPT'; payload: boolean }
  | { type: 'SET_IS_TRUSTED_FOLDER'; payload: boolean | undefined }
  | { type: 'CLEAR_AUTH_ERROR' }
  | { type: 'RESET_AUTH_STATE' };

// Reducer
function authReducer(state: AuthUIState, action: AuthAction): AuthUIState {
  switch (action.type) {
    case 'SET_IS_AUTHENTICATING':
      return { ...state, isAuthenticating: action.payload };
    case 'SET_AUTH_ERROR':
      return { ...state, authError: action.payload };
    case 'SET_PENDING_AUTH_TYPE':
      return { ...state, pendingAuthType: action.payload };
    case 'SET_QWEN_AUTH_STATE':
      return { ...state, qwenAuthState: action.payload };
    case 'UPDATE_QWEN_AUTH_STATUS':
      return {
        ...state,
        qwenAuthState: {
          ...state.qwenAuthState,
          authStatus: action.payload,
        },
      };
    case 'SET_QWEN_AUTH_MESSAGE':
      return {
        ...state,
        qwenAuthState: {
          ...state.qwenAuthState,
          authMessage: action.payload,
        },
      };
    case 'SET_IS_CONFIG_INITIALIZED':
      return { ...state, isConfigInitialized: action.payload };
    case 'SET_USER_TIER':
      return { ...state, userTier: action.payload };
    case 'SET_CURRENT_IDE':
      return { ...state, currentIDE: action.payload };
    case 'SET_IDE_TRUST_RESTART_REASON':
      return { ...state, ideTrustRestartReason: action.payload };
    case 'SET_SHOULD_SHOW_IDE_PROMPT':
      return { ...state, shouldShowIdePrompt: action.payload };
    case 'SET_IS_TRUSTED_FOLDER':
      return { ...state, isTrustedFolder: action.payload };
    case 'CLEAR_AUTH_ERROR':
      return { ...state, authError: null };
    case 'RESET_AUTH_STATE':
      return {
        ...state,
        isAuthenticating: false,
        authError: null,
        pendingAuthType: undefined,
        qwenAuthState: initialQwenAuthState,
      };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider component for auth state management.
 * Wrap your application with this provider to enable auth state.
 */
export function AuthStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Create memoized actions
  const actions = useMemo<AuthActions>(
    () => ({
      setIsAuthenticating: (isAuthenticating: boolean) =>
        dispatch({ type: 'SET_IS_AUTHENTICATING', payload: isAuthenticating }),
      setAuthError: (error: string | null) =>
        dispatch({ type: 'SET_AUTH_ERROR', payload: error }),
      setPendingAuthType: (authType: AuthType | undefined) =>
        dispatch({ type: 'SET_PENDING_AUTH_TYPE', payload: authType }),
      setQwenAuthState: (qwenState: QwenAuthState) =>
        dispatch({ type: 'SET_QWEN_AUTH_STATE', payload: qwenState }),
      updateQwenAuthStatus: (status: QwenAuthStatus) =>
        dispatch({ type: 'UPDATE_QWEN_AUTH_STATUS', payload: status }),
      setQwenAuthMessage: (message: string | null) =>
        dispatch({ type: 'SET_QWEN_AUTH_MESSAGE', payload: message }),
      setIsConfigInitialized: (initialized: boolean) =>
        dispatch({ type: 'SET_IS_CONFIG_INITIALIZED', payload: initialized }),
      setUserTier: (tier: UserTierId | undefined) =>
        dispatch({ type: 'SET_USER_TIER', payload: tier }),
      setCurrentIDE: (ide: IdeInfo | null) =>
        dispatch({ type: 'SET_CURRENT_IDE', payload: ide }),
      setIdeTrustRestartReason: (reason: RestartReason) =>
        dispatch({ type: 'SET_IDE_TRUST_RESTART_REASON', payload: reason }),
      setShouldShowIdePrompt: (show: boolean) =>
        dispatch({ type: 'SET_SHOULD_SHOW_IDE_PROMPT', payload: show }),
      setIsTrustedFolder: (trusted: boolean | undefined) =>
        dispatch({ type: 'SET_IS_TRUSTED_FOLDER', payload: trusted }),
      clearAuthError: () => dispatch({ type: 'CLEAR_AUTH_ERROR' }),
      resetAuthState: () => dispatch({ type: 'RESET_AUTH_STATE' }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the full auth context (state and actions).
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthStateProvider');
  }
  return context;
}

/**
 * Hook to access only auth state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useAuthState(): AuthUIState {
  return useAuthContext().state;
}

/**
 * Hook to access only auth actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useAuthActions(): AuthActions {
  return useAuthContext().actions;
}

/**
 * Hook to check if authentication is in progress.
 */
export function useIsAuthenticating(): boolean {
  const state = useAuthState();
  return state.isAuthenticating;
}

/**
 * Hook to check if the system is fully initialized.
 */
export function useIsInitialized(): boolean {
  const state = useAuthState();
  return state.isConfigInitialized;
}

/**
 * Hook to check if there's an auth error.
 */
export function useHasAuthError(): boolean {
  const state = useAuthState();
  return state.authError !== null;
}

/**
 * Hook to get the current Qwen auth status.
 */
export function useQwenAuthStatus(): QwenAuthStatus {
  const state = useAuthState();
  return state.qwenAuthState.authStatus;
}
