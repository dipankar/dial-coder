#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bundle Size Monitoring Script
 *
 * Analyzes the built bundle and reports on size metrics.
 * Can be used in CI to track bundle size changes over time.
 *
 * Usage:
 *   node scripts/bundle-size.js [options]
 *
 * Options:
 *   --json           Output as JSON
 *   --limit <bytes>  Fail if bundle exceeds limit
 *   --save           Save current sizes as baseline
 *   --compare        Compare with saved baseline
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const BUNDLE_PATH = resolve(rootDir, 'dist/cli.js');
const METAFILE_PATH = resolve(rootDir, 'dist/esbuild.json');
const BASELINE_PATH = resolve(rootDir, '.bundle-size-baseline.json');

// Size limits (in bytes)
const SIZE_LIMITS = {
  raw: 15 * 1024 * 1024, // 15 MB
  gzip: 4 * 1024 * 1024, // 4 MB
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatChange(current, previous) {
  if (!previous) return 'N/A';
  const diff = current - previous;
  const percent = ((diff / previous) * 100).toFixed(2);
  const sign = diff > 0 ? '+' : '';
  return `${sign}${formatBytes(diff)} (${sign}${percent}%)`;
}

function getBundleStats() {
  if (!existsSync(BUNDLE_PATH)) {
    console.error('Bundle not found. Run `npm run bundle` first.');
    process.exit(1);
  }

  const bundleContent = readFileSync(BUNDLE_PATH);
  const rawSize = bundleContent.length;
  const gzipSize = gzipSync(bundleContent).length;

  // Get file modification time
  const stats = statSync(BUNDLE_PATH);
  const builtAt = stats.mtime.toISOString();

  // Try to get detailed breakdown from metafile
  let breakdown = null;
  if (existsSync(METAFILE_PATH)) {
    try {
      const metafile = JSON.parse(readFileSync(METAFILE_PATH, 'utf-8'));
      breakdown = analyzeMetafile(metafile);
    } catch {
      // Metafile parsing failed, continue without breakdown
    }
  }

  return {
    rawSize,
    gzipSize,
    builtAt,
    breakdown,
  };
}

function analyzeMetafile(metafile) {
  const inputs = metafile.inputs || {};
  const breakdown = {
    byPackage: {},
    byType: {
      source: 0,
      nodeModules: 0,
      other: 0,
    },
    topFiles: [],
  };

  // Analyze each input file
  for (const [filePath, info] of Object.entries(inputs)) {
    const size = info.bytes || 0;

    // Categorize by type
    if (filePath.includes('node_modules')) {
      breakdown.byType.nodeModules += size;

      // Extract package name
      const match = filePath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
      if (match) {
        const pkgName = match[1];
        breakdown.byPackage[pkgName] =
          (breakdown.byPackage[pkgName] || 0) + size;
      }
    } else if (filePath.startsWith('packages/')) {
      breakdown.byType.source += size;
    } else {
      breakdown.byType.other += size;
    }

    // Track for top files
    breakdown.topFiles.push({ path: filePath, size });
  }

  // Sort and limit top files
  breakdown.topFiles.sort((a, b) => b.size - a.size);
  breakdown.topFiles = breakdown.topFiles.slice(0, 20);

  // Sort packages by size
  breakdown.byPackage = Object.fromEntries(
    Object.entries(breakdown.byPackage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15),
  );

  return breakdown;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveBaseline(stats) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        rawSize: stats.rawSize,
        gzipSize: stats.gzipSize,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Baseline saved to ${BASELINE_PATH}`);
}

function printReport(stats, baseline, asJson) {
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ...stats,
          baseline,
          limits: SIZE_LIMITS,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('\n📦 Bundle Size Report\n');
  console.log('━'.repeat(60));

  // Main sizes
  console.log(`\n  Raw Size:  ${formatBytes(stats.rawSize)}`);
  console.log(`  Gzip Size: ${formatBytes(stats.gzipSize)}`);
  console.log(`  Built At:  ${stats.builtAt}`);

  // Comparison with baseline
  if (baseline) {
    console.log('\n📊 Comparison with Baseline:\n');
    console.log(
      `  Raw:  ${formatBytes(stats.rawSize)} (was ${formatBytes(baseline.rawSize)})`,
    );
    console.log(
      `        Change: ${formatChange(stats.rawSize, baseline.rawSize)}`,
    );
    console.log(
      `  Gzip: ${formatBytes(stats.gzipSize)} (was ${formatBytes(baseline.gzipSize)})`,
    );
    console.log(
      `        Change: ${formatChange(stats.gzipSize, baseline.gzipSize)}`,
    );
  }

  // Size limits
  console.log('\n📏 Size Limits:\n');
  const rawOk = stats.rawSize <= SIZE_LIMITS.raw;
  const gzipOk = stats.gzipSize <= SIZE_LIMITS.gzip;
  console.log(
    `  Raw:  ${rawOk ? '✅' : '❌'} ${formatBytes(stats.rawSize)} / ${formatBytes(SIZE_LIMITS.raw)}`,
  );
  console.log(
    `  Gzip: ${gzipOk ? '✅' : '❌'} ${formatBytes(stats.gzipSize)} / ${formatBytes(SIZE_LIMITS.gzip)}`,
  );

  // Breakdown
  if (stats.breakdown) {
    console.log('\n📁 Size Breakdown:\n');
    console.log('  By Type:');
    console.log(
      `    Source Code:   ${formatBytes(stats.breakdown.byType.source)}`,
    );
    console.log(
      `    Dependencies:  ${formatBytes(stats.breakdown.byType.nodeModules)}`,
    );
    console.log(
      `    Other:         ${formatBytes(stats.breakdown.byType.other)}`,
    );

    console.log('\n  Top Dependencies:');
    const packages = Object.entries(stats.breakdown.byPackage).slice(0, 10);
    for (const [pkg, size] of packages) {
      console.log(`    ${pkg.padEnd(35)} ${formatBytes(size)}`);
    }

    console.log('\n  Top Files:');
    for (const file of stats.breakdown.topFiles.slice(0, 10)) {
      const shortPath =
        file.path.length > 50
          ? '...' + file.path.slice(-47)
          : file.path.padEnd(50);
      console.log(`    ${shortPath} ${formatBytes(file.size)}`);
    }
  }

  console.log('\n' + '━'.repeat(60) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const shouldSave = args.includes('--save');
  const shouldCompare = args.includes('--compare');
  const limitIndex = args.indexOf('--limit');
  const customLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

  // Get current bundle stats
  const stats = getBundleStats();

  // Load baseline if comparing
  const baseline = shouldCompare ? loadBaseline() : null;

  // Print report
  printReport(stats, baseline, asJson);

  // Save baseline if requested
  if (shouldSave) {
    saveBaseline(stats);
  }

  // Check limits
  let exitCode = 0;
  const limitToCheck = customLimit || SIZE_LIMITS.raw;

  if (stats.rawSize > limitToCheck) {
    console.error(
      `❌ Bundle size (${formatBytes(stats.rawSize)}) exceeds limit (${formatBytes(limitToCheck)})`,
    );
    exitCode = 1;
  }

  if (stats.gzipSize > SIZE_LIMITS.gzip) {
    console.error(
      `❌ Gzip size (${formatBytes(stats.gzipSize)}) exceeds limit (${formatBytes(SIZE_LIMITS.gzip)})`,
    );
    exitCode = 1;
  }

  // Check for significant increase from baseline
  if (baseline) {
    const increasePercent =
      ((stats.rawSize - baseline.rawSize) / baseline.rawSize) * 100;
    if (increasePercent > 10) {
      console.warn(
        `⚠️  Bundle size increased by ${increasePercent.toFixed(1)}% from baseline`,
      );
    }
  }

  process.exit(exitCode);
}

main();
