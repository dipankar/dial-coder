/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import {
  loadExtensions,
  annotateActiveExtensions,
  ExtensionStorage,
  requestConsentNonInteractive,
} from '../../config/extension.js';
import {
  updateAllUpdatableExtensions,
  type ExtensionUpdateInfo,
  checkForAllExtensionUpdates,
  updateExtension,
} from '../../config/extensions/update.js';
import { checkForExtensionUpdate } from '../../config/extensions/github.js';
import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionUpdateState } from '../../ui/state/extensions.js';
import { ExtensionEnablementManager } from '../../config/extensions/extensionEnablement.js';

/**
 * Calculate Levenshtein distance between two strings for fuzzy matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar extension names using fuzzy matching.
 */
function findSimilarExtensions(
  query: string,
  extensionNames: string[],
  maxSuggestions: number = 3,
): string[] {
  const queryLower = query.toLowerCase();

  const scored = extensionNames
    .map((name) => ({
      name,
      distance: levenshteinDistance(queryLower, name.toLowerCase()),
      // Bonus for substring match
      substringBonus: name.toLowerCase().includes(queryLower) ? -2 : 0,
    }))
    .map((item) => ({
      name: item.name,
      score: item.distance + item.substringBonus,
    }))
    .filter((item) => item.score <= Math.max(3, query.length / 2)) // Reasonable threshold
    .sort((a, b) => a.score - b.score);

  return scored.slice(0, maxSuggestions).map((item) => item.name);
}

interface UpdateArgs {
  name?: string;
  all?: boolean;
}

const updateOutput = (info: ExtensionUpdateInfo) =>
  `Extension "${info.name}" successfully updated: ${info.originalVersion} → ${info.updatedVersion}.`;

export async function handleUpdate(args: UpdateArgs) {
  const workingDir = process.cwd();
  const extensionEnablementManager = new ExtensionEnablementManager(
    ExtensionStorage.getUserExtensionsDir(),
    // Force enable named extensions, otherwise we will only update the enabled
    // ones.
    args.name ? [args.name] : [],
  );
  const allExtensions = loadExtensions(extensionEnablementManager);
  const extensions = annotateActiveExtensions(
    allExtensions,
    workingDir,
    extensionEnablementManager,
  );
  if (args.name) {
    try {
      const extension = extensions.find(
        (extension) => extension.name === args.name,
      );
      if (!extension) {
        const allExtensionNames = extensions.map((e) => e.name);
        const suggestions = findSimilarExtensions(args.name, allExtensionNames);

        if (suggestions.length > 0) {
          console.log(
            `Extension "${args.name}" not found. Did you mean one of these?`,
          );
          suggestions.forEach((name) => console.log(`  - ${name}`));
        } else if (allExtensionNames.length > 0) {
          console.log(`Extension "${args.name}" not found.`);
          console.log('Available extensions:');
          allExtensionNames.forEach((name) => console.log(`  - ${name}`));
        } else {
          console.log(
            `Extension "${args.name}" not found. No extensions are currently installed.`,
          );
        }
        return;
      }
      let updateState: ExtensionUpdateState | undefined;
      if (!extension.installMetadata) {
        console.log(
          `Unable to install extension "${args.name}" due to missing install metadata`,
        );
        return;
      }
      await checkForExtensionUpdate(extension, (newState) => {
        updateState = newState;
      });
      if (updateState !== ExtensionUpdateState.UPDATE_AVAILABLE) {
        console.log(`Extension "${args.name}" is already up to date.`);
        return;
      }
      const updatedExtensionInfo = (await updateExtension(
        extension,
        workingDir,
        requestConsentNonInteractive,
        updateState,
        () => {},
      ))!;
      if (
        updatedExtensionInfo.originalVersion !==
        updatedExtensionInfo.updatedVersion
      ) {
        console.log(
          `Extension "${args.name}" successfully updated: ${updatedExtensionInfo.originalVersion} → ${updatedExtensionInfo.updatedVersion}.`,
        );
      } else {
        console.log(`Extension "${args.name}" is already up to date.`);
      }
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
  if (args.all) {
    try {
      const extensionState = new Map();
      await checkForAllExtensionUpdates(extensions, (action) => {
        if (action.type === 'SET_STATE') {
          extensionState.set(action.payload.name, {
            status: action.payload.state,
            processed: true, // No need to process as we will force the update.
          });
        }
      });
      let updateInfos = await updateAllUpdatableExtensions(
        workingDir,
        requestConsentNonInteractive,
        extensions,
        extensionState,
        () => {},
      );
      updateInfos = updateInfos.filter(
        (info) => info.originalVersion !== info.updatedVersion,
      );
      if (updateInfos.length === 0) {
        console.log('No extensions to update.');
        return;
      }
      console.log(updateInfos.map((info) => updateOutput(info)).join('\n'));
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
}

export const updateCommand: CommandModule = {
  command: 'update [<name>] [--all]',
  describe:
    'Updates all extensions or a named extension to the latest version.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name of the extension to update.',
        type: 'string',
      })
      .option('all', {
        describe: 'Update all extensions.',
        type: 'boolean',
      })
      .conflicts('name', 'all')
      .check((argv) => {
        if (!argv.all && !argv.name) {
          throw new Error('Either an extension name or --all must be provided');
        }
        return true;
      }),
  handler: async (argv) => {
    await handleUpdate({
      name: argv['name'] as string | undefined,
      all: argv['all'] as boolean | undefined,
    });
  },
};
