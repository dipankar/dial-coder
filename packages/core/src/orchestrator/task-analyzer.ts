/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModeSelectionConfig } from './mode-config.js';
import { DEFAULT_MODE_SELECTION_CONFIG } from './mode-config.js';

/**
 * Task intent classification.
 */
export type TaskIntent = 'query' | 'modification' | 'ambiguous';

/**
 * Risk level for a task.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Complexity level for a task.
 */
export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex';

/**
 * File scope for a task.
 */
export interface FileScope {
  /** Detected file paths mentioned in the task */
  mentionedFiles: string[];
  /** Detected directories mentioned */
  mentionedDirectories: string[];
  /** Whether task affects critical paths */
  touchesCriticalPaths: boolean;
  /** Specific critical paths that are affected */
  affectedCriticalPaths: string[];
  /** Estimated number of files to modify */
  estimatedFileCount: number;
}

/**
 * Task analysis result.
 */
export interface TaskAnalysis {
  /** Original task prompt */
  prompt: string;
  /** Detected intent */
  intent: TaskIntent;
  /** Intent confidence (0-1) */
  intentConfidence: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Risk factors identified */
  riskFactors: string[];
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Complexity factors */
  complexityFactors: string[];
  /** File scope analysis */
  fileScope: FileScope;
  /** Detected keywords by category */
  detectedKeywords: {
    readOnly: string[];
    modification: string[];
    highRisk: string[];
  };
  /** Whether task explicitly mentions testing */
  mentionsTests: boolean;
  /** Whether task mentions specific technologies/frameworks */
  technologies: string[];
}

/**
 * Analyzes tasks to determine intent, risk, and complexity.
 */
export class TaskAnalyzer {
  private config: ModeSelectionConfig;

  constructor(config: Partial<ModeSelectionConfig> = {}) {
    this.config = { ...DEFAULT_MODE_SELECTION_CONFIG, ...config };
  }

  /**
   * Analyze a task prompt.
   */
  analyze(prompt: string): TaskAnalysis {
    const normalizedPrompt = prompt.toLowerCase();

    // Detect keywords
    const detectedKeywords = this.detectKeywords(normalizedPrompt);

    // Determine intent
    const { intent, intentConfidence } = this.analyzeIntent(detectedKeywords);

    // Analyze file scope
    const fileScope = this.analyzeFileScope(prompt);

    // Assess risk
    const { riskLevel, riskFactors } = this.assessRisk(
      detectedKeywords,
      fileScope,
      normalizedPrompt,
    );

    // Assess complexity
    const { complexity, complexityFactors } = this.assessComplexity(
      prompt,
      fileScope,
      detectedKeywords,
    );

    // Detect technologies
    const technologies = this.detectTechnologies(normalizedPrompt);

    // Check for test mentions
    const mentionsTests = this.checkTestMentions(normalizedPrompt);

    return {
      prompt,
      intent,
      intentConfidence,
      riskLevel,
      riskFactors,
      complexity,
      complexityFactors,
      fileScope,
      detectedKeywords,
      mentionsTests,
      technologies,
    };
  }

  /**
   * Detect keywords in the prompt.
   */
  private detectKeywords(prompt: string): TaskAnalysis['detectedKeywords'] {
    const readOnly: string[] = [];
    const modification: string[] = [];
    const highRisk: string[] = [];

    for (const keyword of this.config.readOnlyKeywords) {
      if (prompt.includes(keyword.toLowerCase())) {
        readOnly.push(keyword);
      }
    }

    for (const keyword of this.config.modificationKeywords) {
      if (prompt.includes(keyword.toLowerCase())) {
        modification.push(keyword);
      }
    }

    for (const keyword of this.config.highRiskKeywords) {
      if (prompt.includes(keyword.toLowerCase())) {
        highRisk.push(keyword);
      }
    }

    return { readOnly, modification, highRisk };
  }

  /**
   * Analyze task intent.
   */
  private analyzeIntent(keywords: TaskAnalysis['detectedKeywords']): {
    intent: TaskIntent;
    intentConfidence: number;
  } {
    const readOnlyScore = keywords.readOnly.length;
    const modificationScore = keywords.modification.length;

    // Clear modification intent
    if (modificationScore > 0 && readOnlyScore === 0) {
      return {
        intent: 'modification',
        intentConfidence: Math.min(0.9, 0.6 + modificationScore * 0.1),
      };
    }

    // Clear query intent
    if (readOnlyScore > 0 && modificationScore === 0) {
      return {
        intent: 'query',
        intentConfidence: Math.min(0.9, 0.6 + readOnlyScore * 0.1),
      };
    }

    // Mixed signals - modification usually wins
    if (modificationScore > readOnlyScore) {
      return {
        intent: 'modification',
        intentConfidence: 0.5 + (modificationScore - readOnlyScore) * 0.1,
      };
    }

    if (readOnlyScore > modificationScore) {
      return {
        intent: 'query',
        intentConfidence: 0.5 + (readOnlyScore - modificationScore) * 0.1,
      };
    }

    // Ambiguous
    return {
      intent: 'ambiguous',
      intentConfidence: 0.3,
    };
  }

  /**
   * Analyze file scope from the prompt.
   */
  private analyzeFileScope(prompt: string): FileScope {
    const mentionedFiles: string[] = [];
    const mentionedDirectories: string[] = [];
    const affectedCriticalPaths: string[] = [];

    // Extract file paths (common patterns)
    const filePatterns = [
      /([a-zA-Z0-9_\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|md|json|yaml|yml|toml|sql))/g,
      /`([^`]+\.[a-z]+)`/g,
      /"([^"]+\.[a-z]+)"/g,
      /'([^']+\.[a-z]+)'/g,
    ];

    for (const pattern of filePatterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        const file = match[1];
        if (file && !mentionedFiles.includes(file)) {
          mentionedFiles.push(file);
        }
      }
    }

    // Extract directory paths
    const dirPatterns = [/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-/]*)/g, /`([^`]+\/)`/g];

    for (const pattern of dirPatterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        const dir = match[1];
        if (dir && !dir.includes('.') && !mentionedDirectories.includes(dir)) {
          mentionedDirectories.push(dir);
        }
      }
    }

    // Check critical paths
    const allPaths = [...mentionedFiles, ...mentionedDirectories];
    const promptLower = prompt.toLowerCase();

    for (const criticalPath of this.config.criticalPaths) {
      const criticalLower = criticalPath.toLowerCase();
      // Check if any mentioned path contains critical path
      const matchesPath = allPaths.some(
        (p) =>
          p.toLowerCase().includes(criticalLower) ||
          criticalLower.includes(p.toLowerCase()),
      );
      // Also check if prompt mentions the critical area
      const mentionedInPrompt = promptLower.includes(
        criticalLower.replace(/[/.]/g, ''),
      );

      if (matchesPath || mentionedInPrompt) {
        affectedCriticalPaths.push(criticalPath);
      }
    }

    // Estimate file count
    let estimatedFileCount = mentionedFiles.length;
    if (estimatedFileCount === 0) {
      // Guess based on scope words
      if (promptLower.includes('all') || promptLower.includes('every')) {
        estimatedFileCount = 10;
      } else if (
        promptLower.includes('module') ||
        promptLower.includes('component')
      ) {
        estimatedFileCount = 5;
      } else if (
        promptLower.includes('function') ||
        promptLower.includes('method')
      ) {
        estimatedFileCount = 1;
      } else {
        estimatedFileCount = 2;
      }
    }

    return {
      mentionedFiles,
      mentionedDirectories,
      touchesCriticalPaths: affectedCriticalPaths.length > 0,
      affectedCriticalPaths,
      estimatedFileCount,
    };
  }

  /**
   * Assess risk level.
   */
  private assessRisk(
    keywords: TaskAnalysis['detectedKeywords'],
    fileScope: FileScope,
    prompt: string,
  ): { riskLevel: RiskLevel; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // High-risk keywords
    if (keywords.highRisk.length > 0) {
      riskScore += keywords.highRisk.length * 2;
      riskFactors.push(`High-risk keywords: ${keywords.highRisk.join(', ')}`);
    }

    // Critical paths
    if (fileScope.touchesCriticalPaths) {
      riskScore += 3;
      riskFactors.push(
        `Affects critical paths: ${fileScope.affectedCriticalPaths.join(', ')}`,
      );
    }

    // Large scope
    if (fileScope.estimatedFileCount > 5) {
      riskScore += 1;
      riskFactors.push(`Large scope: ~${fileScope.estimatedFileCount} files`);
    }

    // Dangerous operations
    const dangerousPatterns = [
      { pattern: /delete|remove|drop/i, factor: 'Deletion operation' },
      { pattern: /migrate|migration/i, factor: 'Database migration' },
      { pattern: /deploy|production/i, factor: 'Production deployment' },
      {
        pattern: /api.?key|secret|credential|password/i,
        factor: 'Sensitive data',
      },
    ];

    for (const { pattern, factor } of dangerousPatterns) {
      if (pattern.test(prompt)) {
        riskScore += 2;
        if (!riskFactors.includes(factor)) {
          riskFactors.push(factor);
        }
      }
    }

    // Determine level
    let riskLevel: RiskLevel;
    if (riskScore >= 6) {
      riskLevel = 'critical';
    } else if (riskScore >= 4) {
      riskLevel = 'high';
    } else if (riskScore >= 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return { riskLevel, riskFactors };
  }

  /**
   * Assess complexity level.
   */
  private assessComplexity(
    prompt: string,
    fileScope: FileScope,
    keywords: TaskAnalysis['detectedKeywords'],
  ): { complexity: ComplexityLevel; complexityFactors: string[] } {
    const complexityFactors: string[] = [];
    let complexityScore = 0;

    // Word count as baseline
    const wordCount = prompt.split(/\s+/).length;
    if (wordCount > 50) {
      complexityScore += 2;
      complexityFactors.push('Detailed requirements');
    } else if (wordCount > 20) {
      complexityScore += 1;
      complexityFactors.push('Moderate requirements');
    }

    // File count
    if (fileScope.estimatedFileCount > 5) {
      complexityScore += 2;
      complexityFactors.push('Multiple files affected');
    } else if (fileScope.estimatedFileCount > 2) {
      complexityScore += 1;
      complexityFactors.push('Few files affected');
    }

    // Modification keywords indicate work
    if (keywords.modification.length > 2) {
      complexityScore += 1;
      complexityFactors.push('Multiple changes requested');
    }

    // Complex task patterns
    const complexPatterns = [
      { pattern: /refactor/i, factor: 'Refactoring' },
      { pattern: /integrate|integration/i, factor: 'Integration work' },
      { pattern: /architect|design/i, factor: 'Architecture changes' },
      { pattern: /performance|optimize/i, factor: 'Performance optimization' },
      {
        pattern: /test coverage|unit test|integration test/i,
        factor: 'Testing requirements',
      },
    ];

    for (const { pattern, factor } of complexPatterns) {
      if (pattern.test(prompt)) {
        complexityScore += 1;
        complexityFactors.push(factor);
      }
    }

    // Simple task patterns (reduce score)
    const simplePatterns = [
      /typo|spelling/i,
      /rename|update name/i,
      /comment|documentation/i,
      /format|formatting/i,
    ];

    for (const pattern of simplePatterns) {
      if (pattern.test(prompt)) {
        complexityScore = Math.max(0, complexityScore - 1);
      }
    }

    // Determine level
    let complexity: ComplexityLevel;
    if (complexityScore >= 5) {
      complexity = 'complex';
    } else if (complexityScore >= 3) {
      complexity = 'moderate';
    } else if (complexityScore >= 1) {
      complexity = 'simple';
    } else {
      complexity = 'trivial';
    }

    return { complexity, complexityFactors };
  }

  /**
   * Detect technologies mentioned in the prompt.
   */
  private detectTechnologies(prompt: string): string[] {
    const technologies: string[] = [];

    const techPatterns: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /typescript|\.ts\b/i, name: 'TypeScript' },
      { pattern: /javascript|\.js\b/i, name: 'JavaScript' },
      { pattern: /react|jsx|tsx/i, name: 'React' },
      { pattern: /vue/i, name: 'Vue' },
      { pattern: /angular/i, name: 'Angular' },
      { pattern: /node\.?js|npm|yarn/i, name: 'Node.js' },
      { pattern: /python|\.py\b/i, name: 'Python' },
      { pattern: /postgres|postgresql/i, name: 'PostgreSQL' },
      { pattern: /mysql/i, name: 'MySQL' },
      { pattern: /mongodb|mongo/i, name: 'MongoDB' },
      { pattern: /redis/i, name: 'Redis' },
      { pattern: /docker/i, name: 'Docker' },
      { pattern: /kubernetes|k8s/i, name: 'Kubernetes' },
      { pattern: /aws|amazon/i, name: 'AWS' },
      { pattern: /gcp|google cloud/i, name: 'GCP' },
      { pattern: /azure/i, name: 'Azure' },
      { pattern: /graphql/i, name: 'GraphQL' },
      { pattern: /rest api|restful/i, name: 'REST' },
      { pattern: /grpc/i, name: 'gRPC' },
    ];

    for (const { pattern, name } of techPatterns) {
      if (pattern.test(prompt)) {
        technologies.push(name);
      }
    }

    return technologies;
  }

  /**
   * Check if prompt mentions testing.
   */
  private checkTestMentions(prompt: string): boolean {
    const testPatterns = [
      /\btest\b/i,
      /\btests\b/i,
      /\btesting\b/i,
      /unit test/i,
      /integration test/i,
      /e2e/i,
      /coverage/i,
      /jest|vitest|mocha|pytest/i,
    ];

    return testPatterns.some((p) => p.test(prompt));
  }

  /**
   * Check if a file matches simple file patterns.
   */
  isSimpleFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || filePath;

    for (const pattern of this.config.simpleFilePatterns) {
      // Convert glob to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
        'i',
      );
      if (regex.test(fileName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a file is in a critical path.
   */
  isCriticalPath(filePath: string): boolean {
    const normalizedPath = filePath.toLowerCase();

    for (const criticalPath of this.config.criticalPaths) {
      if (normalizedPath.includes(criticalPath.toLowerCase())) {
        return true;
      }
    }

    return false;
  }
}
