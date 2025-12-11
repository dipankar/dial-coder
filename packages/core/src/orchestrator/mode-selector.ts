/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InternalMode,
  UserMode,
  ModeSelectionConfig,
  ModeSelectionResult,
} from './mode-config.js';
import {
  DEFAULT_MODE_SELECTION_CONFIG,
  toUserMode,
  toInternalMode,
  getStricterMode,
} from './mode-config.js';
import { TaskAnalyzer } from './task-analyzer.js';
import type {
  TaskAnalysis,
  RiskLevel,
  ComplexityLevel,
} from './task-analyzer.js';

/**
 * Mode selection options.
 */
export interface ModeSelectionOptions {
  /** User-specified mode override */
  userMode?: UserMode;
  /** Files that will be affected */
  affectedFiles?: string[];
  /** Previous analysis if available */
  analysis?: TaskAnalysis;
  /** Session history for context */
  sessionHistory?: Array<{
    mode: InternalMode;
    outcome: 'success' | 'partial' | 'failed';
  }>;
}

/**
 * Selects the appropriate execution mode based on task analysis.
 */
export class ModeSelector {
  private config: ModeSelectionConfig;
  private analyzer: TaskAnalyzer;

  constructor(config: Partial<ModeSelectionConfig> = {}) {
    this.config = { ...DEFAULT_MODE_SELECTION_CONFIG, ...config };
    this.analyzer = new TaskAnalyzer(this.config);
  }

  /**
   * Select the best mode for a task.
   */
  select(
    prompt: string,
    options: ModeSelectionOptions = {},
  ): ModeSelectionResult {
    // If user specified a mode, use it
    if (options.userMode) {
      const internalMode = toInternalMode(options.userMode);
      return {
        mode: internalMode,
        displayName: options.userMode,
        confidence: 1.0,
        reasons: ['User specified mode'],
        isAutoSelected: false,
      };
    }

    // Analyze the task
    const analysis = options.analysis || this.analyzer.analyze(prompt);

    // Apply selection rules
    const result = this.applySelectionRules(analysis, options);

    // Check for escalation suggestion
    const suggestedEscalation = this.checkEscalationSuggestion(
      result,
      analysis,
      options,
    );
    if (suggestedEscalation) {
      result.suggestedEscalation = suggestedEscalation;
    }

    return result;
  }

  /**
   * Apply mode selection rules.
   */
  private applySelectionRules(
    analysis: TaskAnalysis,
    options: ModeSelectionOptions,
  ): ModeSelectionResult {
    const reasons: string[] = [];
    let mode: InternalMode;
    let confidence: number;

    // Rule 1: Query intent → read_only
    if (
      analysis.intent === 'query' &&
      analysis.intentConfidence >= this.config.confidenceThreshold
    ) {
      mode = 'read_only';
      confidence = analysis.intentConfidence;
      reasons.push('Task appears to be a query/explanation request');
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 2: Critical paths → always dialectic_full
    if (analysis.fileScope.touchesCriticalPaths) {
      mode = 'dialectic_full';
      confidence = 0.95;
      reasons.push(
        `Critical paths affected: ${analysis.fileScope.affectedCriticalPaths.join(', ')}`,
      );
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 3: Critical/High risk → dialectic_full
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      mode = 'dialectic_full';
      confidence = 0.9;
      reasons.push(`High risk detected: ${analysis.riskFactors.join('; ')}`);
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 4: Simple files only → simple mode
    if (this.isSimpleFilesOnly(analysis, options)) {
      mode = 'simple';
      confidence = 0.85;
      reasons.push('Only simple/documentation files affected');
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 5: Trivial complexity → simple mode
    if (analysis.complexity === 'trivial' && analysis.riskLevel === 'low') {
      mode = 'simple';
      confidence = 0.8;
      reasons.push('Trivial task with low risk');
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 6: Simple complexity with low risk → simple mode
    if (analysis.complexity === 'simple' && analysis.riskLevel === 'low') {
      mode = 'simple';
      confidence = 0.75;
      reasons.push('Simple task with low risk');
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 7: Complex tasks → dialectic_full
    if (analysis.complexity === 'complex') {
      mode = 'dialectic_full';
      confidence = 0.85;
      reasons.push(`Complex task: ${analysis.complexityFactors.join('; ')}`);
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 8: Moderate complexity or medium risk → dialectic_light
    if (analysis.complexity === 'moderate' || analysis.riskLevel === 'medium') {
      mode = 'dialectic_light';
      confidence = 0.75;
      reasons.push('Moderate complexity or risk');
      return this.buildResult(mode, confidence, reasons);
    }

    // Rule 9: Check session history for failures
    if (options.sessionHistory) {
      const recentFailures = options.sessionHistory.filter(
        (h) => h.outcome === 'failed',
      ).length;
      if (recentFailures > 0) {
        mode = getStricterMode('dialectic_light', this.config.defaultMode);
        confidence = 0.7;
        reasons.push(`Recent failures in session (${recentFailures})`);
        return this.buildResult(mode, confidence, reasons);
      }
    }

    // Default mode
    mode = this.config.defaultMode;
    confidence = 0.6;
    reasons.push('Default mode selection');
    return this.buildResult(mode, confidence, reasons);
  }

  /**
   * Check if only simple files are affected.
   */
  private isSimpleFilesOnly(
    analysis: TaskAnalysis,
    options: ModeSelectionOptions,
  ): boolean {
    const files = [
      ...analysis.fileScope.mentionedFiles,
      ...(options.affectedFiles || []),
    ];

    if (files.length === 0) {
      return false;
    }

    return files.every((f) => this.analyzer.isSimpleFile(f));
  }

  /**
   * Check if mode should be escalated.
   */
  private checkEscalationSuggestion(
    result: ModeSelectionResult,
    analysis: TaskAnalysis,
    _options: ModeSelectionOptions,
  ): InternalMode | undefined {
    if (!this.config.allowEscalation) {
      return undefined;
    }

    // Already at max mode
    if (result.mode === 'dialectic_full') {
      return undefined;
    }

    // Suggest escalation for medium+ risk with simple/dialectic_light mode
    if (
      (result.mode === 'simple' || result.mode === 'dialectic_light') &&
      analysis.riskLevel === 'medium' &&
      analysis.riskFactors.length > 1
    ) {
      return 'dialectic_full';
    }

    // Suggest escalation if confidence is low
    if (result.confidence < 0.6 && result.mode !== 'read_only') {
      return getStricterMode(result.mode, 'dialectic_light');
    }

    return undefined;
  }

  /**
   * Build a mode selection result.
   */
  private buildResult(
    mode: InternalMode,
    confidence: number,
    reasons: string[],
  ): ModeSelectionResult {
    return {
      mode,
      displayName: toUserMode(mode),
      confidence,
      reasons,
      isAutoSelected: true,
    };
  }

  /**
   * Get the analyzer for direct use.
   */
  getAnalyzer(): TaskAnalyzer {
    return this.analyzer;
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ModeSelectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.analyzer = new TaskAnalyzer(this.config);
  }

  /**
   * Get current configuration.
   */
  getConfig(): ModeSelectionConfig {
    return { ...this.config };
  }
}

/**
 * Quick mode selection for common cases.
 */
export function selectMode(
  prompt: string,
  userMode?: UserMode,
): ModeSelectionResult {
  const selector = new ModeSelector();
  return selector.select(prompt, { userMode });
}

/**
 * Check if a mode requires the full dialectic process.
 */
export function requiresDialectic(mode: InternalMode): boolean {
  return mode === 'dialectic_light' || mode === 'dialectic_full';
}

/**
 * Check if a mode can modify files.
 */
export function canModifyFiles(mode: InternalMode): boolean {
  return mode !== 'read_only';
}

/**
 * Get mode for a specific risk level.
 */
export function getModeForRisk(risk: RiskLevel): InternalMode {
  switch (risk) {
    case 'critical':
    case 'high':
      return 'dialectic_full';
    case 'medium':
      return 'dialectic_light';
    case 'low':
      return 'simple';
    default:
      return 'simple';
  }
}

/**
 * Get mode for a specific complexity level.
 */
export function getModeForComplexity(
  complexity: ComplexityLevel,
): InternalMode {
  switch (complexity) {
    case 'complex':
      return 'dialectic_full';
    case 'moderate':
      return 'dialectic_light';
    case 'simple':
    case 'trivial':
      return 'simple';
    default:
      return 'simple';
  }
}
