/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Internal execution modes.
 * These are used internally and mapped to user-facing names in CLI.
 */
export type InternalMode =
  | 'read_only'
  | 'simple'
  | 'dialectic_light'
  | 'dialectic_full';

/**
 * User-facing mode names for CLI.
 */
export type UserMode = 'ask' | 'quick' | 'review' | 'safe';

/**
 * Mapping from internal to user-facing mode names.
 */
export const MODE_DISPLAY_NAMES: Record<InternalMode, UserMode> = {
  read_only: 'ask',
  simple: 'quick',
  dialectic_light: 'review',
  dialectic_full: 'safe',
};

/**
 * Mapping from user-facing to internal mode names.
 */
export const MODE_INTERNAL_NAMES: Record<UserMode, InternalMode> = {
  ask: 'read_only',
  quick: 'simple',
  review: 'dialectic_light',
  safe: 'dialectic_full',
};

/**
 * Mode descriptions for help text.
 */
export const MODE_DESCRIPTIONS: Record<UserMode, string> = {
  ask: 'Information queries only, no file changes',
  quick: 'Simple tasks with direct execution',
  review: 'Single review cycle with verification',
  safe: 'Multi-round review with full verification',
};

/**
 * Mode characteristics for selection logic.
 */
export interface ModeCharacteristics {
  /** Whether this mode can modify files */
  canModifyFiles: boolean;
  /** Whether this mode runs verification tests */
  runsTests: boolean;
  /** Number of review cycles (0 = none) */
  reviewCycles: number;
  /** Whether reflector agent runs */
  collectsLearnings: boolean;
  /** Relative token cost (1 = baseline) */
  tokenCostMultiplier: number;
}

/**
 * Characteristics for each mode.
 */
export const MODE_CHARACTERISTICS: Record<InternalMode, ModeCharacteristics> = {
  read_only: {
    canModifyFiles: false,
    runsTests: false,
    reviewCycles: 0,
    collectsLearnings: false,
    tokenCostMultiplier: 0.5,
  },
  simple: {
    canModifyFiles: true,
    runsTests: true,
    reviewCycles: 0,
    collectsLearnings: false,
    tokenCostMultiplier: 1,
  },
  dialectic_light: {
    canModifyFiles: true,
    runsTests: true,
    reviewCycles: 1,
    collectsLearnings: false,
    tokenCostMultiplier: 3,
  },
  dialectic_full: {
    canModifyFiles: true,
    runsTests: true,
    reviewCycles: 3,
    collectsLearnings: true,
    tokenCostMultiplier: 5,
  },
};

/**
 * Mode selection configuration.
 */
export interface ModeSelectionConfig {
  /** Default mode when auto-detection is inconclusive */
  defaultMode: InternalMode;
  /** Paths that always trigger safe mode */
  criticalPaths: string[];
  /** Glob patterns for files that should use quick mode */
  simpleFilePatterns: string[];
  /** Keywords that suggest read-only queries */
  readOnlyKeywords: string[];
  /** Keywords that suggest code modifications */
  modificationKeywords: string[];
  /** Keywords that suggest high-risk changes */
  highRiskKeywords: string[];
  /** Minimum confidence threshold for auto-selection */
  confidenceThreshold: number;
  /** Whether to allow runtime mode escalation */
  allowEscalation: boolean;
  /** Maximum mode that escalation can reach */
  maxEscalationMode: InternalMode;
}

/**
 * Default mode selection configuration.
 */
export const DEFAULT_MODE_SELECTION_CONFIG: ModeSelectionConfig = {
  defaultMode: 'dialectic_light',
  criticalPaths: [
    'src/auth/',
    'src/security/',
    'migrations/',
    'src/database/',
    '.env',
    'package.json',
    'tsconfig.json',
  ],
  simpleFilePatterns: [
    '*.md',
    '*.txt',
    '*.json',
    'README*',
    'LICENSE*',
    'CHANGELOG*',
  ],
  readOnlyKeywords: [
    'explain',
    'describe',
    'what is',
    'how does',
    'show me',
    'find',
    'search',
    'list',
    'where is',
    'tell me',
  ],
  modificationKeywords: [
    'fix',
    'add',
    'create',
    'update',
    'change',
    'modify',
    'remove',
    'delete',
    'implement',
    'refactor',
    'rename',
  ],
  highRiskKeywords: [
    'auth',
    'authentication',
    'security',
    'password',
    'token',
    'migration',
    'database',
    'deploy',
    'production',
    'api key',
    'secret',
    'credential',
  ],
  confidenceThreshold: 0.7,
  allowEscalation: true,
  maxEscalationMode: 'dialectic_full',
};

/**
 * Mode selection result.
 */
export interface ModeSelectionResult {
  /** Selected mode */
  mode: InternalMode;
  /** User-facing mode name */
  displayName: UserMode;
  /** Confidence in selection (0-1) */
  confidence: number;
  /** Reasons for selection */
  reasons: string[];
  /** Whether this was auto-selected or manual */
  isAutoSelected: boolean;
  /** Suggested escalation if any */
  suggestedEscalation?: InternalMode;
}

/**
 * Mode escalation event.
 */
export interface ModeEscalationEvent {
  /** Previous mode */
  fromMode: InternalMode;
  /** New mode */
  toMode: InternalMode;
  /** Reason for escalation */
  reason: string;
  /** Round number when escalation occurred */
  atRound: number;
  /** Trigger that caused escalation */
  trigger:
    | 'critical_issue'
    | 'test_failure'
    | 'low_confidence'
    | 'user_request'
    | 'multiple_rounds';
}

/**
 * Convert user mode to internal mode.
 */
export function toInternalMode(userMode: UserMode): InternalMode {
  return MODE_INTERNAL_NAMES[userMode];
}

/**
 * Convert internal mode to user mode.
 */
export function toUserMode(internalMode: InternalMode): UserMode {
  return MODE_DISPLAY_NAMES[internalMode];
}

/**
 * Get mode characteristics.
 */
export function getModeCharacteristics(
  mode: InternalMode,
): ModeCharacteristics {
  return MODE_CHARACTERISTICS[mode];
}

/**
 * Compare modes by "safety" level.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareModes(a: InternalMode, b: InternalMode): number {
  const order: InternalMode[] = [
    'read_only',
    'simple',
    'dialectic_light',
    'dialectic_full',
  ];
  return order.indexOf(a) - order.indexOf(b);
}

/**
 * Check if mode a is stricter than mode b.
 */
export function isStricterMode(a: InternalMode, b: InternalMode): boolean {
  return compareModes(a, b) > 0;
}

/**
 * Get the stricter of two modes.
 */
export function getStricterMode(
  a: InternalMode,
  b: InternalMode,
): InternalMode {
  return compareModes(a, b) >= 0 ? a : b;
}
