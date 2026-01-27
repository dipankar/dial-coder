/**
 * @license
 * Copyright 2025 Dial Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import type { DialecticEvent, DialecticEventType } from '@dial-coder/core';

type ThemeType = typeof theme;

/**
 * Props for DialecticProgressDisplay component.
 */
export interface DialecticProgressDisplayProps {
  /** Current dialectic event */
  event: DialecticEvent | null;
  /** Whether dialectic is currently executing */
  isActive: boolean;
}

/**
 * Stage information for display.
 */
interface StageInfo {
  symbol: string;
  label: string;
  description: string;
  color: string;
}

/**
 * Get stage info for a dialectic event type.
 */
function getStageInfo(
  eventType: DialecticEventType,
  themeColors: ThemeType,
): StageInfo {
  switch (eventType) {
    case 'mode_selected':
      return {
        symbol: '◉',
        label: 'Mode',
        description: 'Selecting execution mode',
        color: themeColors.text.accent,
      };
    case 'round_start':
      return {
        symbol: '◎',
        label: 'Round',
        description: 'Starting dialectic round',
        color: themeColors.text.accent,
      };
    case 'thesis_start':
      return {
        symbol: '◐',
        label: 'Thesis',
        description: 'Proposer analyzing and planning...',
        color: themeColors.status.warning,
      };
    case 'thesis_complete':
      return {
        symbol: '●',
        label: 'Thesis',
        description: 'Proposal ready',
        color: themeColors.status.success,
      };
    case 'antithesis_start':
      return {
        symbol: '◐',
        label: 'Antithesis',
        description: 'Critic reviewing proposal...',
        color: themeColors.status.warning,
      };
    case 'antithesis_complete':
      return {
        symbol: '●',
        label: 'Antithesis',
        description: 'Review complete',
        color: themeColors.status.success,
      };
    case 'synthesis_start':
      return {
        symbol: '◐',
        label: 'Synthesis',
        description: 'Synthesizer resolving issues...',
        color: themeColors.status.warning,
      };
    case 'synthesis_complete':
      return {
        symbol: '●',
        label: 'Synthesis',
        description: 'Final implementation ready',
        color: themeColors.status.success,
      };
    case 'round_complete':
      return {
        symbol: '✓',
        label: 'Round',
        description: 'Round complete',
        color: themeColors.status.success,
      };
    case 'execution_complete':
      return {
        symbol: '✓',
        label: 'Complete',
        description: 'Dialectic execution finished',
        color: themeColors.status.success,
      };
    case 'execution_error':
      return {
        symbol: '✗',
        label: 'Error',
        description: 'Execution failed',
        color: themeColors.status.error,
      };
    default:
      return {
        symbol: '○',
        label: 'Processing',
        description: 'Working...',
        color: themeColors.text.secondary,
      };
  }
}

/**
 * Get current step in the dialectic process.
 */
function getStepProgress(eventType: DialecticEventType): {
  current: number;
  total: number;
} {
  const steps: DialecticEventType[] = [
    'thesis_start',
    'thesis_complete',
    'antithesis_start',
    'antithesis_complete',
    'synthesis_start',
    'synthesis_complete',
  ];

  const index = steps.indexOf(eventType);
  if (index === -1) {
    if (eventType === 'execution_complete' || eventType === 'round_complete') {
      return { current: 6, total: 6 };
    }
    return { current: 0, total: 6 };
  }

  return { current: index + 1, total: 6 };
}

/**
 * DialecticProgressDisplay - Shows the thesis → antithesis → synthesis progress.
 *
 * Displays a visual progress indicator for the dialectic process with:
 * - Current stage symbol and label
 * - Progress bar showing thesis → antithesis → synthesis steps
 * - Stage description
 *
 * @example
 * ```tsx
 * <DialecticProgressDisplay
 *   event={dialecticEvent}
 *   isActive={isDialecticActive}
 * />
 * ```
 */
export const DialecticProgressDisplay: React.FC<
  DialecticProgressDisplayProps
> = ({ event, isActive }) => {
  if (!isActive || !event) {
    return null;
  }

  const stageInfo = getStageInfo(event.type, theme);
  const progress = getStepProgress(event.type);

  // Build progress bar: [●●●○○○] style
  const progressChars = [];
  for (let i = 0; i < progress.total; i++) {
    if (i < progress.current) {
      progressChars.push('●');
    } else if (i === progress.current) {
      progressChars.push('◐');
    } else {
      progressChars.push('○');
    }
  }

  // Labels for the three main stages
  const stageLabels = ['Thesis', 'Antithesis', 'Synthesis'];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border.default}
      paddingX={1}
      marginBottom={1}
    >
      {/* Header with mode and round info */}
      <Box marginBottom={1}>
        <Text color={theme.text.accent} bold>
          ◆ Dialectic Mode
        </Text>
        {event.mode && (
          <Text color={theme.text.secondary}> ({event.mode})</Text>
        )}
        {event.round && (
          <Text color={theme.text.secondary}> • Round {event.round}</Text>
        )}
      </Box>

      {/* Progress bar with stage labels */}
      <Box flexDirection="column">
        <Box>
          {stageLabels.map((label, index) => {
            const stageStart = index * 2;
            const isComplete = progress.current > stageStart + 1;
            const isActive =
              progress.current === stageStart ||
              progress.current === stageStart + 1;

            let color = theme.text.secondary;
            if (isComplete) {
              color = theme.status.success;
            } else if (isActive) {
              color = theme.status.warning;
            }

            return (
              <Box key={label} marginRight={2}>
                <Text color={color}>
                  {isComplete ? '●' : isActive ? '◐' : '○'} {label}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* Connection line */}
        <Box marginY={0}>
          <Text color={theme.text.secondary}>
            {'─'.repeat(12)}
            {'→'}
            {'─'.repeat(12)}
            {'→'}
            {'─'.repeat(12)}
          </Text>
        </Box>
      </Box>

      {/* Current stage indicator */}
      <Box marginTop={1}>
        <Text color={stageInfo.color}>{stageInfo.symbol} </Text>
        <Text color={stageInfo.color} bold>
          {stageInfo.label}:
        </Text>
        <Text color={theme.text.primary}> {stageInfo.description}</Text>
      </Box>

      {/* Event message if present */}
      {event.message && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary} italic>
            {event.message}
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact version of the dialectic progress indicator.
 * Shows just a single line with the current stage.
 */
export const DialecticProgressCompact: React.FC<
  DialecticProgressDisplayProps
> = ({ event, isActive }) => {
  if (!isActive || !event) {
    return null;
  }

  const stageInfo = getStageInfo(event.type, theme);
  const progress = getStepProgress(event.type);

  return (
    <Box>
      <Text color={theme.text.accent}>◆ </Text>
      <Text color={stageInfo.color}>{stageInfo.symbol} </Text>
      <Text color={stageInfo.color} bold>
        {stageInfo.label}
      </Text>
      <Text color={theme.text.secondary}>
        {' '}
        ({progress.current}/{progress.total})
      </Text>
      {event.round && event.round > 1 && (
        <Text color={theme.text.secondary}> R{event.round}</Text>
      )}
    </Box>
  );
};
