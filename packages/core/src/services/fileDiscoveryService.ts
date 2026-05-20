/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import type { DialIgnoreFilter } from '../utils/dialIgnoreParser.js';
import { GitIgnoreParser } from '../utils/gitIgnoreParser.js';
import { DialIgnoreParser } from '../utils/dialIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'node:path';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectDialIgnore?: boolean;
}

export interface FilterReport {
  filteredPaths: string[];
  gitIgnoredCount: number;
  dialIgnoredCount: number;
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private dialIgnoreFilter: DialIgnoreFilter | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      this.gitIgnoreFilter = new GitIgnoreParser(this.projectRoot);
    }
    this.dialIgnoreFilter = new DialIgnoreParser(this.projectRoot);
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(
    filePaths: string[],
    options: FilterFilesOptions = {
      respectGitIgnore: true,
      respectDialIgnore: true,
    },
  ): string[] {
    return filePaths.filter((filePath) => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      if (options.respectDialIgnore && this.shouldDialIgnoreFile(filePath)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Filters a list of file paths based on git ignore rules and returns a report
   * with counts of ignored files.
   */
  filterFilesWithReport(
    filePaths: string[],
    opts: FilterFilesOptions = {
      respectGitIgnore: true,
      respectDialIgnore: true,
    },
  ): FilterReport {
    const filteredPaths: string[] = [];
    let gitIgnoredCount = 0;
    let dialIgnoredCount = 0;

    for (const filePath of filePaths) {
      if (opts.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        gitIgnoredCount++;
        continue;
      }

      if (opts.respectDialIgnore && this.shouldDialIgnoreFile(filePath)) {
        dialIgnoredCount++;
        continue;
      }

      filteredPaths.push(filePath);
    }

    return {
      filteredPaths,
      gitIgnoredCount,
      dialIgnoredCount,
    };
  }

  /**
   * Checks if a single file should be git-ignored
   */
  shouldGitIgnoreFile(filePath: string): boolean {
    if (this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Checks if a single file should be dial-ignored
   */
  shouldDialIgnoreFile(filePath: string): boolean {
    if (this.dialIgnoreFilter) {
      return this.dialIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Unified method to check if a file should be ignored based on filtering options
   */
  shouldIgnoreFile(
    filePath: string,
    options: FilterFilesOptions = {},
  ): boolean {
    const {
      respectGitIgnore = true,
      respectDialIgnore: respectDialIgnore = true,
    } = options;

    if (respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
      return true;
    }
    if (respectDialIgnore && this.shouldDialIgnoreFile(filePath)) {
      return true;
    }
    return false;
  }

  /**
   * Returns loaded patterns from .dialignore
   */
  getDialIgnorePatterns(): string[] {
    return this.dialIgnoreFilter?.getPatterns() ?? [];
  }
}
