/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { useReducer, useCallback } from 'react';
import {
  dialogQueueReducer,
  initialDialogQueueState,
  generateDialogId,
  hasDialogOfType,
  countDialogsOfType,
  DialogType,
  DialogPriority,
  DEFAULT_DIALOG_PRIORITY,
  type DialogQueueItem,
  type DialogQueueState,
} from './dialogQueue.js';

/**
 * Options for enqueuing a dialog.
 */
export interface EnqueueDialogOptions<T = Record<string, unknown>> {
  /** The type of dialog to show */
  type: DialogType;
  /** Props to pass to the dialog component */
  props?: T;
  /** Override the default priority for this dialog type */
  priority?: DialogPriority;
  /** Callback when the dialog is closed */
  onClose?: () => void;
}

/**
 * Return type for the useDialogQueue hook.
 */
export interface UseDialogQueueReturn {
  /** The current dialog to display (if any) */
  current: DialogQueueItem | null;
  /** The queue of pending dialogs */
  queue: DialogQueueItem[];
  /** The total number of dialogs (current + queued) */
  totalCount: number;

  // Actions
  /** Add a dialog to the queue */
  enqueue: <T = Record<string, unknown>>(
    options: EnqueueDialogOptions<T>,
  ) => string;
  /** Close the current dialog and show the next one */
  dequeue: () => void;
  /** Remove a specific dialog by ID */
  remove: (id: string) => void;
  /** Clear all dialogs */
  clear: () => void;
  /** Clear all dialogs of a specific type */
  clearType: (type: DialogType) => void;

  // Queries
  /** Check if a dialog of a specific type is in the queue or current */
  hasType: (type: DialogType) => boolean;
  /** Count dialogs of a specific type */
  countType: (type: DialogType) => number;
  /** Check if the queue is empty (no current and no pending) */
  isEmpty: boolean;
}

/**
 * Hook for managing a priority queue of dialogs.
 *
 * This hook provides a structured way to manage multiple dialogs,
 * with automatic priority-based ordering and queueing.
 *
 * @example
 * ```tsx
 * const { current, enqueue, dequeue, hasType } = useDialogQueue();
 *
 * // Enqueue a dialog
 * const dialogId = enqueue({
 *   type: DialogType.SHELL_CONFIRMATION,
 *   props: { command: 'rm -rf /' },
 * });
 *
 * // Check if a dialog type is active
 * if (hasType(DialogType.SETTINGS)) {
 *   console.log('Settings dialog is open or queued');
 * }
 *
 * // Close current dialog
 * dequeue();
 * ```
 */
export function useDialogQueue(): UseDialogQueueReturn {
  const [state, dispatch] = useReducer(
    dialogQueueReducer,
    initialDialogQueueState,
  );

  const enqueue = useCallback(
    <T = Record<string, unknown>>(options: EnqueueDialogOptions<T>): string => {
      const id = generateDialogId();
      const priority =
        options.priority ?? DEFAULT_DIALOG_PRIORITY[options.type];

      const item: DialogQueueItem<T> = {
        id,
        type: options.type,
        props: options.props ?? ({} as T),
        priority,
        queuedAt: Date.now(),
        onClose: options.onClose,
      };

      dispatch({ type: 'ENQUEUE', payload: item as DialogQueueItem });
      return id;
    },
    [],
  );

  const dequeue = useCallback(() => {
    // Call onClose callback for current dialog if it exists
    if (state.current?.onClose) {
      state.current.onClose();
    }
    dispatch({ type: 'DEQUEUE' });
  }, [state]);

  const remove = useCallback(
    (id: string) => {
      // Call onClose callback if removing current dialog
      if (state.current?.id === id && state.current.onClose) {
        state.current.onClose();
      }
      dispatch({ type: 'REMOVE', payload: id });
    },
    [state],
  );

  const clear = useCallback(() => {
    // Call onClose for current dialog
    if (state.current?.onClose) {
      state.current.onClose();
    }
    dispatch({ type: 'CLEAR' });
  }, [state]);

  const clearType = useCallback(
    (type: DialogType) => {
      // Call onClose for current dialog if it's of this type
      if (state.current?.type === type && state.current.onClose) {
        state.current.onClose();
      }
      dispatch({ type: 'CLEAR_TYPE', payload: type });
    },
    [state],
  );

  const hasType = useCallback(
    (type: DialogType) => hasDialogOfType(state, type),
    [state],
  );

  const countType = useCallback(
    (type: DialogType) => countDialogsOfType(state, type),
    [state],
  );

  const totalCount = state.queue.length + (state.current ? 1 : 0);

  const isEmpty = !state.current && state.queue.length === 0;

  return {
    current: state.current,
    queue: state.queue,
    totalCount,
    enqueue,
    dequeue,
    remove,
    clear,
    clearType,
    hasType,
    countType,
    isEmpty,
  };
}

// Re-export types for convenience
export {
  DialogType,
  DialogPriority,
  type DialogQueueItem,
  type DialogQueueState,
};
