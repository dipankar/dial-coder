/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { MODE_SYMBOLS, MODE_LABELS, MODE_HINTS } from '../constants.js';

/**
 * User-facing execution modes.
 */
export type UserMode = 'ask' | 'quick' | 'review' | 'safe';

interface ModeIndicatorProps {
  /** Current execution mode */
  mode: UserMode;
  /** Whether to show the hint text */
  showHint?: boolean;
  /** Whether mode was auto-selected */
  isAutoSelected?: boolean;
  /** Confidence level (0-1) for auto-selected modes */
  confidence?: number;
}

/**
 * Get the color for a mode based on its risk level.
 */
function getModeColor(mode: UserMode): string {
  switch (mode) {
    case 'ask':
      return theme.text.accent; // Blue - informational
    case 'quick':
      return theme.status.success; // Green - fast/safe for simple
    case 'review':
      return theme.status.warning; // Yellow - moderate caution
    case 'safe':
      return theme.status.error; // Red - high caution/thorough
    default:
      return theme.text.primary;
  }
}

/**
 * Displays the current execution mode with visual indicator.
 *
 * Modes:
 * - ask: Read-only queries (?)
 * - quick: Direct execution (⚡)
 * - review: Light review cycle (◎)
 * - safe: Full dialectic review (🛡)
 *
 * @example
 * ```tsx
 * <ModeIndicator mode="safe" showHint />
 * // Renders: 🛡 Safe (full review cycle)
 *
 * <ModeIndicator mode="quick" isAutoSelected confidence={0.85} />
 * // Renders: ⚡ Quick [auto 85%]
 * ```
 */
export const ModeIndicator: React.FC<ModeIndicatorProps> = ({
  mode,
  showHint = false,
  isAutoSelected = false,
  confidence,
}) => {
  const symbol = MODE_SYMBOLS[mode];
  const label = MODE_LABELS[mode];
  const hint = MODE_HINTS[mode];
  const color = getModeColor(mode);

  // Format confidence as percentage
  const confidenceText =
    confidence !== undefined ? ` ${Math.round(confidence * 100)}%` : '';

  return (
    <Box>
      <Text color={color}>
        {symbol} {label}
      </Text>
      {isAutoSelected && (
        <Text color={theme.text.secondary}> [auto{confidenceText}]</Text>
      )}
      {showHint && <Text color={theme.text.secondary}> ({hint})</Text>}
    </Box>
  );
};

/**
 * Compact mode badge for inline display.
 */
export const ModeBadge: React.FC<{ mode: UserMode }> = ({ mode }) => {
  const symbol = MODE_SYMBOLS[mode];
  const color = getModeColor(mode);

  return <Text color={color}>[{symbol}]</Text>;
};

/**
 * Mode selection summary for displaying mode analysis results.
 */
interface ModeSelectionSummaryProps {
  mode: UserMode;
  confidence: number;
  reasons: string[];
  isAutoSelected: boolean;
}

export const ModeSelectionSummary: React.FC<ModeSelectionSummaryProps> = ({
  mode,
  confidence,
  reasons,
  isAutoSelected,
}) => {
  const color = getModeColor(mode);
  const label = MODE_LABELS[mode];
  const hint = MODE_HINTS[mode];

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box>
        <Text color={color} bold>
          {MODE_SYMBOLS[mode]} {label}
        </Text>
        <Text color={theme.text.secondary}> - {hint}</Text>
      </Box>
      {isAutoSelected && (
        <Box paddingLeft={2}>
          <Text color={theme.text.secondary}>
            Auto-selected ({Math.round(confidence * 100)}% confidence)
          </Text>
        </Box>
      )}
      {reasons.length > 0 && (
        <Box flexDirection="column" paddingLeft={2}>
          {reasons.map((reason, i) => (
            <Text key={i} color={theme.text.secondary}>
              • {reason}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
