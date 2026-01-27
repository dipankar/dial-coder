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
import type {
  ShellConfirmationRequest,
  ConfirmationRequest,
  LoopDetectionConfirmationRequest,
  QuitConfirmationRequest,
} from '../../types.js';
import type { FallbackIntent } from '@dial-coder/core';

/**
 * Request for ProQuota dialog when model fallback is needed.
 */
export interface ProQuotaDialogRequest {
  failedModel: string;
  fallbackModel: string;
  resolve: (intent: FallbackIntent) => void;
}

/**
 * Welcome back dialog information.
 */
export interface WelcomeBackInfo {
  hasHistory: boolean;
  lastPrompt?: string;
}

/**
 * State for all dialog visibility flags and related data.
 * This context manages which dialogs are open and their associated state.
 */
export interface DialogState {
  // Dialog visibility flags
  isThemeDialogOpen: boolean;
  isAuthDialogOpen: boolean;
  isEditorDialogOpen: boolean;
  isSettingsDialogOpen: boolean;
  isModelDialogOpen: boolean;
  isPermissionsDialogOpen: boolean;
  isApprovalModeDialogOpen: boolean;
  isFolderTrustDialogOpen: boolean;
  isVisionSwitchDialogOpen: boolean;
  showWelcomeBackDialog: boolean;
  isSubagentCreateDialogOpen: boolean;
  isAgentsManagerDialogOpen: boolean;
  showWorkspaceMigrationDialog: boolean;
  showIdeRestartPrompt: boolean;
  dialogsVisible: boolean;

  // Dialog error states
  themeError: string | null;
  editorError: string | null;

  // Welcome back dialog data
  welcomeBackInfo: WelcomeBackInfo | null;
  welcomeBackChoice: 'continue' | 'restart' | null;

  // Confirmation requests
  proQuotaRequest: ProQuotaDialogRequest | null;
  shellConfirmationRequest: ShellConfirmationRequest | null;
  confirmationRequest: ConfirmationRequest | null;
  confirmUpdateExtensionRequests: ConfirmationRequest[];
  loopDetectionConfirmationRequest: LoopDetectionConfirmationRequest | null;
  quitConfirmationRequest: QuitConfirmationRequest | null;
}

/**
 * Actions available for manipulating dialog state.
 */
export interface DialogActions {
  // Dialog visibility toggles
  setThemeDialogOpen: (open: boolean) => void;
  setAuthDialogOpen: (open: boolean) => void;
  setEditorDialogOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setModelDialogOpen: (open: boolean) => void;
  setPermissionsDialogOpen: (open: boolean) => void;
  setApprovalModeDialogOpen: (open: boolean) => void;
  setFolderTrustDialogOpen: (open: boolean) => void;
  setVisionSwitchDialogOpen: (open: boolean) => void;
  setWelcomeBackDialog: (show: boolean) => void;
  setSubagentCreateDialogOpen: (open: boolean) => void;
  setAgentsManagerDialogOpen: (open: boolean) => void;
  setWorkspaceMigrationDialog: (show: boolean) => void;
  setIdeRestartPrompt: (show: boolean) => void;
  setDialogsVisible: (visible: boolean) => void;

  // Error state setters
  setThemeError: (error: string | null) => void;
  setEditorError: (error: string | null) => void;

  // Welcome back dialog
  setWelcomeBackInfo: (info: WelcomeBackInfo | null) => void;
  setWelcomeBackChoice: (choice: 'continue' | 'restart' | null) => void;

  // Confirmation request setters
  setProQuotaRequest: (request: ProQuotaDialogRequest | null) => void;
  setShellConfirmationRequest: (
    request: ShellConfirmationRequest | null,
  ) => void;
  setConfirmationRequest: (request: ConfirmationRequest | null) => void;
  addConfirmUpdateExtensionRequest: (request: ConfirmationRequest) => void;
  removeConfirmUpdateExtensionRequest: (index: number) => void;
  setLoopDetectionConfirmationRequest: (
    request: LoopDetectionConfirmationRequest | null,
  ) => void;
  setQuitConfirmationRequest: (request: QuitConfirmationRequest | null) => void;

  // Utility actions
  closeAllDialogs: () => void;
}

/**
 * Combined context value for dialog state management.
 */
export interface DialogContextValue {
  state: DialogState;
  actions: DialogActions;
}

// Initial state
const initialDialogState: DialogState = {
  isThemeDialogOpen: false,
  isAuthDialogOpen: false,
  isEditorDialogOpen: false,
  isSettingsDialogOpen: false,
  isModelDialogOpen: false,
  isPermissionsDialogOpen: false,
  isApprovalModeDialogOpen: false,
  isFolderTrustDialogOpen: false,
  isVisionSwitchDialogOpen: false,
  showWelcomeBackDialog: false,
  isSubagentCreateDialogOpen: false,
  isAgentsManagerDialogOpen: false,
  showWorkspaceMigrationDialog: false,
  showIdeRestartPrompt: false,
  dialogsVisible: false,
  themeError: null,
  editorError: null,
  welcomeBackInfo: null,
  welcomeBackChoice: null,
  proQuotaRequest: null,
  shellConfirmationRequest: null,
  confirmationRequest: null,
  confirmUpdateExtensionRequests: [],
  loopDetectionConfirmationRequest: null,
  quitConfirmationRequest: null,
};

// Action types
type DialogAction =
  | { type: 'SET_THEME_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_AUTH_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_EDITOR_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_SETTINGS_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_MODEL_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_PERMISSIONS_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_APPROVAL_MODE_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_FOLDER_TRUST_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_VISION_SWITCH_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_WELCOME_BACK_DIALOG'; payload: boolean }
  | { type: 'SET_SUBAGENT_CREATE_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_AGENTS_MANAGER_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_WORKSPACE_MIGRATION_DIALOG'; payload: boolean }
  | { type: 'SET_IDE_RESTART_PROMPT'; payload: boolean }
  | { type: 'SET_DIALOGS_VISIBLE'; payload: boolean }
  | { type: 'SET_THEME_ERROR'; payload: string | null }
  | { type: 'SET_EDITOR_ERROR'; payload: string | null }
  | { type: 'SET_WELCOME_BACK_INFO'; payload: WelcomeBackInfo | null }
  | { type: 'SET_WELCOME_BACK_CHOICE'; payload: 'continue' | 'restart' | null }
  | { type: 'SET_PRO_QUOTA_REQUEST'; payload: ProQuotaDialogRequest | null }
  | {
      type: 'SET_SHELL_CONFIRMATION_REQUEST';
      payload: ShellConfirmationRequest | null;
    }
  | { type: 'SET_CONFIRMATION_REQUEST'; payload: ConfirmationRequest | null }
  | {
      type: 'ADD_CONFIRM_UPDATE_EXTENSION_REQUEST';
      payload: ConfirmationRequest;
    }
  | { type: 'REMOVE_CONFIRM_UPDATE_EXTENSION_REQUEST'; payload: number }
  | {
      type: 'SET_LOOP_DETECTION_CONFIRMATION_REQUEST';
      payload: LoopDetectionConfirmationRequest | null;
    }
  | {
      type: 'SET_QUIT_CONFIRMATION_REQUEST';
      payload: QuitConfirmationRequest | null;
    }
  | { type: 'CLOSE_ALL_DIALOGS' };

// Reducer
function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'SET_THEME_DIALOG_OPEN':
      return { ...state, isThemeDialogOpen: action.payload };
    case 'SET_AUTH_DIALOG_OPEN':
      return { ...state, isAuthDialogOpen: action.payload };
    case 'SET_EDITOR_DIALOG_OPEN':
      return { ...state, isEditorDialogOpen: action.payload };
    case 'SET_SETTINGS_DIALOG_OPEN':
      return { ...state, isSettingsDialogOpen: action.payload };
    case 'SET_MODEL_DIALOG_OPEN':
      return { ...state, isModelDialogOpen: action.payload };
    case 'SET_PERMISSIONS_DIALOG_OPEN':
      return { ...state, isPermissionsDialogOpen: action.payload };
    case 'SET_APPROVAL_MODE_DIALOG_OPEN':
      return { ...state, isApprovalModeDialogOpen: action.payload };
    case 'SET_FOLDER_TRUST_DIALOG_OPEN':
      return { ...state, isFolderTrustDialogOpen: action.payload };
    case 'SET_VISION_SWITCH_DIALOG_OPEN':
      return { ...state, isVisionSwitchDialogOpen: action.payload };
    case 'SET_WELCOME_BACK_DIALOG':
      return { ...state, showWelcomeBackDialog: action.payload };
    case 'SET_SUBAGENT_CREATE_DIALOG_OPEN':
      return { ...state, isSubagentCreateDialogOpen: action.payload };
    case 'SET_AGENTS_MANAGER_DIALOG_OPEN':
      return { ...state, isAgentsManagerDialogOpen: action.payload };
    case 'SET_WORKSPACE_MIGRATION_DIALOG':
      return { ...state, showWorkspaceMigrationDialog: action.payload };
    case 'SET_IDE_RESTART_PROMPT':
      return { ...state, showIdeRestartPrompt: action.payload };
    case 'SET_DIALOGS_VISIBLE':
      return { ...state, dialogsVisible: action.payload };
    case 'SET_THEME_ERROR':
      return { ...state, themeError: action.payload };
    case 'SET_EDITOR_ERROR':
      return { ...state, editorError: action.payload };
    case 'SET_WELCOME_BACK_INFO':
      return { ...state, welcomeBackInfo: action.payload };
    case 'SET_WELCOME_BACK_CHOICE':
      return { ...state, welcomeBackChoice: action.payload };
    case 'SET_PRO_QUOTA_REQUEST':
      return { ...state, proQuotaRequest: action.payload };
    case 'SET_SHELL_CONFIRMATION_REQUEST':
      return { ...state, shellConfirmationRequest: action.payload };
    case 'SET_CONFIRMATION_REQUEST':
      return { ...state, confirmationRequest: action.payload };
    case 'ADD_CONFIRM_UPDATE_EXTENSION_REQUEST':
      return {
        ...state,
        confirmUpdateExtensionRequests: [
          ...state.confirmUpdateExtensionRequests,
          action.payload,
        ],
      };
    case 'REMOVE_CONFIRM_UPDATE_EXTENSION_REQUEST':
      return {
        ...state,
        confirmUpdateExtensionRequests:
          state.confirmUpdateExtensionRequests.filter(
            (_, i) => i !== action.payload,
          ),
      };
    case 'SET_LOOP_DETECTION_CONFIRMATION_REQUEST':
      return { ...state, loopDetectionConfirmationRequest: action.payload };
    case 'SET_QUIT_CONFIRMATION_REQUEST':
      return { ...state, quitConfirmationRequest: action.payload };
    case 'CLOSE_ALL_DIALOGS':
      return {
        ...state,
        isThemeDialogOpen: false,
        isAuthDialogOpen: false,
        isEditorDialogOpen: false,
        isSettingsDialogOpen: false,
        isModelDialogOpen: false,
        isPermissionsDialogOpen: false,
        isApprovalModeDialogOpen: false,
        isFolderTrustDialogOpen: false,
        isVisionSwitchDialogOpen: false,
        showWelcomeBackDialog: false,
        isSubagentCreateDialogOpen: false,
        isAgentsManagerDialogOpen: false,
        showWorkspaceMigrationDialog: false,
        showIdeRestartPrompt: false,
        dialogsVisible: false,
      };
    default:
      return state;
  }
}

// Create context
const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * Provider component for dialog state management.
 * Wrap your application with this provider to enable dialog state.
 */
export function DialogStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(dialogReducer, initialDialogState);

  // Create memoized actions
  const actions = useMemo<DialogActions>(
    () => ({
      setThemeDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_THEME_DIALOG_OPEN', payload: open }),
      setAuthDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_AUTH_DIALOG_OPEN', payload: open }),
      setEditorDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_EDITOR_DIALOG_OPEN', payload: open }),
      setSettingsDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_SETTINGS_DIALOG_OPEN', payload: open }),
      setModelDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_MODEL_DIALOG_OPEN', payload: open }),
      setPermissionsDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_PERMISSIONS_DIALOG_OPEN', payload: open }),
      setApprovalModeDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_APPROVAL_MODE_DIALOG_OPEN', payload: open }),
      setFolderTrustDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_FOLDER_TRUST_DIALOG_OPEN', payload: open }),
      setVisionSwitchDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_VISION_SWITCH_DIALOG_OPEN', payload: open }),
      setWelcomeBackDialog: (show: boolean) =>
        dispatch({ type: 'SET_WELCOME_BACK_DIALOG', payload: show }),
      setSubagentCreateDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_SUBAGENT_CREATE_DIALOG_OPEN', payload: open }),
      setAgentsManagerDialogOpen: (open: boolean) =>
        dispatch({ type: 'SET_AGENTS_MANAGER_DIALOG_OPEN', payload: open }),
      setWorkspaceMigrationDialog: (show: boolean) =>
        dispatch({ type: 'SET_WORKSPACE_MIGRATION_DIALOG', payload: show }),
      setIdeRestartPrompt: (show: boolean) =>
        dispatch({ type: 'SET_IDE_RESTART_PROMPT', payload: show }),
      setDialogsVisible: (visible: boolean) =>
        dispatch({ type: 'SET_DIALOGS_VISIBLE', payload: visible }),
      setThemeError: (error: string | null) =>
        dispatch({ type: 'SET_THEME_ERROR', payload: error }),
      setEditorError: (error: string | null) =>
        dispatch({ type: 'SET_EDITOR_ERROR', payload: error }),
      setWelcomeBackInfo: (info: WelcomeBackInfo | null) =>
        dispatch({ type: 'SET_WELCOME_BACK_INFO', payload: info }),
      setWelcomeBackChoice: (choice: 'continue' | 'restart' | null) =>
        dispatch({ type: 'SET_WELCOME_BACK_CHOICE', payload: choice }),
      setProQuotaRequest: (request: ProQuotaDialogRequest | null) =>
        dispatch({ type: 'SET_PRO_QUOTA_REQUEST', payload: request }),
      setShellConfirmationRequest: (request: ShellConfirmationRequest | null) =>
        dispatch({ type: 'SET_SHELL_CONFIRMATION_REQUEST', payload: request }),
      setConfirmationRequest: (request: ConfirmationRequest | null) =>
        dispatch({ type: 'SET_CONFIRMATION_REQUEST', payload: request }),
      addConfirmUpdateExtensionRequest: (request: ConfirmationRequest) =>
        dispatch({
          type: 'ADD_CONFIRM_UPDATE_EXTENSION_REQUEST',
          payload: request,
        }),
      removeConfirmUpdateExtensionRequest: (index: number) =>
        dispatch({
          type: 'REMOVE_CONFIRM_UPDATE_EXTENSION_REQUEST',
          payload: index,
        }),
      setLoopDetectionConfirmationRequest: (
        request: LoopDetectionConfirmationRequest | null,
      ) =>
        dispatch({
          type: 'SET_LOOP_DETECTION_CONFIRMATION_REQUEST',
          payload: request,
        }),
      setQuitConfirmationRequest: (request: QuitConfirmationRequest | null) =>
        dispatch({ type: 'SET_QUIT_CONFIRMATION_REQUEST', payload: request }),
      closeAllDialogs: () => dispatch({ type: 'CLOSE_ALL_DIALOGS' }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

/**
 * Hook to access the full dialog context (state and actions).
 */
export function useDialogContext(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error(
      'useDialogContext must be used within a DialogStateProvider',
    );
  }
  return context;
}

/**
 * Hook to access only dialog state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useDialogState(): DialogState {
  return useDialogContext().state;
}

/**
 * Hook to access only dialog actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useDialogActions(): DialogActions {
  return useDialogContext().actions;
}

/**
 * Hook to check if any dialog is currently open.
 * Useful for disabling input or other UI elements.
 */
export function useAnyDialogOpen(): boolean {
  const state = useDialogState();
  return (
    state.isThemeDialogOpen ||
    state.isAuthDialogOpen ||
    state.isEditorDialogOpen ||
    state.isSettingsDialogOpen ||
    state.isModelDialogOpen ||
    state.isPermissionsDialogOpen ||
    state.isApprovalModeDialogOpen ||
    state.isFolderTrustDialogOpen ||
    state.isVisionSwitchDialogOpen ||
    state.showWelcomeBackDialog ||
    state.isSubagentCreateDialogOpen ||
    state.isAgentsManagerDialogOpen ||
    state.showWorkspaceMigrationDialog ||
    state.dialogsVisible
  );
}
