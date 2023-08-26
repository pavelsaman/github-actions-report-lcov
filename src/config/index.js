const core = require('@actions/core');

const config = {
  config: {
    newline: /\r?\n/,
    common_lcov_args: ['--rc', 'lcov_branch_coverage=1'],
    action_msg_prefix: 'code coverage gh action:',
  },
  inputs: {
    coverageFilesPattern: core.getInput('coverage-files'),
    updateComment: core.getInput('update-comment') === 'true',
    artifactName: core.getInput('artifact-name'),
    minimumCoverage: Number(core.getInput('minimum-coverage')) || 0,
    gitHubToken: core.getInput('github-token'),
    workingDirectory: core.getInput('working-directory'),
    listFullPaths: core.getInput('list-full-paths') === 'true',
  },
};

module.exports = {
  ...config,
};
