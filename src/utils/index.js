import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import fs from 'fs';
import * as path from 'path';
import { config, inputs } from '../config';

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
 * @param {object} params Parameters including header, summary, details, and errorMessage
 * @returns {string} The message body markdown
 */
export function buildMessageBody(params) {
  const { header, summary, details, errorMessage } = params;
  return `${header}<pre>${summary}\n\nChanged files coverage rate: ${details}</pre>\n\n${errorMessage}`;
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

/**
 * Returns coverage info for all three types of coverage.
 *
 * @param {object} totalCoverages - Object containing total coverage percentages.
 * @returns {object} Object containing coverage info for line, function, and branch coverage.
 */
export function findFailedCoverages(totalCoverages) {
  return {
    line: {
      coverage: totalCoverages.totalLineCov,
      minCoverage: inputs.minimumLineCoverage,
      isMinimumCoverageReached: totalCoverages.totalLineCov >= inputs.minimumLineCoverage,
    },
    function: {
      coverage: totalCoverages.totalFunctionCov,
      minCoverage: inputs.minimumFunctionCoverage,
      isMinimumCoverageReached: totalCoverages.totalFunctionCov >= inputs.minimumFunctionCoverage,
    },
    branch: {
      coverage: totalCoverages.totalBranchCov,
      minCoverage: inputs.minimumBranchCoverage,
      isMinimumCoverageReached: totalCoverages.totalBranchCov >= inputs.minimumBranchCoverage,
    },
  };
}

/**
 * Capitalizes the first letter of a word.
 *
 * @param {string} word - Word to capitalize.
 * @returns {string} Word with first letter capitalized.
 */
function firstCharToUpperCase(word) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/**
 * Creates an error message for the pull request and sets failed status.
 *
 * @param {object} coveragesInfo - Object containing coverage info.
 * @returns {string} Error message string.
 */
export function createErrorMessageAndSetFailedStatus(coveragesInfo) {
  let errorMessage = '';
  for (const [coverageType, coverageInfo] of Object.entries(coveragesInfo).filter(
    ([_coverageTypes, coverageInfo]) => !coverageInfo.isMinimumCoverageReached,
  )) {
    errorMessage += `:no_entry: ${firstCharToUpperCase(coverageType)} coverage: **${
      coverageInfo.coverage
    }** %. Expected at least **${coverageInfo.minCoverage}** %.\n\n`;
  }
  if (errorMessage) {
    core.setFailed(errorMessage.replace(/\*/g, ''));
  }
  return errorMessage;
}
