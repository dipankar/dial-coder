/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dialog types supported by the queue system.
 * These represent all dialogs that can be queued for display.
 */
export enum DialogType {
  // High priority dialogs (system-level)
  WELCOME_BACK = 'welcome_back',
  IDE_RESTART = 'ide_restart',
  WORKSPACE_MIGRATION = 'workspace_migration',
  PRO_QUOTA = 'pro_quota',
  IDE_INTEGRATION = 'ide_integration',
  FOLDER_TRUST = 'folder_trust',

  // Confirmation dialogs
  SHELL_CONFIRMATION = 'shell_confirmation',
  LOOP_DETECTION = 'loop_detection',
  QUIT_CONFIRMATION = 'quit_confirmation',
  GENERAL_CONFIRMATION = 'general_confirmation',
  EXTENSION_UPDATE = 'extension_update',

  // Settings dialogs
  THEME = 'theme',
  SETTINGS = 'settings',
  APPROVAL_MODE = 'approval_mode',
  MODEL = 'model',
  VISION_SWITCH = 'vision_switch',

  // Auth dialogs
  AUTH = 'auth',
  API_KEY_PROMPT = 'api_key_prompt',
  OAUTH_PROGRESS = 'oauth_progress',

  // Editor dialogs
  EDITOR_SETTINGS = 'editor_settings',
  PERMISSIONS = 'permissions',

  // Subagent dialogs
  SUBAGENT_CREATE = 'subagent_create',
  AGENTS_MANAGER = 'agents_manager',
}

/**
 * Priority levels for dialogs.
 * Higher numbers = higher priority = shown first.
 */
export enum DialogPriority {
  LOW = 0,
  NORMAL = 10,
  HIGH = 20,
  CRITICAL = 30,
  SYSTEM = 40,
}

/**
 * Default priority mapping for dialog types.
 */
export const DEFAULT_DIALOG_PRIORITY: Record<DialogType, DialogPriority> = {
  // System-level (highest priority)
  [DialogType.WELCOME_BACK]: DialogPriority.SYSTEM,
  [DialogType.IDE_RESTART]: DialogPriority.SYSTEM,
  [DialogType.WORKSPACE_MIGRATION]: DialogPriority.CRITICAL,
  [DialogType.PRO_QUOTA]: DialogPriority.CRITICAL,
  [DialogType.IDE_INTEGRATION]: DialogPriority.CRITICAL,
  [DialogType.FOLDER_TRUST]: DialogPriority.CRITICAL,

  // Confirmations (high priority)
  [DialogType.SHELL_CONFIRMATION]: DialogPriority.HIGH,
  [DialogType.LOOP_DETECTION]: DialogPriority.HIGH,
  [DialogType.QUIT_CONFIRMATION]: DialogPriority.HIGH,
  [DialogType.GENERAL_CONFIRMATION]: DialogPriority.HIGH,
  [DialogType.EXTENSION_UPDATE]: DialogPriority.HIGH,

  // Settings (normal priority)
  [DialogType.THEME]: DialogPriority.NORMAL,
  [DialogType.SETTINGS]: DialogPriority.NORMAL,
  [DialogType.APPROVAL_MODE]: DialogPriority.NORMAL,
  [DialogType.MODEL]: DialogPriority.NORMAL,
  [DialogType.VISION_SWITCH]: DialogPriority.NORMAL,

  // Auth (normal priority)
  [DialogType.AUTH]: DialogPriority.NORMAL,
  [DialogType.API_KEY_PROMPT]: DialogPriority.NORMAL,
  [DialogType.OAUTH_PROGRESS]: DialogPriority.NORMAL,

  // Editor (normal priority)
  [DialogType.EDITOR_SETTINGS]: DialogPriority.NORMAL,
  [DialogType.PERMISSIONS]: DialogPriority.NORMAL,

  // Subagent (low priority)
  [DialogType.SUBAGENT_CREATE]: DialogPriority.LOW,
  [DialogType.AGENTS_MANAGER]: DialogPriority.LOW,
};

/**
 * A queued dialog item with all necessary metadata.
 */
export interface DialogQueueItem<T = Record<string, unknown>> {
  /** Unique identifier for this dialog instance */
  id: string;
  /** The type of dialog */
  type: DialogType;
  /** Props to pass to the dialog component */
  props: T;
  /** Priority for ordering (higher = shown first) */
  priority: DialogPriority;
  /** Timestamp when the dialog was queued */
  queuedAt: number;
  /** Optional callback when dialog is closed */
  onClose?: () => void;
}

/**
 * State for the dialog queue.
 */
export interface DialogQueueState {
  /** The queue of pending dialogs */
  queue: DialogQueueItem[];
  /** The currently displayed dialog (if any) */
  current: DialogQueueItem | null;
}

/**
 * Actions for the dialog queue reducer.
 */
export type DialogQueueAction =
  | { type: 'ENQUEUE'; payload: DialogQueueItem }
  | { type: 'DEQUEUE' }
  | { type: 'REMOVE'; payload: string }
  | { type: 'CLEAR' }
  | { type: 'CLEAR_TYPE'; payload: DialogType };

/**
 * Initial state for the dialog queue.
 */
export const initialDialogQueueState: DialogQueueState = {
  queue: [],
  current: null,
};

/**
 * Generate a unique ID for a dialog.
 */
export function generateDialogId(): string {
  return `dialog_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Compare two dialogs for priority ordering.
 * Returns negative if a should come before b.
 */
function compareDialogs(a: DialogQueueItem, b: DialogQueueItem): number {
  // Higher priority first
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  // If same priority, earlier queued first (FIFO within priority)
  return a.queuedAt - b.queuedAt;
}

/**
 * Reducer for dialog queue state.
 */
export function dialogQueueReducer(
  state: DialogQueueState,
  action: DialogQueueAction,
): DialogQueueState {
  switch (action.type) {
    case 'ENQUEUE': {
      const newQueue = [...state.queue, action.payload].sort(compareDialogs);

      // If no current dialog, immediately show the highest priority one
      if (!state.current && newQueue.length > 0) {
        const [first, ...rest] = newQueue;
        return {
          queue: rest,
          current: first,
        };
      }

      return {
        ...state,
        queue: newQueue,
      };
    }

    case 'DEQUEUE': {
      // Close current dialog and show next in queue
      if (state.queue.length === 0) {
        return {
          ...state,
          current: null,
        };
      }

      const [next, ...rest] = state.queue;
      return {
        queue: rest,
        current: next,
      };
    }

    case 'REMOVE': {
      // Remove a specific dialog by ID
      const id = action.payload;

      // If it's the current dialog, dequeue
      if (state.current?.id === id) {
        if (state.queue.length === 0) {
          return { ...state, current: null };
        }
        const [next, ...rest] = state.queue;
        return { queue: rest, current: next };
      }

      // Otherwise, remove from queue
      return {
        ...state,
        queue: state.queue.filter((d) => d.id !== id),
      };
    }

    case 'CLEAR': {
      return initialDialogQueueState;
    }

    case 'CLEAR_TYPE': {
      // Remove all dialogs of a specific type
      const type = action.payload;
      const newQueue = state.queue.filter((d) => d.type !== type);

      // If current is of this type, dequeue
      if (state.current?.type === type) {
        if (newQueue.length === 0) {
          return { queue: [], current: null };
        }
        const [next, ...rest] = newQueue;
        return { queue: rest, current: next };
      }

      return {
        ...state,
        queue: newQueue,
      };
    }

    default:
      return state;
  }
}

/**
 * Check if a dialog of a specific type is in the queue or currently displayed.
 */
export function hasDialogOfType(
  state: DialogQueueState,
  type: DialogType,
): boolean {
  if (state.current?.type === type) {
    return true;
  }
  return state.queue.some((d) => d.type === type);
}

/**
 * Get the count of dialogs of a specific type.
 */
export function countDialogsOfType(
  state: DialogQueueState,
  type: DialogType,
): number {
  let count = 0;
  if (state.current?.type === type) {
    count++;
  }
  count += state.queue.filter((d) => d.type === type).length;
  return count;
}
