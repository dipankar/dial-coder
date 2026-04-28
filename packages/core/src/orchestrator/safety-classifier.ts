/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type SafetyVerdict = 'allow' | 'ask' | 'block';

export interface SafetyClassifierInput {
  /** The user's original prompt text */
  userText: string;
  /** Patches the agent wants to apply */
  patches: Array<{
    file: string;
    action: string;
    content?: string;
    search?: string;
    replace?: string;
  }>;
  /** Optional test command */
  testCommand?: string;
}

/**
 * Lightweight safety classifier for dialectic patch and command review.
 *
 * Runs before patch application to catch dangerous patterns.
 * Returns:
 *   - `allow`   — safe to proceed automatically
 *   - `ask`     — requires user confirmation
 *   - `block`   — hard block on dangerous operations
 */
export class SafetyClassifier {
  private static readonly DANGEROUS_PATTERNS: RegExp[] = [
    /rm\s+-rf/i,
    /curl\s+.*\|\s*bash/i,
    /curl\s+.*\|\s*sh/i,
    /sudo\s+/i,
    /drop\s+table/i,
    /delete\s+from\s+\w+/i,
    /truncate\s+table/i,
    />\s*\/dev\/null\s*;\s*rm\s+/i,
    /chmod\s+-R\s+777/i,
    /mkfs\./i,
    /dd\s+if=.*of=\/dev\//i,
    /wget\s+.*\|\s*bash/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
  ];

  private static readonly SENSITIVE_FILE_PATTERNS: RegExp[] = [
    /\.env/i,
    /config\/secrets/i,
    /id_rsa/i,
    /\.aws\//i,
    /credentials/i,
    /\.ssh\//i,
    /passwd/i,
    /shadow/i,
  ];

  classify(input: SafetyClassifierInput): SafetyVerdict {
    const textToCheck = [
      input.userText,
      input.testCommand || '',
      ...input.patches.map((p) =>
        [p.file, p.content || '', p.search || '', p.replace || ''].join(' '),
      ),
    ].join('\n');

    for (const pattern of SafetyClassifier.DANGEROUS_PATTERNS) {
      if (pattern.test(textToCheck)) {
        return 'block';
      }
    }

    for (const patch of input.patches) {
      for (const pattern of SafetyClassifier.SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(patch.file)) {
          return 'ask';
        }
      }
    }

    return 'allow';
  }
}
