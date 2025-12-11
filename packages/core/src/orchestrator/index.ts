/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Mode Configuration
export {
  MODE_DISPLAY_NAMES,
  MODE_INTERNAL_NAMES,
  MODE_DESCRIPTIONS,
  MODE_CHARACTERISTICS,
  DEFAULT_MODE_SELECTION_CONFIG,
  toInternalMode,
  toUserMode,
  getModeCharacteristics,
  compareModes,
  isStricterMode,
  getStricterMode,
  type InternalMode,
  type UserMode,
  type ModeCharacteristics,
  type ModeSelectionConfig,
  type ModeSelectionResult,
  type ModeEscalationEvent,
} from './mode-config.js';

// Task Analyzer
export {
  TaskAnalyzer,
  type TaskIntent,
  type RiskLevel,
  type ComplexityLevel,
  type FileScope,
  type TaskAnalysis,
} from './task-analyzer.js';

// Mode Selector
export {
  ModeSelector,
  selectMode,
  requiresDialectic,
  canModifyFiles,
  getModeForRisk,
  getModeForComplexity,
  type ModeSelectionOptions,
} from './mode-selector.js';

// Mode Escalation
export {
  ModeEscalationManager,
  DEFAULT_ESCALATION_CONFIG,
  createEscalationManager,
  canEscalate,
  getNextEscalationLevel,
  type EscalationTrigger,
  type EscalationCheckResult,
  type EscalationConfig,
} from './mode-escalation.js';

// Round Manager
export {
  RoundManager,
  type RoundOptions,
  type VerifyFunction,
  type ApplyPatchFunction,
  type RoundEvent,
  type RoundEventHandler,
  type RoundTokenUsage,
} from './round-manager.js';

// Dialectic Controller
export {
  DialecticController,
  DEFAULT_CONTROLLER_CONFIG,
  type ExecutionMode,
  type ControllerConfig,
  type ControllerEvent,
  type ControllerEventHandler,
  type FileProvider,
  type FileDiscoveryFunction,
  type TrackingDependencies,
} from './dialectic-controller.js';

// Execution Coordinator
export {
  ExecutionCoordinator,
  DEFAULT_COORDINATOR_CONFIG,
  createExecutionCoordinator,
  type ExecutionCoordinatorConfig,
  type ExecutionCoordinatorResult,
  type AgentLLMClients,
  type DialecticDependencies,
} from './execution-coordinator.js';

// Performance Metrics
export {
  PerformanceTracker,
  createPerformanceTracker,
  formatDuration,
  formatTokens,
  type TimingData,
  type TokenUsageData,
  type AgentMetrics,
  type RoundMetrics,
  type SessionMetrics as OrchestratorSessionMetrics,
} from './performance-metrics.js';

// Token Profiler
export {
  TokenProfiler,
  DEFAULT_TOKEN_BUDGET,
  MODE_TOKEN_ESTIMATES,
  createTokenProfiler,
  getModeTokenMultiplier,
  type TokenBudgetConfig,
  type TokenProfile,
  type BudgetStatus,
  type TokenReport,
} from './token-profiler.js';

// Dialectic Integration
export {
  DialecticIntegration,
  createDialecticIntegration,
  type DialecticEventType,
  type DialecticEvent,
  type DialecticEventHandler,
  type DialecticExecutionResult,
} from './dialectic-integration.js';
