/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useState } from 'react';
import { useKeypress } from './useKeypress.js';
import type { HistoryItemWithoutId } from '../types.js';
import { MessageType } from '../types.js';

/**
 * User-facing execution modes.
 * - ask: Read-only queries, no file changes
 * - quick: Simple tasks with direct execution
 * - review: Single review cycle with verification
 * - safe: Multi-round review with full verification
 */
export type UserMode = 'ask' | 'quick' | 'review' | 'safe';

/**
 * All available user modes in cycle order.
 */
export const USER_MODES: readonly UserMode[] = [
  'ask',
  'quick',
  'review',
  'safe',
] as const;

/**
 * Mode selection result from auto-detection.
 */
export interface ModeSelectionInfo {
  mode: UserMode;
  isAutoSelected: boolean;
  confidence: number;
  reasons: string[];
}

export interface UseUserModeIndicatorArgs {
  /** Initial mode (defaults to 'quick') */
  initialMode?: UserMode;
  /** Callback when mode changes */
  onModeChange?: (mode: UserMode, isManual: boolean) => void;
  /** Function to add info messages to history */
  addItem?: (item: HistoryItemWithoutId, timestamp: number) => void;
  /** Whether the hook is active (Tab key listening) */
  isActive?: boolean;
  /** Callback to sync with approval mode (for 'ask' mode) */
  onSyncApprovalMode?: (mode: UserMode) => void;
}

export interface UseUserModeIndicatorReturn {
  /** Current user mode */
  mode: UserMode;
  /** Whether mode was manually selected (vs auto) */
  isManuallySelected: boolean;
  /** Set mode programmatically */
  setMode: (mode: UserMode, isManual?: boolean) => void;
  /** Set mode from auto-selection result */
  setAutoSelectedMode: (info: ModeSelectionInfo) => void;
  /** Cycle to next mode (called by Tab) */
  cycleMode: () => void;
  /** Auto-selection info if available */
  autoSelectionInfo: ModeSelectionInfo | null;
}

/**
 * Hook for managing user execution mode with Tab key cycling.
 *
 * - Tab: Cycle through modes (ask → quick → review → safe → ask)
 * - Modes determine the depth of reasoning/review before execution
 *
 * @example
 * ```tsx
 * const { mode, isManuallySelected, setAutoSelectedMode } = useUserModeIndicator({
 *   initialMode: 'quick',
 *   onModeChange: (mode) => console.log(`Mode changed to ${mode}`),
 * });
 *
 * // Display current mode
 * <ModeIndicator mode={mode} isAutoSelected={!isManuallySelected} />
 * ```
 */
/**
 * Get a description for each mode.
 */
function getModeDescription(mode: UserMode): string {
  switch (mode) {
    case 'ask':
      return 'Read-only mode - no file changes allowed';
    case 'quick':
      return 'Direct execution - fast, minimal review';
    case 'review':
      return 'Review mode - single verification cycle';
    case 'safe':
      return 'Safe mode - full dialectic review';
    default:
      return '';
  }
}

export function useUserModeIndicator({
  initialMode = 'quick',
  onModeChange,
  addItem,
  isActive = true,
  onSyncApprovalMode,
}: UseUserModeIndicatorArgs = {}): UseUserModeIndicatorReturn {
  const [mode, setModeState] = useState<UserMode>(initialMode);
  const [isManuallySelected, setIsManuallySelected] = useState(false);
  const [autoSelectionInfo, setAutoSelectionInfo] =
    useState<ModeSelectionInfo | null>(null);

  const applyModeChange = useCallback(
    (newMode: UserMode, isManual: boolean) => {
      setModeState(newMode);
      setIsManuallySelected(isManual);
      if (isManual) {
        setAutoSelectionInfo(null);
      }
      onModeChange?.(newMode, isManual);
      // Sync with approval mode system
      onSyncApprovalMode?.(newMode);
    },
    [onModeChange, onSyncApprovalMode],
  );

  const setMode = useCallback(
    (newMode: UserMode, isManual = true) => {
      applyModeChange(newMode, isManual);
    },
    [applyModeChange],
  );

  const setAutoSelectedMode = useCallback(
    (info: ModeSelectionInfo) => {
      setModeState(info.mode);
      setIsManuallySelected(false);
      setAutoSelectionInfo(info);
      onModeChange?.(info.mode, false);
      onSyncApprovalMode?.(info.mode);
    },
    [onModeChange, onSyncApprovalMode],
  );

  const cycleMode = useCallback(() => {
    const currentIndex = USER_MODES.indexOf(mode);
    const nextIndex = (currentIndex + 1) % USER_MODES.length;
    const nextMode = USER_MODES[nextIndex];

    applyModeChange(nextMode, true);

    // Show mode change message with description
    const description = getModeDescription(nextMode);
    addItem?.(
      {
        type: MessageType.INFO,
        text: `Mode: ${nextMode} - ${description}`,
      },
      Date.now(),
    );
  }, [mode, applyModeChange, addItem]);

  // Tab key cycles through modes
  useKeypress(
    (key) => {
      // Tab (without Shift) cycles UserMode
      // Shift+Tab is reserved for ApprovalMode cycling
      if (key.name === 'tab' && !key.shift) {
        cycleMode();
      }
    },
    { isActive },
  );

  return {
    mode,
    isManuallySelected,
    setMode,
    setAutoSelectedMode,
    cycleMode,
    autoSelectionInfo,
  };
}
