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
import type { HistoryItem, HistoryItemWithoutId } from '../../types.js';

/**
 * State for history/message management.
 * This context manages conversation history and pending message queues.
 */
export interface HistoryUIState {
  // Core history (managed by historyManager hook)
  history: HistoryItem[];

  // Pending items from different sources
  pendingSlashCommandHistoryItems: HistoryItemWithoutId[];
  pendingGeminiHistoryItems: HistoryItemWithoutId[];
  pendingHistoryItems: HistoryItemWithoutId[];

  // Message queues
  messageQueue: string[];
  userMessages: string[];

  // UI control
  historyRemountKey: number;
  quittingMessages: HistoryItem[] | null;
}

/**
 * Actions available for manipulating history state.
 */
export interface HistoryActions {
  // History management (proxied from historyManager)
  setHistory: (history: HistoryItem[]) => void;
  addHistoryItem: (item: HistoryItemWithoutId) => void;
  clearHistory: () => void;

  // Pending slash command items
  addPendingSlashCommandItem: (item: HistoryItemWithoutId) => void;
  clearPendingSlashCommandItems: () => void;
  setPendingSlashCommandItems: (items: HistoryItemWithoutId[]) => void;

  // Pending Gemini items
  addPendingGeminiItem: (item: HistoryItemWithoutId) => void;
  clearPendingGeminiItems: () => void;
  setPendingGeminiItems: (items: HistoryItemWithoutId[]) => void;

  // General pending items
  addPendingItem: (item: HistoryItemWithoutId) => void;
  clearPendingItems: () => void;
  setPendingItems: (items: HistoryItemWithoutId[]) => void;

  // Message queue
  enqueueMessage: (message: string) => void;
  dequeueMessage: () => string | undefined;
  clearMessageQueue: () => void;

  // User messages
  addUserMessage: (message: string) => void;
  clearUserMessages: () => void;

  // UI control
  incrementHistoryRemountKey: () => void;
  setQuittingMessages: (messages: HistoryItem[] | null) => void;
}

/**
 * Combined context value for history state management.
 */
export interface HistoryContextValue {
  state: HistoryUIState;
  actions: HistoryActions;
}

// Initial state
const initialHistoryState: HistoryUIState = {
  history: [],
  pendingSlashCommandHistoryItems: [],
  pendingGeminiHistoryItems: [],
  pendingHistoryItems: [],
  messageQueue: [],
  userMessages: [],
  historyRemountKey: 0,
  quittingMessages: null,
};

// Action types
type HistoryAction =
  | { type: 'SET_HISTORY'; payload: HistoryItem[] }
  | { type: 'ADD_HISTORY_ITEM'; payload: HistoryItemWithoutId }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'ADD_PENDING_SLASH_COMMAND_ITEM'; payload: HistoryItemWithoutId }
  | { type: 'CLEAR_PENDING_SLASH_COMMAND_ITEMS' }
  | { type: 'SET_PENDING_SLASH_COMMAND_ITEMS'; payload: HistoryItemWithoutId[] }
  | { type: 'ADD_PENDING_GEMINI_ITEM'; payload: HistoryItemWithoutId }
  | { type: 'CLEAR_PENDING_GEMINI_ITEMS' }
  | { type: 'SET_PENDING_GEMINI_ITEMS'; payload: HistoryItemWithoutId[] }
  | { type: 'ADD_PENDING_ITEM'; payload: HistoryItemWithoutId }
  | { type: 'CLEAR_PENDING_ITEMS' }
  | { type: 'SET_PENDING_ITEMS'; payload: HistoryItemWithoutId[] }
  | { type: 'ENQUEUE_MESSAGE'; payload: string }
  | { type: 'DEQUEUE_MESSAGE' }
  | { type: 'CLEAR_MESSAGE_QUEUE' }
  | { type: 'ADD_USER_MESSAGE'; payload: string }
  | { type: 'CLEAR_USER_MESSAGES' }
  | { type: 'INCREMENT_HISTORY_REMOUNT_KEY' }
  | { type: 'SET_QUITTING_MESSAGES'; payload: HistoryItem[] | null };

// Reducer
function historyReducer(
  state: HistoryUIState,
  action: HistoryAction,
): HistoryUIState {
  switch (action.type) {
    case 'SET_HISTORY':
      return { ...state, history: action.payload };
    case 'ADD_HISTORY_ITEM':
      return {
        ...state,
        history: [...state.history, { ...action.payload, id: Date.now() }],
      };
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    case 'ADD_PENDING_SLASH_COMMAND_ITEM':
      return {
        ...state,
        pendingSlashCommandHistoryItems: [
          ...state.pendingSlashCommandHistoryItems,
          action.payload,
        ],
      };
    case 'CLEAR_PENDING_SLASH_COMMAND_ITEMS':
      return { ...state, pendingSlashCommandHistoryItems: [] };
    case 'SET_PENDING_SLASH_COMMAND_ITEMS':
      return { ...state, pendingSlashCommandHistoryItems: action.payload };
    case 'ADD_PENDING_GEMINI_ITEM':
      return {
        ...state,
        pendingGeminiHistoryItems: [
          ...state.pendingGeminiHistoryItems,
          action.payload,
        ],
      };
    case 'CLEAR_PENDING_GEMINI_ITEMS':
      return { ...state, pendingGeminiHistoryItems: [] };
    case 'SET_PENDING_GEMINI_ITEMS':
      return { ...state, pendingGeminiHistoryItems: action.payload };
    case 'ADD_PENDING_ITEM':
      return {
        ...state,
        pendingHistoryItems: [...state.pendingHistoryItems, action.payload],
      };
    case 'CLEAR_PENDING_ITEMS':
      return { ...state, pendingHistoryItems: [] };
    case 'SET_PENDING_ITEMS':
      return { ...state, pendingHistoryItems: action.payload };
    case 'ENQUEUE_MESSAGE':
      return {
        ...state,
        messageQueue: [...state.messageQueue, action.payload],
      };
    case 'DEQUEUE_MESSAGE':
      return { ...state, messageQueue: state.messageQueue.slice(1) };
    case 'CLEAR_MESSAGE_QUEUE':
      return { ...state, messageQueue: [] };
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        userMessages: [...state.userMessages, action.payload],
      };
    case 'CLEAR_USER_MESSAGES':
      return { ...state, userMessages: [] };
    case 'INCREMENT_HISTORY_REMOUNT_KEY':
      return { ...state, historyRemountKey: state.historyRemountKey + 1 };
    case 'SET_QUITTING_MESSAGES':
      return { ...state, quittingMessages: action.payload };
    default:
      return state;
  }
}

// Create context
const HistoryContext = createContext<HistoryContextValue | null>(null);

// Store dequeued message for return value
let lastDequeuedMessage: string | undefined;

/**
 * Provider component for history state management.
 * Wrap your application with this provider to enable history state.
 */
export function HistoryStateProvider({
  children,
}: PropsWithChildren): React.ReactElement {
  const [state, dispatch] = useReducer(historyReducer, initialHistoryState);

  // Create memoized actions
  const actions = useMemo<HistoryActions>(
    () => ({
      setHistory: (history: HistoryItem[]) =>
        dispatch({ type: 'SET_HISTORY', payload: history }),
      addHistoryItem: (item: HistoryItemWithoutId) =>
        dispatch({ type: 'ADD_HISTORY_ITEM', payload: item }),
      clearHistory: () => dispatch({ type: 'CLEAR_HISTORY' }),
      addPendingSlashCommandItem: (item: HistoryItemWithoutId) =>
        dispatch({ type: 'ADD_PENDING_SLASH_COMMAND_ITEM', payload: item }),
      clearPendingSlashCommandItems: () =>
        dispatch({ type: 'CLEAR_PENDING_SLASH_COMMAND_ITEMS' }),
      setPendingSlashCommandItems: (items: HistoryItemWithoutId[]) =>
        dispatch({ type: 'SET_PENDING_SLASH_COMMAND_ITEMS', payload: items }),
      addPendingGeminiItem: (item: HistoryItemWithoutId) =>
        dispatch({ type: 'ADD_PENDING_GEMINI_ITEM', payload: item }),
      clearPendingGeminiItems: () =>
        dispatch({ type: 'CLEAR_PENDING_GEMINI_ITEMS' }),
      setPendingGeminiItems: (items: HistoryItemWithoutId[]) =>
        dispatch({ type: 'SET_PENDING_GEMINI_ITEMS', payload: items }),
      addPendingItem: (item: HistoryItemWithoutId) =>
        dispatch({ type: 'ADD_PENDING_ITEM', payload: item }),
      clearPendingItems: () => dispatch({ type: 'CLEAR_PENDING_ITEMS' }),
      setPendingItems: (items: HistoryItemWithoutId[]) =>
        dispatch({ type: 'SET_PENDING_ITEMS', payload: items }),
      enqueueMessage: (message: string) =>
        dispatch({ type: 'ENQUEUE_MESSAGE', payload: message }),
      dequeueMessage: () => {
        // Store the message before dispatch so we can return it
        // Note: This is a workaround since reducers can't return values
        dispatch({ type: 'DEQUEUE_MESSAGE' });
        return lastDequeuedMessage;
      },
      clearMessageQueue: () => dispatch({ type: 'CLEAR_MESSAGE_QUEUE' }),
      addUserMessage: (message: string) =>
        dispatch({ type: 'ADD_USER_MESSAGE', payload: message }),
      clearUserMessages: () => dispatch({ type: 'CLEAR_USER_MESSAGES' }),
      incrementHistoryRemountKey: () =>
        dispatch({ type: 'INCREMENT_HISTORY_REMOUNT_KEY' }),
      setQuittingMessages: (messages: HistoryItem[] | null) =>
        dispatch({ type: 'SET_QUITTING_MESSAGES', payload: messages }),
    }),
    [],
  );

  // Track message queue head for dequeue return value
  lastDequeuedMessage = state.messageQueue[0];

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

/**
 * Hook to access the full history context (state and actions).
 */
export function useHistoryContext(): HistoryContextValue {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error(
      'useHistoryContext must be used within a HistoryStateProvider',
    );
  }
  return context;
}

/**
 * Hook to access only history state (for components that only read state).
 * Use this for better performance when you don't need actions.
 */
export function useHistoryState(): HistoryUIState {
  return useHistoryContext().state;
}

/**
 * Hook to access only history actions (for components that only dispatch).
 * Use this for better performance when you don't need to read state.
 */
export function useHistoryActions(): HistoryActions {
  return useHistoryContext().actions;
}

/**
 * Hook to check if there are any pending items in any queue.
 */
export function useHasPendingItems(): boolean {
  const state = useHistoryState();
  return (
    state.pendingSlashCommandHistoryItems.length > 0 ||
    state.pendingGeminiHistoryItems.length > 0 ||
    state.pendingHistoryItems.length > 0
  );
}

/**
 * Hook to check if the system is in a quitting state.
 */
export function useIsQuitting(): boolean {
  const state = useHistoryState();
  return state.quittingMessages !== null;
}
