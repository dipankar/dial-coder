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

try {
  // Get repository root
  const root = execSync('git rev-parse --show-toplevel').toString().trim();

  // Run secrets scanning first
  console.log('🔍 Scanning for secrets...');
  const secretsScanPassed = await runSecretsScanning(root);

  if (!secretsScanPassed) {
    process.exit(1);
  }

  // Run lint-staged with API directly
  console.log('📝 Running lint-staged...');
  const lintPassed = await lintStaged({ cwd: root });

  // Exit with appropriate code
  process.exit(lintPassed ? 0 : 1);
} catch {
  // Exit with error code
  process.exit(1);
}
