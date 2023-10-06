import { execSync } from 'child_process';
import * as core from '@actions/core';
import totalCoverage from 'total-coverage';
import { config, inputs } from './config';
import { commentOnPR, getChangedFilenames, postToSummary } from './github';
import { generateHTMLAndUpload, mergeCoverages } from './lcov';
import {
  buildMessageBody,
  createTempDir,
  getCoverageFiles,
  getOctokit,
  setCoverageOutputs,
  shouldCommentOnPr,
} from './utils';

async function run() {
  const coverageFiles = await getCoverageFiles();
  const tmpDir = createTempDir();
  const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpDir);

  core.setOutput('merged-lcov-file', mergedCoverageFile);

  const octokit = getOctokit();
  const totalCoverages = totalCoverage(mergedCoverageFile, await getChangedFilenames(octokit));

  const body = buildMessageBody(totalCoverages);
  if (octokit && shouldCommentOnPr()) {
    commentOnPR({
      octokit,
      updateComment: inputs.updateComment,
      body,
    });
  }

  postToSummary(body);
  setCoverageOutputs(totalCoverages);

  if (inputs.artifactName) {
    generateHTMLAndUpload(mergedCoverageFile, inputs.artifactName, tmpDir);
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
