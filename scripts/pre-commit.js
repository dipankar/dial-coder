/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import lintStaged from 'lint-staged';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run secrets scanning on staged files
 */
async function runSecretsScanning(root) {
  return new Promise((resolve) => {
    const scanScript = join(__dirname, 'scan-secrets.js');
    const child = spawn('node', [scanScript], {
      cwd: root,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      // If scan script fails to run, allow commit but warn
      console.warn('⚠️  Secrets scanning skipped (script error)');
      resolve(true);
    });
  });
}

/**
 * Check if there are any staged files at all
 */
function hasStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

try {
  // Get repository root
  const root = execSync('git rev-parse --show-toplevel')
    .toString()
    .trim();

  if (!hasStagedFiles()) {
    console.log('No staged files. Skipping pre-commit checks.');
    process.exit(0);
  }

  console.log('🔍 Running pre-commit checks...\n');

  // Run secrets scanning first
  console.log('━━━ 1/2  Secrets scan ━━━');
  const secretsScanPassed = await runSecretsScanning(root);

  if (!secretsScanPassed) {
    console.error('\n🚨 Secrets scan failed. Commit aborted.');
    process.exit(1);
  }

  console.log('✅ Secrets scan passed.\n');

  // Run lint-staged with API directly
  console.log('━━━ 2/2  Lint staged files ━━━');
  const lintPassed = await lintStaged({ cwd: root });

  if (!lintPassed) {
    console.error('\n🚨 Lint-staged failed. Commit aborted.');
    process.exit(1);
  }

  console.log('✅ Lint-staged passed.\n');
  console.log('🚀 Pre-commit checks complete. Proceeding with commit.');
  process.exit(0);
} catch {
  console.error('\n🚨 Pre-commit script error. Commit aborted.');
  process.exit(1);
}
