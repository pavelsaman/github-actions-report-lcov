import * as core from '@actions/core';
import * as github from '@actions/github';
import lcovTotal from 'lcov-total';
import { config, inputs } from './config';
import { commentOnPR, getChangedFilenames } from './github';
import { listFiles } from './utils';
import { mergeCoverages, detail, summarize, generateHTMLAndUpload } from './lcov';
import { createTempDir, roundToOneDecimalPlace, runningInPullRequest, buildHeader, buildMessageBody } from './utils';

async function run() {
  const coverageFiles = await listFiles(inputs.coverageFilesPattern);
  if (!coverageFiles.length) {
    core.error(`${config.action_msg_prefix} no coverage lcov files found with pattern ${inputs.coverageFilesPattern}`);
    process.exit(1);
  }
  const tmpDir = createTempDir();

  try {
    const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpDir);
    const totalCoverageRounded = roundToOneDecimalPlace(lcovTotal(mergedCoverageFile));
    const errorMessage = `Code coverage: **${totalCoverageRounded}** %. Expected at least **${inputs.minimumCoverage}** %.`;
    const isMinimumCoverageReached = totalCoverageRounded >= inputs.minimumCoverage;

    if (inputs.gitHubToken && runningInPullRequest()) {
      const octokit = github.getOctokit(inputs.gitHubToken);
      const body = buildMessageBody({
        header: buildHeader(isMinimumCoverageReached),
        summary: await summarize(mergedCoverageFile),
        details: await detail(mergedCoverageFile, await getChangedFilenames(octokit)),
        isMinimumCoverageReached,
        errorMessage,
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

    core.setOutput('total-coverage', totalCoverageRounded);
    if (!isMinimumCoverageReached) {
      core.setFailed(errorMessage.replace(/\*/g, ''));
    }
  } catch (error) {
    core.setFailed(`${config.action_msg_prefix} ${error.message}`);
  }
}

run();
