/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { MODE_SYMBOLS, MODE_LABELS, MODE_HINTS } from '../constants.js';
import type { UserMode } from '../hooks/useUserModeIndicator.js';
import { t } from '../../i18n/index.js';

interface UserModeIndicatorProps {
  mode: UserMode;
  isManuallySelected?: boolean;
  confidence?: number;
}

/**
 * Get the color for a mode based on its characteristics.
 */
function getModeColor(mode: UserMode): string {
  switch (mode) {
    case 'ask':
      return theme.text.accent; // Blue - informational/read-only
    case 'quick':
      return theme.status.success; // Green - fast/simple
    case 'review':
      return theme.status.warning; // Yellow - moderate review
    case 'safe':
      return theme.status.error; // Red - full review (more thorough)
    default:
      return theme.text.primary;
  }
}

/**
 * Displays the current user execution mode.
 *
 * Modes:
 * - ask: Read-only queries (?)
 * - quick: Direct execution (⚡)
 * - review: Light review cycle (◎)
 * - safe: Full dialectic review (🛡)
 *
 * @example
 * ```tsx
 * <UserModeIndicator mode="review" />
 * // Renders: ◎ Review (tab to cycle)
 * ```
 */
export const UserModeIndicator: React.FC<UserModeIndicatorProps> = ({
  mode,
  isManuallySelected = true,
  confidence,
}) => {
  const symbol = MODE_SYMBOLS[mode];
  const label = MODE_LABELS[mode];
  const hint = MODE_HINTS[mode];
  const color = getModeColor(mode);

  // Format confidence as percentage for auto-selected modes
  const confidenceText =
    !isManuallySelected && confidence !== undefined
      ? ` ${Math.round(confidence * 100)}%`
      : '';

  return (
    <Box>
      <Text color={color}>
        {symbol} {label}
      </Text>
      {!isManuallySelected && (
        <Text color={theme.text.secondary}> [auto{confidenceText}]</Text>
      )}
      <Text color={theme.text.secondary}> ({hint})</Text>
      <Text color={theme.text.secondary}> {t('(tab to cycle)')}</Text>
    </Box>
  );
};
