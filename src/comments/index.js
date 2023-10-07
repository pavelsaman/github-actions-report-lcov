import * as core from '@actions/core';
import * as github from '@actions/github';
import { config, inputs } from '../config';
import { findFailedCoverages } from '../coverage';
import { runningInPullRequest, sha } from '../github';
import { createDetailTable, createSummaryTable } from '../github/tables';
import { firstCharToUpperCase } from '../utils';

/**
 * Builds comment header section.
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
 * Builds comment body string.
 *
 * @param {object} coverageData - Object containing total coverage percentages
 * @returns {string} The message body markdown
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
 * Creates an error message for the pull request and sets failed status.
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
 * Checks if conditions are met to comment on a PR.
 *
 * @returns {boolean} True if should comment on PR, false otherwise
 */
export function shouldCommentOnPr() {
  return inputs.gitHubToken && inputs.commentOnPR && runningInPullRequest();
}
