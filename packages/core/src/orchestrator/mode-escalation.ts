/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InternalMode, ModeEscalationEvent } from './mode-config.js';
import { compareModes, getStricterMode, toUserMode } from './mode-config.js';
import type {
  RoundResult,
  VerificationResult,
  AntithesisOutput,
} from '../agents/types.js';

/**
 * Escalation trigger types.
 */
export type EscalationTrigger =
  | 'critical_issue'
  | 'test_failure'
  | 'low_confidence'
  | 'user_request'
  | 'multiple_rounds';

/**
 * Escalation check result.
 */
export interface EscalationCheckResult {
  /** Whether escalation is needed */
  shouldEscalate: boolean;
  /** New mode if escalation is needed */
  newMode?: InternalMode;
  /** Reason for escalation */
  reason?: string;
  /** Trigger that caused escalation */
  trigger?: EscalationTrigger;
}

/**
 * Escalation configuration.
 */
export interface EscalationConfig {
  /** Whether escalation is enabled */
  enabled: boolean;
  /** Maximum mode that can be escalated to */
  maxMode: InternalMode;
  /** Number of test failures before escalating */
  testFailureThreshold: number;
  /** Number of rounds before escalating */
  roundThreshold: number;
  /** Synthesis confidence threshold below which to escalate */
  confidenceThreshold: number;
  /** Proposer confidence threshold below which to escalate (0-1) */
  proposerConfidenceThreshold: number;
  /** Number of critic issues that triggers escalation */
  issueCountThreshold: number;
  /** Issue severity that triggers immediate escalation */
  criticalIssueSeverities: Array<'critical' | 'high'>;
}

/**
 * Default escalation configuration.
 */
export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  enabled: true,
  maxMode: 'dialectic_full',
  testFailureThreshold: 2,
  roundThreshold: 2,
  confidenceThreshold: 0.5,
  proposerConfidenceThreshold: 0.7,
  issueCountThreshold: 3,
  criticalIssueSeverities: ['critical'],
};

/**
 * Handles runtime mode escalation during task execution.
 */
export class ModeEscalationManager {
  private config: EscalationConfig;
  private currentMode: InternalMode;
  private escalationHistory: ModeEscalationEvent[] = [];
  private roundHistory: RoundResult[] = [];

  constructor(
    initialMode: InternalMode,
    config: Partial<EscalationConfig> = {},
  ) {
    this.currentMode = initialMode;
    this.config = { ...DEFAULT_ESCALATION_CONFIG, ...config };
  }

  /**
   * Get current mode.
   */
  getCurrentMode(): InternalMode {
    return this.currentMode;
  }

  /**
   * Get escalation history.
   */
  getEscalationHistory(): ModeEscalationEvent[] {
    return [...this.escalationHistory];
  }

  /**
   * Record a completed round.
   */
  recordRound(result: RoundResult): void {
    this.roundHistory.push(result);
  }

  /**
   * Check if escalation is needed after a round.
   */
  checkEscalation(roundResult: RoundResult): EscalationCheckResult {
    if (!this.config.enabled) {
      return { shouldEscalate: false };
    }

    // Already at max mode
    if (compareModes(this.currentMode, this.config.maxMode) >= 0) {
      return { shouldEscalate: false };
    }

    // Check critical issues
    const criticalCheck = this.checkCriticalIssues(roundResult.antithesis);
    if (criticalCheck.shouldEscalate) {
      return criticalCheck;
    }

    // Check test failures
    const testCheck = this.checkTestFailures(roundResult.verification);
    if (testCheck.shouldEscalate) {
      return testCheck;
    }

    // Check low confidence
    const confidenceCheck = this.checkLowConfidence(roundResult);
    if (confidenceCheck.shouldEscalate) {
      return confidenceCheck;
    }

    // Check proposer confidence
    const proposerConfidenceCheck = this.checkProposerConfidence(roundResult);
    if (proposerConfidenceCheck.shouldEscalate) {
      return proposerConfidenceCheck;
    }

    // Check high issue count
    const issueCountCheck = this.checkIssueCount(roundResult);
    if (issueCountCheck.shouldEscalate) {
      return issueCountCheck;
    }

    // Check multiple rounds
    const roundsCheck = this.checkMultipleRounds();
    if (roundsCheck.shouldEscalate) {
      return roundsCheck;
    }

    return { shouldEscalate: false };
  }

  /**
   * Apply escalation to a new mode.
   */
  escalate(
    newMode: InternalMode,
    reason: string,
    trigger: EscalationTrigger,
  ): ModeEscalationEvent {
    const event: ModeEscalationEvent = {
      fromMode: this.currentMode,
      toMode: newMode,
      reason,
      atRound: this.roundHistory.length,
      trigger,
    };

    this.currentMode = newMode;
    this.escalationHistory.push(event);

    return event;
  }

  /**
   * Force escalation to a specific mode (user request).
   */
  forceEscalate(newMode: InternalMode): ModeEscalationEvent | null {
    if (compareModes(newMode, this.currentMode) <= 0) {
      return null; // Can't downgrade
    }

    return this.escalate(newMode, 'User requested escalation', 'user_request');
  }

  /**
   * Check for critical issues in antithesis.
   */
  private checkCriticalIssues(
    antithesis: AntithesisOutput,
  ): EscalationCheckResult {
    const criticalIssues = antithesis.issues.filter((issue) =>
      this.config.criticalIssueSeverities.includes(
        issue.severity as 'critical' | 'high',
      ),
    );

    if (criticalIssues.length > 0) {
      const newMode = getStricterMode(this.currentMode, 'dialectic_full');
      if (compareModes(newMode, this.currentMode) > 0) {
        return {
          shouldEscalate: true,
          newMode,
          reason: `Critical issues found: ${criticalIssues.map((i) => i.description).join('; ')}`,
          trigger: 'critical_issue',
        };
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Check for test failures.
   */
  private checkTestFailures(
    verification: VerificationResult,
  ): EscalationCheckResult {
    // Count consecutive failed rounds
    let consecutiveFailures = 0;
    for (let i = this.roundHistory.length - 1; i >= 0; i--) {
      if (!this.roundHistory[i].verification.success) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Include current round
    if (!verification.success) {
      consecutiveFailures++;
    }

    if (consecutiveFailures >= this.config.testFailureThreshold) {
      const newMode = getStricterMode(this.currentMode, 'dialectic_light');
      if (compareModes(newMode, this.currentMode) > 0) {
        return {
          shouldEscalate: true,
          newMode: getStricterMode(newMode, 'dialectic_full'),
          reason: `${consecutiveFailures} consecutive test failures`,
          trigger: 'test_failure',
        };
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Check for low confidence synthesis.
   */
  private checkLowConfidence(roundResult: RoundResult): EscalationCheckResult {
    if (roundResult.synthesis.confidence === 'low') {
      // Check if multiple rounds have low confidence
      const lowConfidenceRounds = this.roundHistory.filter(
        (r) => r.synthesis.confidence === 'low',
      ).length;

      if (lowConfidenceRounds >= 1) {
        const newMode = getStricterMode(this.currentMode, 'dialectic_light');
        if (compareModes(newMode, this.currentMode) > 0) {
          return {
            shouldEscalate: true,
            newMode,
            reason: 'Multiple rounds with low confidence',
            trigger: 'low_confidence',
          };
        }
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Check for low proposer confidence.
   */
  private checkProposerConfidence(
    roundResult: RoundResult,
  ): EscalationCheckResult {
    const confidence = roundResult.thesis.confidence;
    if (confidence !== undefined && confidence < this.config.proposerConfidenceThreshold) {
      const lowConfidenceRounds = this.roundHistory.filter(
        (r) => r.thesis.confidence !== undefined && r.thesis.confidence < this.config.proposerConfidenceThreshold,
      ).length;

      if (lowConfidenceRounds >= 1) {
        const newMode = getStricterMode(this.currentMode, 'dialectic_light');
        if (compareModes(newMode, this.currentMode) > 0) {
          return {
            shouldEscalate: true,
            newMode,
            reason: `Proposer confidence ${confidence.toFixed(2)} below threshold ${this.config.proposerConfidenceThreshold}`,
            trigger: 'low_confidence',
          };
        }
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Check for high issue count in antithesis.
   */
  private checkIssueCount(roundResult: RoundResult): EscalationCheckResult {
    const issueCount = roundResult.antithesis.issues.length;
    if (issueCount >= this.config.issueCountThreshold) {
      const newMode = getStricterMode(this.currentMode, 'dialectic_full');
      if (compareModes(newMode, this.currentMode) > 0) {
        return {
          shouldEscalate: true,
          newMode,
          reason: `${issueCount} issues found (threshold: ${this.config.issueCountThreshold})`,
          trigger: 'critical_issue',
        };
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Check if too many rounds have been executed.
   */
  private checkMultipleRounds(): EscalationCheckResult {
    if (this.roundHistory.length >= this.config.roundThreshold) {
      // Only escalate if we're not making progress
      const recentRounds = this.roundHistory.slice(-this.config.roundThreshold);
      const allFailed = recentRounds.every((r) => r.outcome !== 'success');

      if (allFailed) {
        const newMode = getStricterMode(this.currentMode, 'dialectic_full');
        if (compareModes(newMode, this.currentMode) > 0) {
          return {
            shouldEscalate: true,
            newMode,
            reason: `${this.roundHistory.length} rounds without success`,
            trigger: 'multiple_rounds',
          };
        }
      }
    }

    return { shouldEscalate: false };
  }

  /**
   * Reset state for a new task.
   */
  reset(initialMode: InternalMode): void {
    this.currentMode = initialMode;
    this.escalationHistory = [];
    this.roundHistory = [];
  }

  /**
   * Get a summary of escalations.
   */
  getEscalationSummary(): string {
    if (this.escalationHistory.length === 0) {
      return `Mode: ${toUserMode(this.currentMode)} (no escalations)`;
    }

    const escalations = this.escalationHistory
      .map(
        (e) =>
          `${toUserMode(e.fromMode)} → ${toUserMode(e.toMode)} (${e.reason})`,
      )
      .join(', ');

    return `Mode: ${toUserMode(this.currentMode)} (escalated: ${escalations})`;
  }
}

/**
 * Create escalation manager with default configuration.
 */
export function createEscalationManager(
  initialMode: InternalMode,
  config?: Partial<EscalationConfig>,
): ModeEscalationManager {
  return new ModeEscalationManager(initialMode, config);
}

/**
 * Check if a mode can be escalated further.
 */
export function canEscalate(
  currentMode: InternalMode,
  maxMode: InternalMode = 'dialectic_full',
): boolean {
  return compareModes(currentMode, maxMode) < 0;
}

/**
 * Get the next escalation level.
 */
export function getNextEscalationLevel(
  currentMode: InternalMode,
): InternalMode | null {
  switch (currentMode) {
    case 'read_only':
      return 'simple';
    case 'simple':
      return 'dialectic_light';
    case 'dialectic_light':
      return 'dialectic_full';
    case 'dialectic_full':
      return null;
    default:
      return null;
  }
}
