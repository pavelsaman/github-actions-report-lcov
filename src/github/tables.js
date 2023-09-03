import * as core from '@actions/core';
import { config } from '../config';
import { createFileLink } from '../utils';

/**
 * Creates a detail table showing coverage data for each file
 *
 * @param {Object} coverageData - The coverage data object
 * @returns {Promise<string>} The formatted detail table as a string
 */
export async function createDetailTable(coverageData) {
  const files = coverageData.files ?? {};
  const noFileCoverageResults = Object.keys(files).length === 0;

  if (noFileCoverageResults) {
    return '';
  }

  const tableHeader = [{ data: 'File', header: true }, ...config.prCommentTableHeader];
  const tableRows = Object.entries(files).map(([file, coverageDetails]) => {
    return [
      createFileLink(file),
      `${coverageDetails.totalLineCov} %`,
      `${coverageDetails.totalBranchCov} %`,
      `${coverageDetails.totalFunctionCov} %`,
    ];
  });

  await core.summary.clear();
  const heading = core.summary.addHeading('Changed files coverage rate', 3).addEOL().stringify();
  await core.summary.clear();

  const table = core.summary
    .addTable([tableHeader, ...tableRows])
    .addEOL()
    .stringify();
  await core.summary.clear();

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
 * @returns {Promise<string>} The formatted summary table as a string
 */
export async function createSummaryTable(coverageData) {
  await core.summary.clear();
  const table = core.summary
    .addHeading('Summary coverage rate', 3)
    .addTable([
      config.prCommentTableHeader,
      [`${coverageData.totalLineCov} %`, `${coverageData.totalBranchCov} %`, `${coverageData.totalFunctionCov} %`],
    ])
    .addEOL()
    .stringify();
  await core.summary.clear();
  return table;
}
