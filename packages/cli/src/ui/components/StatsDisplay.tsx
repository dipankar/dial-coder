/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { theme } from '../semantic-colors.js';
import { formatDuration } from '../utils/formatters.js';
import type { ModelMetrics } from '../contexts/SessionContext.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import {
  getStatusColor,
  TOOL_SUCCESS_RATE_HIGH,
  TOOL_SUCCESS_RATE_MEDIUM,
  USER_AGREEMENT_RATE_HIGH,
  USER_AGREEMENT_RATE_MEDIUM,
} from '../utils/displayUtils.js';
import { computeSessionStats } from '../utils/computeStats.js';
import { t } from '../../i18n/index.js';
import type { ModeStats } from '@dial-code/dial-core';

// A more flexible and powerful StatRow component
interface StatRowProps {
  title: string;
  children: React.ReactNode; // Use children to allow for complex, colored values
}

const StatRow: React.FC<StatRowProps> = ({ title, children }) => (
  <Box>
    {/* Fixed width for the label creates a clean "gutter" for alignment */}
    <Box width={28}>
      <Text color={theme.text.link}>{title}</Text>
    </Box>
    {/* FIX: Wrap children in a Box that can grow to fill remaining space */}
    <Box flexGrow={1}>{children}</Box>
  </Box>
);

// A SubStatRow for indented, secondary information
interface SubStatRowProps {
  title: string;
  children: React.ReactNode;
}

const SubStatRow: React.FC<SubStatRowProps> = ({ title, children }) => (
  <Box paddingLeft={2}>
    {/* Adjust width for the "» " prefix */}
    <Box width={26}>
      <Text color={theme.text.secondary}>» {title}</Text>
    </Box>
    {/* FIX: Apply the same flexGrow fix here */}
    <Box flexGrow={1}>{children}</Box>
  </Box>
);

// A Section component to group related stats
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box flexDirection="column" width="100%" marginBottom={1}>
    <Text bold color={theme.text.primary}>
      {title}
    </Text>
    {children}
  </Box>
);

/** Mode display configuration */
const MODE_CONFIG: Record<
  string,
  { symbol: string; label: string; color: string }
> = {
  ask: { symbol: '?', label: 'Ask', color: theme.text.accent },
  quick: { symbol: '\u26A1', label: 'Quick', color: theme.status.success },
  review: { symbol: '\u25CE', label: 'Review', color: theme.status.warning },
  safe: { symbol: '\uD83D\uDEE1', label: 'Safe', color: theme.status.error },
};

const ModeUsageTable: React.FC<{
  modes: Record<string, ModeStats>;
}> = ({ modes }) => {
  const modeWidth = 12;
  const countWidth = 8;
  const tokensWidth = 15;

  // Calculate totals
  const totalCount = Object.values(modes).reduce((sum, m) => sum + m.count, 0);
  const totalTokens = Object.values(modes).reduce(
    (sum, m) => sum + m.totalTokens,
    0,
  );

  // Only show if there's any mode usage
  if (totalCount === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Box width={modeWidth}>
          <Text bold color={theme.text.primary}>
            {t('Mode')}
          </Text>
        </Box>
        <Box width={countWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {t('Uses')}
          </Text>
        </Box>
        <Box width={tokensWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {t('Tokens')}
          </Text>
        </Box>
      </Box>
      {/* Divider */}
      <Box
        borderStyle="round"
        borderBottom={true}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor={theme.border.default}
        width={modeWidth + countWidth + tokensWidth}
      ></Box>

      {/* Rows - only show modes that were used */}
      {Object.entries(modes)
        .filter(([, modeStats]) => modeStats.count > 0)
        .map(([modeName, modeStats]) => {
          const config = MODE_CONFIG[modeName] || {
            symbol: '?',
            label: modeName,
            color: theme.text.primary,
          };
          return (
            <Box key={modeName}>
              <Box width={modeWidth}>
                <Text color={config.color}>
                  {config.symbol} {config.label}
                </Text>
              </Box>
              <Box width={countWidth} justifyContent="flex-end">
                <Text color={theme.text.primary}>{modeStats.count}</Text>
              </Box>
              <Box width={tokensWidth} justifyContent="flex-end">
                <Text color={theme.status.warning}>
                  {modeStats.totalTokens.toLocaleString()}
                </Text>
              </Box>
            </Box>
          );
        })}

      {/* Total row */}
      <Box marginTop={1}>
        <Box width={modeWidth}>
          <Text bold color={theme.text.primary}>
            {t('Total')}
          </Text>
        </Box>
        <Box width={countWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {totalCount}
          </Text>
        </Box>
        <Box width={tokensWidth} justifyContent="flex-end">
          <Text bold color={theme.status.warning}>
            {totalTokens.toLocaleString()}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

const ModelUsageTable: React.FC<{
  models: Record<string, ModelMetrics>;
  totalCachedTokens: number;
  cacheEfficiency: number;
}> = ({ models, totalCachedTokens, cacheEfficiency }) => {
  const nameWidth = 25;
  const requestsWidth = 8;
  const inputTokensWidth = 15;
  const outputTokensWidth = 15;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Box width={nameWidth}>
          <Text bold color={theme.text.primary}>
            {t('Model Usage')}
          </Text>
        </Box>
        <Box width={requestsWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {t('Reqs')}
          </Text>
        </Box>
        <Box width={inputTokensWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {t('Input Tokens')}
          </Text>
        </Box>
        <Box width={outputTokensWidth} justifyContent="flex-end">
          <Text bold color={theme.text.primary}>
            {t('Output Tokens')}
          </Text>
        </Box>
      </Box>
      {/* Divider */}
      <Box
        borderStyle="round"
        borderBottom={true}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        borderColor={theme.border.default}
        width={nameWidth + requestsWidth + inputTokensWidth + outputTokensWidth}
      ></Box>

      {/* Rows */}
      {Object.entries(models).map(([name, modelMetrics]) => (
        <Box key={name}>
          <Box width={nameWidth}>
            <Text color={theme.text.primary}>{name.replace('-001', '')}</Text>
          </Box>
          <Box width={requestsWidth} justifyContent="flex-end">
            <Text color={theme.text.primary}>
              {modelMetrics.api.totalRequests}
            </Text>
          </Box>
          <Box width={inputTokensWidth} justifyContent="flex-end">
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.prompt.toLocaleString()}
            </Text>
          </Box>
          <Box width={outputTokensWidth} justifyContent="flex-end">
            <Text color={theme.status.warning}>
              {modelMetrics.tokens.candidates.toLocaleString()}
            </Text>
          </Box>
        </Box>
      ))}
      {cacheEfficiency > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text.primary}>
            <Text color={theme.status.success}>{t('Savings Highlight:')}</Text>{' '}
            {totalCachedTokens.toLocaleString()} ({cacheEfficiency.toFixed(1)}
            %){' '}
            {t('of input tokens were served from the cache, reducing costs.')}
          </Text>
          <Box height={1} />
          <Text color={theme.text.secondary}>
            » {t('Tip: For a full token breakdown, run `/stats model`.')}
          </Text>
        </Box>
      )}
    </Box>
  );
};

interface StatsDisplayProps {
  duration: string;
  title?: string;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  duration,
  title,
}) => {
  const { stats } = useSessionStats();
  const { metrics } = stats;
  const { models, tools, files, modes } = metrics;
  const computed = computeSessionStats(metrics);

  const successThresholds = {
    green: TOOL_SUCCESS_RATE_HIGH,
    yellow: TOOL_SUCCESS_RATE_MEDIUM,
  };
  const agreementThresholds = {
    green: USER_AGREEMENT_RATE_HIGH,
    yellow: USER_AGREEMENT_RATE_MEDIUM,
  };
  const successColor = getStatusColor(computed.successRate, successThresholds);
  const agreementColor = getStatusColor(
    computed.agreementRate,
    agreementThresholds,
  );

  const renderTitle = () => {
    if (title) {
      return theme.ui.gradient && theme.ui.gradient.length > 0 ? (
        <Gradient colors={theme.ui.gradient}>
          <Text bold color={theme.text.primary}>
            {title}
          </Text>
        </Gradient>
      ) : (
        <Text bold color={theme.text.accent}>
          {title}
        </Text>
      );
    }
    return (
      <Text bold color={theme.text.accent}>
        {t('Session Stats')}
      </Text>
    );
  };

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingY={1}
      paddingX={2}
    >
      {renderTitle()}
      <Box height={1} />

      <Section title={t('Interaction Summary')}>
        <StatRow title={t('Session ID:')}>
          <Text color={theme.text.primary}>{stats.sessionId}</Text>
        </StatRow>
        <StatRow title={t('Tool Calls:')}>
          <Text color={theme.text.primary}>
            {tools.totalCalls} ({' '}
            <Text color={theme.status.success}>✓ {tools.totalSuccess}</Text>{' '}
            <Text color={theme.status.error}>x {tools.totalFail}</Text> )
          </Text>
        </StatRow>
        <StatRow title={t('Success Rate:')}>
          <Text color={successColor}>{computed.successRate.toFixed(1)}%</Text>
        </StatRow>
        {computed.totalDecisions > 0 && (
          <StatRow title={t('User Agreement:')}>
            <Text color={agreementColor}>
              {computed.agreementRate.toFixed(1)}%{' '}
              <Text color={theme.text.secondary}>
                ({computed.totalDecisions} {t('reviewed')})
              </Text>
            </Text>
          </StatRow>
        )}
        {files &&
          (files.totalLinesAdded > 0 || files.totalLinesRemoved > 0) && (
            <StatRow title={t('Code Changes:')}>
              <Text color={theme.text.primary}>
                <Text color={theme.status.success}>
                  +{files.totalLinesAdded}
                </Text>{' '}
                <Text color={theme.status.error}>
                  -{files.totalLinesRemoved}
                </Text>
              </Text>
            </StatRow>
          )}
      </Section>

      <Section title={t('Performance')}>
        <StatRow title={t('Wall Time:')}>
          <Text color={theme.text.primary}>{duration}</Text>
        </StatRow>
        <StatRow title={t('Agent Active:')}>
          <Text color={theme.text.primary}>
            {formatDuration(computed.agentActiveTime)}
          </Text>
        </StatRow>
        <SubStatRow title={t('API Time:')}>
          <Text color={theme.text.primary}>
            {formatDuration(computed.totalApiTime)}{' '}
            <Text color={theme.text.secondary}>
              ({computed.apiTimePercent.toFixed(1)}%)
            </Text>
          </Text>
        </SubStatRow>
        <SubStatRow title={t('Tool Time:')}>
          <Text color={theme.text.primary}>
            {formatDuration(computed.totalToolTime)}{' '}
            <Text color={theme.text.secondary}>
              ({computed.toolTimePercent.toFixed(1)}%)
            </Text>
          </Text>
        </SubStatRow>
      </Section>

      {Object.keys(models).length > 0 && (
        <ModelUsageTable
          models={models}
          totalCachedTokens={computed.totalCachedTokens}
          cacheEfficiency={computed.cacheEfficiency}
        />
      )}

      {modes && <ModeUsageTable modes={modes} />}
    </Box>
  );
};
