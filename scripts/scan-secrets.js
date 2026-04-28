/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Secrets scanning script for pre-commit hooks.
 * Scans staged files for potential secrets and sensitive data.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

// Secret patterns to detect
const SECRET_PATTERNS = [
  // API Keys
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  },
  {
    name: 'AWS Access Key ID',
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: 'AWS Secret Access Key',
    pattern:
      /(?:aws)?_?secret_?(?:access)?_?key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,
  },
  // OAuth/Auth Tokens
  {
    name: 'Generic Secret',
    pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  },
  {
    name: 'Bearer Token',
    pattern: /bearer\s+[a-zA-Z0-9_.-]+/gi,
  },
  // Provider-specific
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9\-_]{20,}/g,
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
  },
  {
    name: 'Google OAuth Client Secret',
    pattern: /GOCSPX-[a-zA-Z0-9_-]{28}/g,
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  // Database
  {
    name: 'Database Connection String',
    pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
  },
  // Generic high-entropy strings in sensitive contexts
  {
    name: 'Generic Token',
    pattern: /(?:token|auth|credential)\s*[:=]\s*['"][a-zA-Z0-9_.-]{20,}['"]/gi,
  },
];

// Files to always skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.js$/,
  /\.map$/,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.snap$/,
];

// Extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.yaml',
  '.yml',
  '.env',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.xml',
  '.properties',
  '.conf',
  '.cfg',
  '.ini',
  '.toml',
  '.md',
  '.txt',
  '',
]);

// Allowlist patterns (false positives)
const ALLOWLIST = [
  // Test/example patterns
  /your[_-]?api[_-]?key/i,
  /example[_-]?key/i,
  /test[_-]?secret/i,
  /placeholder/i,
  /xxxxx/i,
  /\$\{[^}]+\}/, // Environment variable substitution
  /<[^>]+>/, // Placeholder syntax
  // Documentation patterns
  /sk-[x]{20,}/i,
  /AKIA[X]{16}/i,
  // No hardcoded secrets should be allowlisted. All credentials must be configured via environment variables.
  // Regex pattern definitions (not actual tokens)
  /^bearer\s+/i, // Regex pattern definition in this file
  /^Bearer Token$/, // Pattern name in this file
  // CLI example patterns (not real tokens)
  /Bearer abc123/i, // Example token in CLI help text
  // Settings key patterns (not actual tokens)
  /Auth: 'security\.auth/i, // Settings key reference
];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

function shouldScanFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return SCAN_EXTENSIONS.has(ext);
}

function isAllowlisted(match) {
  return ALLOWLIST.some((pattern) => pattern.test(match));
}

function getStagedFiles() {
  try {
    const output = execSync(
      'git diff --cached --name-only --diff-filter=ACMR',
      {
        encoding: 'utf-8',
      },
    );
    return output.split('\n').filter((file) => file.trim().length > 0);
  } catch {
    return [];
  }
}

function scanFile(filePath) {
  const findings = [];

  if (!existsSync(filePath)) {
    return findings;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const { name, pattern } of SECRET_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(line)) !== null) {
          if (!isAllowlisted(match[0])) {
            findings.push({
              file: filePath,
              line: lineNum + 1,
              type: name,
              match:
                match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
            });
          }
        }
      }
    }
  } catch {
    // Skip files that can't be read
  }

  return findings;
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('No staged files to scan.');
    process.exit(0);
  }

  const allFindings = [];

  for (const file of stagedFiles) {
    if (shouldSkipFile(file) || !shouldScanFile(file)) {
      continue;
    }

    const filePath = resolve(process.cwd(), file);
    const findings = scanFile(filePath);
    allFindings.push(...findings);
  }

  if (allFindings.length > 0) {
    console.error('\n🚨 Potential secrets detected in staged files:\n');

    for (const finding of allFindings) {
      console.error(`  ❌ ${finding.file}:${finding.line}`);
      console.error(`     Type: ${finding.type}`);
      console.error(`     Match: ${finding.match}\n`);
    }

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('If these are false positives, you can:');
    console.error(
      '  1. Add patterns to the allowlist in scripts/scan-secrets.js',
    );
    console.error('  2. Use git commit --no-verify (not recommended)');
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    );

    process.exit(1);
  }

  console.log('✅ No secrets detected in staged files.');
  process.exit(0);
}

main();
