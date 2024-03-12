import fs from 'node:fs';
import * as path from 'node:path';
import * as glob from '@actions/glob';
import { config } from '../config';

/**
 * Creates a temp directory in the workspace. Fails with exit code 1 on error.
 *
 * Throws on error.
 *
 * @returns {string} The temp directory path
 */
export function createTempDir() {
  const tmpPath = path.join(process.env.GITHUB_WORKSPACE, config.lcovTempDirectoryName);
  try {
    fs.mkdirSync(tmpPath);
    return tmpPath;
  } catch (error) {
    throw new Error(`${config.action_msg_prefix} creating a temp dir failed with: ${error.message}`);
  }
}

/**
 * Capitalizes the first letter of a word.
 *
 * @param {string} word - Word to capitalize
 * @returns {string} Word with first letter capitalized
 */
export function firstCharToUpperCase(word) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/**
 * Lists files matching a glob pattern.
 *
 * @param {string} path - Pattern to match coverage LCOV files
 * @returns {Promise<string[]>} Array of matching file paths
 */
export async function listFiles(path) {
  const globber = await glob.create(path, { followSymbolicLinks: false, matchDirectories: false });
  return await globber.glob();
}
