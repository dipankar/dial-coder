/**
 * @license
 * Copyright 2025 Dial Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { DiffRenderer } from './messages/DiffRenderer.js';
import type { TaskResult, FinalPatch } from '@dial-code/dial-core';

type ThemeType = typeof theme;

/**
 * Props for DialecticResultDisplay component.
 */
export interface DialecticResultDisplayProps {
  /** Task result from dialectic execution */
  result: TaskResult;
  /** Whether to show detailed output */
  detailed?: boolean;
}

/**
 * Get color for outcome status.
 */
function getOutcomeColor(success: boolean, themeColors: ThemeType): string {
  return success ? themeColors.status.success : themeColors.status.error;
}

/**
 * Get symbol for outcome status.
 */
function getOutcomeSymbol(success: boolean): string {
  return success ? '✓' : '✗';
}

/**
 * Format a patch for display.
 */
function formatPatchDescription(patch: FinalPatch): string {
  const actionLabel =
    patch.action === 'create'
      ? 'Create'
      : patch.action === 'edit'
        ? 'Edit'
        : patch.action === 'delete'
          ? 'Delete'
          : patch.action;
  return `${actionLabel}: ${patch.file}`;
}

/**
 * Generate a unified diff string from a patch.
 */
function generateDiffFromPatch(patch: FinalPatch): string {
  if (patch.action === 'create') {
    // For new files, show all lines as additions
    const lines = (patch.replace || patch.content || '').split('\n');
    const additions = lines.map((line: string) => `+${line}`).join('\n');
    return `--- /dev/null
+++ b/${patch.file}
@@ -0,0 +1,${lines.length} @@
${additions}`;
  }

  if (patch.action === 'delete') {
    return `--- a/${patch.file}
+++ /dev/null
@@ -1,1 +0,0 @@
-[File deleted]`;
  }

  if (patch.action === 'edit' && patch.search && patch.replace) {
    const searchLines = patch.search.split('\n');
    const replaceLines = patch.replace.split('\n');
    const removals = searchLines.map((line: string) => `-${line}`).join('\n');
    const additions = replaceLines.map((line: string) => `+${line}`).join('\n');

    return `--- a/${patch.file}
+++ b/${patch.file}
@@ -1,${searchLines.length} +1,${replaceLines.length} @@
${removals}
${additions}`;
  }

  // Fallback for other cases
  return `--- a/${patch.file}
+++ b/${patch.file}
@@ -1,1 +1,1 @@
 ${patch.description || 'Changes applied'}`;
}

/**
 * DialecticResultDisplay - Shows the result of dialectic execution.
 *
 * Displays:
 * - Overall success/failure status
 * - Number of rounds taken
 * - Patches applied with diff visualization
 * - Summary message
 *
 * @example
 * ```tsx
 * <DialecticResultDisplay
 *   result={taskResult}
 *   detailed={true}
 * />
 * ```
 */
export const DialecticResultDisplay: React.FC<DialecticResultDisplayProps> = ({
  result,
  detailed = false,
}) => {
  const outcomeColor = getOutcomeColor(result.success, theme);
  const outcomeSymbol = getOutcomeSymbol(result.success);
  const terminalWidth = process.stdout.columns || 80;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor={outcomeColor}
        paddingX={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          {/* Status line */}
          <Box>
            <Text color={outcomeColor} bold>
              {outcomeSymbol} Dialectic {result.success ? 'Complete' : 'Failed'}
            </Text>
            <Text color={theme.text.secondary}>
              {' '}
              • {result.rounds} round{result.rounds !== 1 ? 's' : ''}
            </Text>
            {result.patches.length > 0 && (
              <Text color={theme.text.secondary}>
                {' '}
                • {result.patches.length} patch
                {result.patches.length !== 1 ? 'es' : ''}
              </Text>
            )}
          </Box>

          {/* Summary */}
          {result.summary && (
            <Box marginTop={1}>
              <Text color={theme.text.primary}>{result.summary}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Patches with diff display */}
      {result.patches.length > 0 && detailed && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text.accent} bold>
            Changes Applied:
          </Text>
          {result.patches.map((patch, index) => (
            <Box
              key={`${patch.file}-${index}`}
              flexDirection="column"
              marginTop={1}
              borderStyle="single"
              borderColor={theme.border.default}
              paddingX={1}
            >
              {/* Patch header */}
              <Box marginBottom={1}>
                <Text color={theme.text.accent}>
                  {formatPatchDescription(patch)}
                </Text>
                {patch.description && (
                  <Text color={theme.text.secondary}>
                    {' '}
                    — {patch.description}
                  </Text>
                )}
              </Box>

              {/* Diff visualization */}
              <DiffRenderer
                diffContent={generateDiffFromPatch(patch)}
                filename={patch.file}
                terminalWidth={terminalWidth}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Compact patch list (non-detailed mode) */}
      {result.patches.length > 0 && !detailed && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text.secondary}>Files modified:</Text>
          {result.patches.map((patch, index) => (
            <Box key={`${patch.file}-${index}`} marginLeft={2}>
              <Text color={theme.text.primary}>• {patch.file}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact summary of dialectic result for inline display.
 */
export const DialecticResultSummary: React.FC<{ result: TaskResult }> = ({
  result,
}) => {
  const outcomeColor = getOutcomeColor(result.success, theme);
  const outcomeSymbol = getOutcomeSymbol(result.success);

  return (
    <Box>
      <Text color={outcomeColor}>
        {outcomeSymbol} Dialectic: {result.success ? 'Success' : 'Failed'}
      </Text>
      <Text color={theme.text.secondary}>
        {' '}
        ({result.rounds} round{result.rounds !== 1 ? 's' : ''},{' '}
        {result.patches.length} patch{result.patches.length !== 1 ? 'es' : ''})
      </Text>
    </Box>
  );
};
