import fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as glob from '@actions/glob';
import { config, inputs } from '../config';
import { runningInPullRequest, sha } from '../github';
import { createDetailTable, createSummaryTable } from '../github/tables';

/**
 * Builds comment header section
 *
 * @param {boolean} isMinimumCoverage - If minimum coverage is reached
 * @returns {string} The header markdown
 */
function buildHeader(isMinimumCoverageReached) {
  const shas = sha();
  const emoji = isMinimumCoverageReached ? '' : config.failureEmoji;
  const commitLink = runningInPullRequest()
    ? `[<code>${shas.short}</code>](${github.context.payload.pull_request.number}/commits/${shas.full})`
    : `[<code>${shas.short}</code>](${config.repositoryUrl}/commit/${shas.full})`;
  return `## ${emoji} Code coverage of commit ${commitLink}\n\n`;
}

/**
 * Builds comment body string
 *
 * @param {object} coverageData - Object containing total coverage percentages
 * @returns {Promise<string>} The message body markdown
 */
export function buildMessageBody(coverageData) {
  const coverageInfo = findFailedCoverages(coverageData);
  const isMinimumCoverageReached = Object.values(coverageInfo).every((c) => c.isMinimumCoverageReached);

  const header = buildHeader(isMinimumCoverageReached);
  const summaryTable = createSummaryTable(coverageData);
  const errorMessage = createErrorMessageAndSetFailedStatus(coverageInfo);
  const detailTable = createDetailTable(coverageData);

  return `${header}${summaryTable}${errorMessage}${detailTable}`;
}

/**
 * Creates a temp directory in the workspace
 *
 * @returns {string} The temp directory path
 */
export function createTempDir() {
  const tmpPath = path.join(process.env.GITHUB_WORKSPACE, config.lcovTempDirectoryName);

  try {
    fs.mkdirSync(tmpPath);
    return tmpPath;
  } catch (error) {
    core.error(`${config.action_msg_prefix} creating a temp dir failed with: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Returns coverage info for all three types of coverage
 *
 * @param {object} totalCoverages - Object containing total coverage percentages
 * @returns {object} Object containing coverage info for line, function, and branch coverage
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
 * Capitalizes the first letter of a word
 *
 * @param {string} word - Word to capitalize
 * @returns {string} Word with first letter capitalized
 */
function firstCharToUpperCase(word) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

/**
 * Creates an error message for the pull request and sets failed status
 *
 * @param {object} coveragesInfo - Object containing coverage info
 * @returns {string} Error message string
 */
export function createErrorMessageAndSetFailedStatus(coveragesInfo) {
  let errorMessage = '';
  for (const [coverageType, coverageInfo] of Object.entries(coveragesInfo).filter(
    ([_, coverageInfo]) => !coverageInfo.isMinimumCoverageReached,
  )) {
    errorMessage += `${config.failureEmoji} ${firstCharToUpperCase(coverageType)} coverage: **${
      coverageInfo.coverage
    }** %. Expected at least **${coverageInfo.minCoverage}** %.\n\n`;
  }
  if (errorMessage) {
    core.setFailed(
      errorMessage.replace(/\*/g, '').replace(new RegExp(config.failureEmoji, 'g'), '').replace(/\n\n/g, ' '),
    );
  }
  return errorMessage;
}

/**
 * Set the coverage output values for the GitHub action
 *
 * @param {Object} totalCoverages - Object containing total coverage percentages
 */
export function setCoverageOutputs(totalCoverages) {
  core.setOutput('total-line-coverage', totalCoverages.totalLineCov);
  core.setOutput('total-branch-coverage', totalCoverages.totalBranchCov);
  core.setOutput('total-function-coverage', totalCoverages.totalFunctionCov);
}

/**
 * Lists files matching a glob pattern.
 *
 * @param {string} path - Pattern to match coverage LCOV files
 * @returns {Promise<string[]>} Array of matching file paths
 */
async function listFiles(path) {
  const globber = await glob.create(path, { followSymbolicLinks: false, matchDirectories: false });
  return await globber.glob();
}

/**
 * Get the coverage files matching the pattern. Exit with exit code 1 if no coverafe files were found.
 *
 * @returns {Promise<string[]>} The paths to the coverage files.
 */
export async function getCoverageFiles() {
  const coverageFiles = await listFiles(inputs.coverageFilesPattern);
  if (!coverageFiles.length) {
    core.error(`${config.action_msg_prefix} no coverage lcov files found with pattern ${inputs.coverageFilesPattern}`);
    process.exit(1);
  }
  return coverageFiles;
}
