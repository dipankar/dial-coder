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

/**
 * State for terminal dimensions and layout calculations.
 * This context manages terminal size and computed layout values.
 */
export interface TerminalUIState {
  // Raw terminal dimensions
  terminalWidth: number;
  terminalHeight: number;

  // Computed layout values
  mainAreaWidth: number;
  availableTerminalHeight: number | undefined;
  staticAreaMaxItemHeight: number;
  staticExtraHeight: number;

  // Input area dimensions
  inputWidth: number;
  suggestionsWidth: number;

  // Layout constraints
  constrainHeight: boolean;
}

/**
 * Actions available for manipulating terminal state.
 */
export interface TerminalActions {
  // Raw terminal dimensions
  setTerminalWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  setTerminalDimensions: (width: number, height: number) => void;

  // Computed layout values
  setMainAreaWidth: (width: number) => void;
  setAvailableTerminalHeight: (height: number | undefined) => void;
  setStaticAreaMaxItemHeight: (height: number) => void;
  setStaticExtraHeight: (height: number) => void;

  // Input area dimensions
  setInputWidth: (width: number) => void;
  setSuggestionsWidth: (width: number) => void;

  // Layout constraints
  setConstrainHeight: (constrain: boolean) => void;

  // Batch updates for performance
  updateLayout: (updates: Partial<TerminalUIState>) => void;
}

/**
 * Combined context value for terminal state management.
 */
export interface TerminalContextValue {
  state: TerminalUIState;
  actions: TerminalActions;
}

// Default values for terminal dimensions
const DEFAULT_TERMINAL_WIDTH = 80;
const DEFAULT_TERMINAL_HEIGHT = 24;

// Initial state
const initialTerminalState: TerminalUIState = {
  terminalWidth: DEFAULT_TERMINAL_WIDTH,
  terminalHeight: DEFAULT_TERMINAL_HEIGHT,
  mainAreaWidth: DEFAULT_TERMINAL_WIDTH,
  availableTerminalHeight: undefined,
  staticAreaMaxItemHeight: 0,
  staticExtraHeight: 0,
  inputWidth: DEFAULT_TERMINAL_WIDTH,
  suggestionsWidth: DEFAULT_TERMINAL_WIDTH,
  constrainHeight: false,
};

// Action types
type TerminalAction =
  | { type: 'SET_TERMINAL_WIDTH'; payload: number }
  | { type: 'SET_TERMINAL_HEIGHT'; payload: number }
  | {
      type: 'SET_TERMINAL_DIMENSIONS';
      payload: { width: number; height: number };
    }
  | { type: 'SET_MAIN_AREA_WIDTH'; payload: number }
  | { type: 'SET_AVAILABLE_TERMINAL_HEIGHT'; payload: number | undefined }
  | { type: 'SET_STATIC_AREA_MAX_ITEM_HEIGHT'; payload: number }
  | { type: 'SET_STATIC_EXTRA_HEIGHT'; payload: number }
  | { type: 'SET_INPUT_WIDTH'; payload: number }
  | { type: 'SET_SUGGESTIONS_WIDTH'; payload: number }
  | { type: 'SET_CONSTRAIN_HEIGHT'; payload: boolean }
  | { type: 'UPDATE_LAYOUT'; payload: Partial<TerminalUIState> };

// Reducer
function terminalReducer(
  state: TerminalUIState,
  action: TerminalAction,
): TerminalUIState {
  switch (action.type) {
    case 'SET_TERMINAL_WIDTH':
      return { ...state, terminalWidth: action.payload };
    case 'SET_TERMINAL_HEIGHT':
      return { ...state, terminalHeight: action.payload };
    case 'SET_TERMINAL_DIMENSIONS':
      return {
        ...state,
        terminalWidth: action.payload.width,
        terminalHeight: action.payload.height,
      };
    case 'SET_MAIN_AREA_WIDTH':
      return { ...state, mainAreaWidth: action.payload };
    case 'SET_AVAILABLE_TERMINAL_HEIGHT':
      return { ...state, availableTerminalHeight: action.payload };
    case 'SET_STATIC_AREA_MAX_ITEM_HEIGHT':
      return { ...state, staticAreaMaxItemHeight: action.payload };
    case 'SET_STATIC_EXTRA_HEIGHT':
      return { ...state, staticExtraHeight: action.payload };
    case 'SET_INPUT_WIDTH':
      return { ...state, inputWidth: action.payload };
    case 'SET_SUGGESTIONS_WIDTH':
      return { ...state, suggestionsWidth: action.payload };
    case 'SET_CONSTRAIN_HEIGHT':
      return { ...state, constrainHeight: action.payload };
    case 'UPDATE_LAYOUT':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Create context
const TerminalContext = createContext<TerminalContextValue | null>(null);

/**
 * Provider component for terminal state management.
 * Wrap your application with this provider to enable terminal state.
 */
export function TerminalStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(terminalReducer, initialTerminalState);

  // Create memoized actions
  const actions = useMemo<TerminalActions>(
    () => ({
      setTerminalWidth: (width: number) =>
        dispatch({ type: 'SET_TERMINAL_WIDTH', payload: width }),
      setTerminalHeight: (height: number) =>
        dispatch({ type: 'SET_TERMINAL_HEIGHT', payload: height }),
      setTerminalDimensions: (width: number, height: number) =>
        dispatch({
          type: 'SET_TERMINAL_DIMENSIONS',
          payload: { width, height },
        }),
      setMainAreaWidth: (width: number) =>
        dispatch({ type: 'SET_MAIN_AREA_WIDTH', payload: width }),
      setAvailableTerminalHeight: (height: number | undefined) =>
        dispatch({ type: 'SET_AVAILABLE_TERMINAL_HEIGHT', payload: height }),
      setStaticAreaMaxItemHeight: (height: number) =>
        dispatch({ type: 'SET_STATIC_AREA_MAX_ITEM_HEIGHT', payload: height }),
      setStaticExtraHeight: (height: number) =>
        dispatch({ type: 'SET_STATIC_EXTRA_HEIGHT', payload: height }),
      setInputWidth: (width: number) =>
        dispatch({ type: 'SET_INPUT_WIDTH', payload: width }),
      setSuggestionsWidth: (width: number) =>
        dispatch({ type: 'SET_SUGGESTIONS_WIDTH', payload: width }),
      setConstrainHeight: (constrain: boolean) =>
        dispatch({ type: 'SET_CONSTRAIN_HEIGHT', payload: constrain }),
      updateLayout: (updates: Partial<TerminalUIState>) =>
        dispatch({ type: 'UPDATE_LAYOUT', payload: updates }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

/**
 * Hook to access the full terminal context (state and actions).
 */
export function useTerminalContext(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error(
      'useTerminalContext must be used within a TerminalStateProvider',
    );
  }
  return context;
}

/**
 * Hook to access only terminal state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useTerminalState(): TerminalUIState {
  return useTerminalContext().state;
}

/**
 * Hook to access only terminal actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useTerminalActions(): TerminalActions {
  return useTerminalContext().actions;
}

/**
 * Hook to get terminal dimensions only.
 * Useful for components that only need width/height.
 */
export function useTerminalDimensions(): {
  width: number;
  height: number;
} {
  const state = useTerminalState();
  return {
    width: state.terminalWidth,
    height: state.terminalHeight,
  };
}

/**
 * Hook to get the available content area dimensions.
 * Accounts for headers, footers, and other UI chrome.
 */
export function useContentAreaDimensions(): {
  width: number;
  height: number | undefined;
} {
  const state = useTerminalState();
  return {
    width: state.mainAreaWidth,
    height: state.availableTerminalHeight,
  };
}
