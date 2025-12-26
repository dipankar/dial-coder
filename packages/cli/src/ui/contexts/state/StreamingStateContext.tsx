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
import { StreamingState } from '../../types.js';
import type { ThoughtSummary, DialecticEvent } from '@dial-code/dial-core';

/**
 * State for streaming/loading/processing indicators.
 * This context manages the current streaming state and related UI indicators.
 */
export interface StreamingUIState {
  // Core streaming state
  streamingState: StreamingState;
  initError: string | null;

  // Loading indicators
  elapsedTime: number;
  currentLoadingPhrase: string;

  // Thought/reasoning display
  thought: ThoughtSummary | null;

  // Dialectic (multi-agent) state
  dialecticEvent: DialecticEvent | null;
  isDialecticActive: boolean;

  // Cancellation state
  ctrlCPressedOnce: boolean;
  ctrlDPressedOnce: boolean;
  showEscapePrompt: boolean;
}

/**
 * Actions available for manipulating streaming state.
 */
export interface StreamingActions {
  // Core streaming state
  setStreamingState: (state: StreamingState) => void;
  setInitError: (error: string | null) => void;

  // Loading indicators
  setElapsedTime: (time: number) => void;
  incrementElapsedTime: () => void;
  setCurrentLoadingPhrase: (phrase: string) => void;

  // Thought display
  setThought: (thought: ThoughtSummary | null) => void;

  // Dialectic state
  setDialecticEvent: (event: DialecticEvent | null) => void;
  setDialecticActive: (active: boolean) => void;

  // Cancellation state
  setCtrlCPressedOnce: (pressed: boolean) => void;
  setCtrlDPressedOnce: (pressed: boolean) => void;
  setShowEscapePrompt: (show: boolean) => void;

  // Utility actions
  resetStreamingState: () => void;
  resetCancellationState: () => void;
}

/**
 * Combined context value for streaming state management.
 */
export interface StreamingContextValue {
  state: StreamingUIState;
  actions: StreamingActions;
}

// Initial state
const initialStreamingState: StreamingUIState = {
  streamingState: StreamingState.Idle,
  initError: null,
  elapsedTime: 0,
  currentLoadingPhrase: '',
  thought: null,
  dialecticEvent: null,
  isDialecticActive: false,
  ctrlCPressedOnce: false,
  ctrlDPressedOnce: false,
  showEscapePrompt: false,
};

// Action types
type StreamingAction =
  | { type: 'SET_STREAMING_STATE'; payload: StreamingState }
  | { type: 'SET_INIT_ERROR'; payload: string | null }
  | { type: 'SET_ELAPSED_TIME'; payload: number }
  | { type: 'INCREMENT_ELAPSED_TIME' }
  | { type: 'SET_CURRENT_LOADING_PHRASE'; payload: string }
  | { type: 'SET_THOUGHT'; payload: ThoughtSummary | null }
  | { type: 'SET_DIALECTIC_EVENT'; payload: DialecticEvent | null }
  | { type: 'SET_DIALECTIC_ACTIVE'; payload: boolean }
  | { type: 'SET_CTRL_C_PRESSED_ONCE'; payload: boolean }
  | { type: 'SET_CTRL_D_PRESSED_ONCE'; payload: boolean }
  | { type: 'SET_SHOW_ESCAPE_PROMPT'; payload: boolean }
  | { type: 'RESET_STREAMING_STATE' }
  | { type: 'RESET_CANCELLATION_STATE' };

// Reducer
function streamingReducer(
  state: StreamingUIState,
  action: StreamingAction,
): StreamingUIState {
  switch (action.type) {
    case 'SET_STREAMING_STATE':
      return { ...state, streamingState: action.payload };
    case 'SET_INIT_ERROR':
      return { ...state, initError: action.payload };
    case 'SET_ELAPSED_TIME':
      return { ...state, elapsedTime: action.payload };
    case 'INCREMENT_ELAPSED_TIME':
      return { ...state, elapsedTime: state.elapsedTime + 1 };
    case 'SET_CURRENT_LOADING_PHRASE':
      return { ...state, currentLoadingPhrase: action.payload };
    case 'SET_THOUGHT':
      return { ...state, thought: action.payload };
    case 'SET_DIALECTIC_EVENT':
      return { ...state, dialecticEvent: action.payload };
    case 'SET_DIALECTIC_ACTIVE':
      return { ...state, isDialecticActive: action.payload };
    case 'SET_CTRL_C_PRESSED_ONCE':
      return { ...state, ctrlCPressedOnce: action.payload };
    case 'SET_CTRL_D_PRESSED_ONCE':
      return { ...state, ctrlDPressedOnce: action.payload };
    case 'SET_SHOW_ESCAPE_PROMPT':
      return { ...state, showEscapePrompt: action.payload };
    case 'RESET_STREAMING_STATE':
      return {
        ...state,
        streamingState: StreamingState.Idle,
        elapsedTime: 0,
        currentLoadingPhrase: '',
        thought: null,
        dialecticEvent: null,
        isDialecticActive: false,
      };
    case 'RESET_CANCELLATION_STATE':
      return {
        ...state,
        ctrlCPressedOnce: false,
        ctrlDPressedOnce: false,
        showEscapePrompt: false,
      };
    default:
      return state;
  }
}

// Create context
const StreamingContext = createContext<StreamingContextValue | null>(null);

/**
 * Provider component for streaming state management.
 * Wrap your application with this provider to enable streaming state.
 */
export function StreamingStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(streamingReducer, initialStreamingState);

  // Create memoized actions
  const actions = useMemo<StreamingActions>(
    () => ({
      setStreamingState: (streamingState: StreamingState) =>
        dispatch({ type: 'SET_STREAMING_STATE', payload: streamingState }),
      setInitError: (error: string | null) =>
        dispatch({ type: 'SET_INIT_ERROR', payload: error }),
      setElapsedTime: (time: number) =>
        dispatch({ type: 'SET_ELAPSED_TIME', payload: time }),
      incrementElapsedTime: () => dispatch({ type: 'INCREMENT_ELAPSED_TIME' }),
      setCurrentLoadingPhrase: (phrase: string) =>
        dispatch({ type: 'SET_CURRENT_LOADING_PHRASE', payload: phrase }),
      setThought: (thought: ThoughtSummary | null) =>
        dispatch({ type: 'SET_THOUGHT', payload: thought }),
      setDialecticEvent: (event: DialecticEvent | null) =>
        dispatch({ type: 'SET_DIALECTIC_EVENT', payload: event }),
      setDialecticActive: (active: boolean) =>
        dispatch({ type: 'SET_DIALECTIC_ACTIVE', payload: active }),
      setCtrlCPressedOnce: (pressed: boolean) =>
        dispatch({ type: 'SET_CTRL_C_PRESSED_ONCE', payload: pressed }),
      setCtrlDPressedOnce: (pressed: boolean) =>
        dispatch({ type: 'SET_CTRL_D_PRESSED_ONCE', payload: pressed }),
      setShowEscapePrompt: (show: boolean) =>
        dispatch({ type: 'SET_SHOW_ESCAPE_PROMPT', payload: show }),
      resetStreamingState: () => dispatch({ type: 'RESET_STREAMING_STATE' }),
      resetCancellationState: () =>
        dispatch({ type: 'RESET_CANCELLATION_STATE' }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <StreamingContext.Provider value={value}>
      {children}
    </StreamingContext.Provider>
  );
}

/**
 * Hook to access the full streaming context (state and actions).
 */
export function useStreamingContext(): StreamingContextValue {
  const context = useContext(StreamingContext);
  if (!context) {
    throw new Error(
      'useStreamingContext must be used within a StreamingStateProvider',
    );
  }
  return context;
}

/**
 * Hook to access only streaming state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useStreamingState(): StreamingUIState {
  return useStreamingContext().state;
}

/**
 * Hook to access only streaming actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useStreamingActions(): StreamingActions {
  return useStreamingContext().actions;
}

/**
 * Hook to check if the system is currently processing (not idle).
 */
export function useIsProcessing(): boolean {
  const state = useStreamingState();
  return state.streamingState !== StreamingState.Idle;
}

/**
 * Hook to check if the system is waiting for user confirmation.
 */
export function useIsWaitingForConfirmation(): boolean {
  const state = useStreamingState();
  return state.streamingState === StreamingState.WaitingForConfirmation;
}
