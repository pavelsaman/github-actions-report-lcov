import * as glob from '@actions/glob';
import * as github from '@actions/github';
import * as core from '@actions/core';
import * as path from 'path';
import { config } from '../config';
import fs from 'fs';

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

/**
 * Builds the PR comment header section.
 *
 * @param {boolean} isMinimumCoverage - If minimum coverage is reached
 * @param {object} sha - The object with short and full sha
 * @returns {string} The header markdown
 */
export function buildHeader(isMinimumCoverageReached, sha) {
  const emoji = isMinimumCoverageReached ? '' : ':no_entry:';
  const commitLink = `[<code>${sha.short}</code>](${github.context.payload.pull_request.number}/commits/${sha.full})`;
  return `## ${emoji} Code coverage of commit ${commitLink}\n\n`;
}

/**
 * Builds the PR comment body string.
 *
 * @param {object} params Parameters including header, summary, details, isMinimumCoverageReached, and errorMessage
 * @returns {string} The message body markdown
 */
export function buildMessageBody(params) {
  const { header, summary, details, isMinimumCoverageReached, errorMessage } = params;
  const errorInfo = isMinimumCoverageReached ? '' : `:no_entry: ${errorMessage}`;
  return `${header}<pre>${summary}\n\nChanged files coverage rate: ${details}</pre>\n\n${errorInfo}`;
}

/**
 * Checks if the action is running in a pull request context.
 *
 * @returns {boolean} True if running in PR, false otherwise
 */
export function runningInPullRequest() {
  const allowedGitHubEvents = ['pull_request', 'pull_request_target'];
  return allowedGitHubEvents.includes(github.context.eventName);
}

/**
 * Rounds a number to one decimal place.
 *
 * @param {number} num - The number to round
 * @returns {number} The rounded number
 */
export function roundToOneDecimalPlace(num) {
  return Math.round(num * 10) / 10;
}

/**
 * Creates a temp directory in the workspace.
 *
 * @returns {string} The temp directory path
 */
export function createTempDir() {
  const tmpPath = path.join(process.env.GITHUB_WORKSPACE, 'lcov-tmp-dir');

  try {
    fs.mkdirSync(tmpPath);
    return tmpPath;
  } catch (error) {
    core.error(`${config.action_msg_prefix} creating a temp dir failed with: ${error.message}`);
    process.exit(1);
  }
}
