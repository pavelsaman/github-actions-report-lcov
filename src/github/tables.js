import * as core from '@actions/core';
import * as github from '@actions/github';
import { config } from '../config';

/**
 * Creates a detail table showing coverage data for each file
 *
 * @param {Object} coverageData - The coverage data object
 * @returns {string} The formatted detail table as a string
 */
export function createDetailTable(coverageData) {
  const files = coverageData.files ?? {};
  const noFileCoverageResults = Object.keys(files).length === 0;

  if (noFileCoverageResults) {
    return '';
  }

  const tableHeader = [{ data: 'File', header: true }, ...config.prCommentTableHeader];
  const tableRows = Object.entries(files)
    .sort(([fileA], [fileB]) => fileA.localeCompare(fileB))
    .map(([file, coverageDetails]) => {
      return [
        createFileLink(file),
        `${coverageDetails.totalLineCov} %`,
        `${coverageDetails.totalBranchCov} %`,
        `${coverageDetails.totalFunctionCov} %`,
      ];
    });

  // remember current summary buffer content
  const summaryBuffer = core.summary.stringify();
  const heading = core.summary.emptyBuffer().addHeading('Changed files coverage rate', 3).addEOL().stringify();
  const table = core.summary
    .emptyBuffer()
    .addTable([tableHeader, ...tableRows])
    .addEOL()
    .stringify();
  // restore summary buffer
  core.summary.emptyBuffer().addRaw(summaryBuffer);

  const detailsHaveManyLines = Object.keys(coverageData.files).length > config.collapseDetailsIfLines;
  if (detailsHaveManyLines) {
    return `${heading}<details><summary>Click to see details</summary>${table}</details>`;
  }

  return `${heading}${table}`;
}

/**
 * Creates a summary table showing total coverage rates
 *
 * @param {Object} coverageData - The coverage data object
 * @returns {string} The formatted summary table as a string
 */
export function createSummaryTable(coverageData) {
  // remember current summary buffer content
  const summaryBuffer = core.summary.stringify();
  const table = core.summary
    .emptyBuffer()
    .addHeading('Summary coverage rate', 3)
    .addTable([
      config.prCommentTableHeader,
      [`${coverageData.totalLineCov} %`, `${coverageData.totalBranchCov} %`, `${coverageData.totalFunctionCov} %`],
    ])
    .addEOL()
    .stringify();
  // restore summary buffer
  core.summary.emptyBuffer().addRaw(summaryBuffer);
  return table;
}

/**
 * Creates a URL to view a file at a specific commit in GitHub
 *
 * @param {string} file - The path to the file in the repository
 * @returns {string} The URL to view the file
 */
function createFileLink(file) {
  const fileLink = config.urlToFileAtCommit.replace('{commit}', github.context.sha).replace('{filePath}', file);
  return `<a href="${fileLink}">${file}</a>`;
}
