import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync } from 'child_process';
import totalCoverage from 'total-coverage';
import { config, inputs } from './config';
import { commentOnPR, getChangedFilenames, postToSummary, runningInPullRequest, sha } from './github';
import { generateHTMLAndUpload, mergeCoverages } from './lcov';
import {
  buildHeader,
  buildMessageBody,
  createErrorMessageAndSetFailedStatus,
  createTempDir,
  findFailedCoverages,
  listFiles,
  setCoverageOutputs,
} from './utils';

async function run() {
  const coverageFiles = await listFiles(inputs.coverageFilesPattern);
  if (!coverageFiles.length) {
    core.error(`${config.action_msg_prefix} no coverage lcov files found with pattern ${inputs.coverageFilesPattern}`);
    process.exit(1);
  }
  const tmpDir = createTempDir();

  const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpDir);
  core.setOutput('merged-lcov-file', mergedCoverageFile);

  let octokit;
  let totalCoverages;
  if (inputs.gitHubToken && runningInPullRequest()) {
    octokit = github.getOctokit(inputs.gitHubToken);
    totalCoverages = totalCoverage(mergedCoverageFile, await getChangedFilenames(octokit));
  } else {
    totalCoverages = totalCoverage(mergedCoverageFile);
  }
  const coverageInfo = findFailedCoverages(totalCoverages);
  const isMinimumCoverageReached = Object.values(coverageInfo).every((c) => c.isMinimumCoverageReached);

  const body = buildMessageBody({
    header: buildHeader(isMinimumCoverageReached, sha()),
    coverageData: totalCoverages,
    errorMessage: createErrorMessageAndSetFailedStatus(coverageInfo),
  });
  if (inputs.gitHubToken && inputs.commentOnPR && runningInPullRequest()) {
    commentOnPR({
      octokit,
      updateComment: inputs.updateComment,
      body,
    });
  }

  postToSummary(body);

  setCoverageOutputs(totalCoverages);

  if (inputs.artifactName) {
    generateHTMLAndUpload(coverageFiles, inputs.artifactName, tmpDir);
  }
}

function install() {
  try {
    console.log('Installing lcov');

    const platform = process.env.RUNNER_OS;
    if (platform === 'Linux') {
      execSync('sudo apt-get update');
      execSync('sudo apt-get install --assume-yes lcov');
    } else if (platform === 'macOS') {
      execSync('brew install lcov');
    }
  } catch (error) {
    core.setFailed(`${config.action_msg_prefix} ${error.message}`);
  }
}

function main() {
  if (inputs.installLcov) {
    install();
  }

  const lcovVersion = execSync('lcov --version', { encoding: 'utf-8' });
  console.log(lcovVersion);

  run();
}

main();
