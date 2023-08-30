import * as core from '@actions/core';
import * as github from '@actions/github';
import totalCoverage from 'total-coverage';
import { config, inputs } from './config';
import { commentOnPR, getChangedFilenames, sha } from './github';
import { detail, generateHTMLAndUpload, mergeCoverages, summarize } from './lcov';
import {
  buildHeader,
  buildMessageBody,
  createErrorMessageAndSetFailedStatus,
  createTempDir,
  findFailedCoverages,
  listFiles,
  runningInPullRequest,
  setCoverageOutputs,
} from './utils';

async function run() {
  const coverageFiles = await listFiles(inputs.coverageFilesPattern);
  if (!coverageFiles.length) {
    core.error(`${config.action_msg_prefix} no coverage lcov files found with pattern ${inputs.coverageFilesPattern}`);
    process.exit(1);
  }
  const tmpDir = createTempDir();

  try {
    const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpDir);
    const totalCoverages = totalCoverage(mergedCoverageFile);
    const coverageInfo = findFailedCoverages(totalCoverages);
    const isMinimumCoverageReached = Object.values(coverageInfo).every((c) => c.isMinimumCoverageReached);

    if (inputs.gitHubToken && runningInPullRequest()) {
      const octokit = github.getOctokit(inputs.gitHubToken);
      const body = buildMessageBody({
        header: buildHeader(isMinimumCoverageReached, sha()),
        summary: await summarize(mergedCoverageFile),
        details: await detail(mergedCoverageFile, await getChangedFilenames(octokit)),
        isMinimumCoverageReached,
        errorMessage: createErrorMessageAndSetFailedStatus(coverageInfo),
      });

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

    if (inputs.artifactName) {
      generateHTMLAndUpload(coverageFiles, inputs.artifactName, tmpDir);
    }

    setCoverageOutputs(totalCoverages);
  } catch (error) {
    core.setFailed(`${config.action_msg_prefix} ${error.message}`);
  }
}

run();
