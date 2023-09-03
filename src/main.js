import * as core from '@actions/core';
import * as github from '@actions/github';
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
  if (inputs.gitHubToken) {
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
  if (inputs.gitHubToken && runningInPullRequest()) {
    commentOnPR({
      octokit,
      updateComment: inputs.updateComment,
      body,
    });
  } else {
    core.warning(
      `${config.action_msg_prefix} no github-token provided or not running in a PR workflow. Skipping creating a PR comment.`,
    );
  }

  postToSummary(body);

  setCoverageOutputs(totalCoverages);

  if (inputs.artifactName) {
    generateHTMLAndUpload(coverageFiles, inputs.artifactName, tmpDir);
  }
}

run();
