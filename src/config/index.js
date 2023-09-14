import * as core from '@actions/core';

const repositoryUrl = `${process.env?.GITHUB_SERVER_URL}/${process.env?.GITHUB_REPOSITORY}`;

export const config = {
  newline: /\r?\n/,
  common_lcov_args: ['--rc', 'lcov_branch_coverage=1'],
  action_msg_prefix: 'code coverage gh action:',
  failureEmoji: ':no_entry:',
  collapseDetailsIfLines: 5,
  allowedGitHubEvents: ['pull_request', 'pull_request_target'],
  lcovTempDirectoryName: 'lcov-tmp-dir',
  prCommentTableHeader: [
    { data: 'Line cov', header: true },
    { data: 'Branch cov', header: true },
    { data: 'Function cov', header: true },
  ],
  urlToFileAtCommit: `${repositoryUrl}/blob/{commit}/{filePath}`,
};

export const inputs = {
  coverageFilesPattern: core.getInput('coverage-files'),
  updateComment: core.getInput('update-comment') === 'true',
  artifactName: core.getInput('artifact-name'),
  minimumLineCoverage: Number(core.getInput('minimum-line-coverage')) || 0,
  minimumBranchCoverage: Number(core.getInput('minimum-branch-coverage')) || 0,
  minimumFunctionCoverage: Number(core.getInput('minimum-function-coverage')) || 0,
  gitHubToken: core.getInput('github-token'),
  installLcov: core.getInput('install-lcov') === 'true',
  commentOnPR: core.getInput('comment-on-pr') === 'true',
};
