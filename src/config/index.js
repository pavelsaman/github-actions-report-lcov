import * as core from '@actions/core';

export const config = {
  newline: /\r?\n/,
  common_lcov_args: ['--rc', 'lcov_branch_coverage=1'],
  action_msg_prefix: 'code coverage gh action:',
  failureEmoji: ':no_entry:',
  detailsHeaderSize: 3,
  collapseDetailsIfLines: 10,
};

export const inputs = {
  coverageFilesPattern: core.getInput('coverage-files'),
  updateComment: core.getInput('update-comment') === 'true',
  artifactName: core.getInput('artifact-name'),
  minimumLineCoverage: Number(core.getInput('minimum-line-coverage')) || 0,
  minimumBranchCoverage: Number(core.getInput('minimum-branch-coverage')) || 0,
  minimumFunctionCoverage: Number(core.getInput('minimum-function-coverage')) || 0,
  gitHubToken: core.getInput('github-token'),
  workingDirectory: core.getInput('working-directory'),
  listFullPaths: core.getInput('list-full-paths') === 'true',
};
