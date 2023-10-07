import * as core from '@actions/core';
import { config, inputs } from '../config';
import { listFiles } from '../utils';

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
