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
 * Builds the PR comment header section
 *
 * @param {boolean} isMinimumCoverage - If minimum coverage is reached
 * @param {object} sha - The object with short and full sha
 * @returns {string} The header markdown
 */
export function buildHeader(isMinimumCoverageReached, sha) {
  const emoji = isMinimumCoverageReached ? '' : config.failureEmoji;
  const commitLink = `[<code>${sha.short}</code>](${github.context.payload.pull_request.number}/commits/${sha.full})`;
  return `## ${emoji} Code coverage of commit ${commitLink}\n\n`;
}

/**
 * Creates a detail table showing coverage data for each file
 *
 * @param {Object} coverageData - The coverage data object
 * @returns {Promise<string>} The formatted detail table as a string
 */
async function createDetailTable(coverageData) {
  const fileCoverageResultsExist = Object.keys(coverageData.files ?? {}).length > 0;

  if (!fileCoverageResultsExist) {
    return '';
  }

  const details = [[{ data: 'File', header: true }, ...config.prCommentTableHeader]];
  for (const [file, coverageDetails] of Object.entries(coverageData.files)) {
    details.push([
      file,
      `${coverageDetails.totalLineCov} %`,
      `${coverageDetails.totalBranchCov} %`,
      `${coverageDetails.totalFunctionCov} %`,
    ]);
  }

  const detailsHaveManyLines = Object.keys(coverageData.files).length > config.collapseDetailsIfLines;

  await core.summary.clear();
  const detailHeading = core.summary.addHeading('Changed files coverage rate', 3).addEOL().stringify();
  await core.summary.clear();

  let detailTable = core.summary.addTable(details).addEOL().stringify();
  if (detailsHaveManyLines) {
    detailTable = `<details><summary>Click to see details</summary>${detailTable}</details>`;
  }
  await core.summary.clear();

  return `${detailHeading}${detailTable}`;
}

/**
 * Creates a summary table showing total coverage rates
 *
 * @param {Object} coverageData - The coverage data object
 * @returns {Promise<string>} The formatted summary table as a string
 */
async function createSummaryTable(coverageData) {
  await core.summary.clear();
  const summaryTable = core.summary
    .addHeading('Summary coverage rate', 3)
    .addTable([
      config.prCommentTableHeader,
      [`${coverageData.totalLineCov} %`, `${coverageData.totalBranchCov} %`, `${coverageData.totalFunctionCov} %`],
    ])
    .addEOL()
    .stringify();
  await core.summary.clear();
  return summaryTable;
}

/**
 * Builds the PR comment body string
 *
 * @param {object} params Parameters including header, coverageData, and errorMessage
 * @returns {Promise<string>} The message body markdown
 */
export async function buildMessageBody(params) {
  const { header, coverageData, errorMessage } = params;

  const summaryTable = await createSummaryTable(coverageData);
  const detailTable = await createDetailTable(coverageData);

  return `${header}${summaryTable}${errorMessage}${detailTable}`;
}

/**
 * Checks if the action is running in a pull request context
 *
 * @returns {boolean} True if running in PR, false otherwise
 */
export function runningInPullRequest() {
  return config.allowedGitHubEvents.includes(github.context.eventName);
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
