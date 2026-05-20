/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readPackageUp, type PackageJson } from 'read-package-up';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type { PackageJson };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let packageJson: PackageJson | undefined;

/**
 * Retrieves the package.json for this CLI package.
 *
 * @returns The parsed package.json, or undefined if not found.
 * @remarks Returns undefined rather than throwing to allow graceful degradation
 * in scenarios where package.json might not be available (e.g., bundled builds).
 * Callers should handle the undefined case appropriately for their use case.
 */
export async function getPackageJson(): Promise<PackageJson | undefined> {
  if (packageJson) {
    return packageJson;
  }

  const result = await readPackageUp({ cwd: __dirname });
  if (!result) {
    // Package.json not found - this can happen in bundled/standalone builds.
    // Return undefined to allow callers to handle this gracefully.
    return;
  }

  packageJson = result.packageJson;
  return packageJson;
}
