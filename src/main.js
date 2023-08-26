const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const glob = require('@actions/glob');
const lcovTotal = require('lcov-total');
const path = require('path');
const fs = require('fs');

const NEWLINE = /\r?\n/;
const COMMON_LCOV_ARGS = ['--rc', 'lcov_branch_coverage=1'];

function readAndSetInputs() {
  return {
    coverageFilesPattern: core.getInput('coverage-files'),
    updateComment: core.getInput('update-comment') === 'true',
    artifactName: core.getInput('artifact-name'),
    minimumCoverage: Number(core.getInput('minimum-coverage')) || 0,
    gitHubToken: core.getInput('github-token'),
    workingDirectory: core.getInput('working-directory'),
    listFullPaths: core.getInput('list-full-paths') === 'true',
  };
}

function sha() {
  const full = github.context.payload.pull_request.head.sha;
  return {
    full,
    short: full.substr(0, 7),
  };
}

function buildHeader(isMinimumCoverageReached) {
  return `## ${isMinimumCoverageReached ? '' : ':no_entry:'} Code coverage of commit [<code>${sha().short}</code>](${
    github.context.payload.pull_request.number
  }/commits/${sha().full})\n\n`;
}

function buildMessageBody(params) {
  const { header, summary, details, isMinimumCoverageReached, errorMessage } = params;

  return `${header}<pre>${summary}\n\nChanged files coverage rate: ${details}</pre>\n\n${
    isMinimumCoverageReached ? '' : `:no_entry: ${errorMessage}`
  }`;
}

function runningInPullRequest() {
  const allowedGitHubEvents = ['pull_request', 'pull_request_target'];
  return allowedGitHubEvents.includes(github.context.eventName);
}

async function getExistingPRComment(octokitInstance, commentHeader) {
  const issueComments = await octokitInstance.rest.issues.listComments({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    issue_number: github.context.payload.pull_request.number,
  });

  return issueComments.data.find((comment) => comment.body.includes(commentHeader));
}

async function commentOnPR(params) {
  const { updateComment, header, body, octokit } = params;

  const existingComment = await getExistingPRComment(octokit, header);
  const shouldUpdateComment = updateComment && existingComment;
  const prAction = shouldUpdateComment ? octokit.rest.issues.updateComment : octokit.rest.issues.createComment;
  const data = {
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    body,
    ...(shouldUpdateComment
      ? { comment_id: existingComment.id }
      : { issue_number: github.context.payload.pull_request.number }),
  };

  prAction(data);
}

function roundToOneDecimalPlace(num) {
  return Math.round(num * 10) / 10;
}

async function listFiles(path) {
  const globber = await glob.create(path);
  const files = await globber.glob();
  return files.filter((file) => {
    try {
      return fs.statSync(file).isFile();
    } catch (error) {
      console.log(error.message);
      return false;
    }
  });
}

async function run() {
  const { coverageFilesPattern, updateComment, artifactName, minimumCoverage, gitHubToken } = readAndSetInputs();

  try {
    const tmpPath = `${process.env.GITHUB_WORKSPACE}/lcov-tmp-dir`;
    fs.mkdirSync(tmpPath);
    const coverageFiles = await listFiles(coverageFilesPattern);

    const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpPath);
    const totalCoverageRounded = roundToOneDecimalPlace(lcovTotal(mergedCoverageFile));
    const errorMessage = `Code coverage: **${totalCoverageRounded}** %. Expected at least **${minimumCoverage}** %.`;
    const isMinimumCoverageReached = totalCoverageRounded >= minimumCoverage;

    if (gitHubToken && runningInPullRequest()) {
      const octokit = github.getOctokit(gitHubToken);
      const body = buildMessageBody({
        header: buildHeader(isMinimumCoverageReached),
        summary: await summarize(mergedCoverageFile),
        details: await detail(mergedCoverageFile, octokit),
        isMinimumCoverageReached,
        errorMessage,
      });

      commentOnPR({
        octokit,
        updateComment,
        header: 'Code coverage',
        body,
      });
      if (artifactName) {
        generateHTMLAndUpload(coverageFiles, artifactName, tmpPath);
      }
    } else {
      core.warning('code coverage: no `github-token` provided. Skipping writing a comment to the PR.');
    }

    core.setOutput('total-coverage', totalCoverageRounded);
    if (!isMinimumCoverageReached) {
      core.setFailed(errorMessage.replace(/\*/g, ''));
    }
  } catch (error) {
    core.setFailed(`code coverage gh action: ${error.message}`);
  }
}

async function generateHTMLAndUpload(coverageFiles, artifactName, tmpPath) {
  const { workingDirectory } = readAndSetInputs();
  const artifactPath = path.resolve(tmpPath, 'html').trim();

  const args = [...coverageFiles, ...COMMON_LCOV_ARGS, '--output-directory', artifactPath];
  await exec.exec('genhtml', args, { cwd: workingDirectory });

  const htmlFiles = await listFiles(`${artifactPath}/**`);
  artifact.create().uploadArtifact(artifactName, htmlFiles, artifactPath, { continueOnError: false });
}

async function mergeCoverages(coverageFiles, tmpPath) {
  const mergedCoverageFile = `${tmpPath}/merged-lcov.info`;
  const args = [];

  for (const coverageFile of coverageFiles) {
    args.push('--add-tracefile');
    args.push(coverageFile);
  }

  args.push('--output-file');
  args.push(mergedCoverageFile);

  await exec.exec('lcov', [...args, ...COMMON_LCOV_ARGS]);

  return mergedCoverageFile;
}

async function summarize(mergedCoverageFile) {
  let output = '';
  const options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
      stderr: (data) => {
        output += data.toString();
      },
    },
  };

  await exec.exec('lcov', ['--summary', mergedCoverageFile, ...COMMON_LCOV_ARGS], options);

  const lines = output.trim().split(NEWLINE);
  lines.shift(); // remove debug info
  return lines.join('\n');
}

async function getChangedFilenames(octokitInstance) {
  const listFilesOptions = octokitInstance.rest.pulls.listFiles.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: github.context.payload.pull_request.number,
  });
  const listFilesResponse = await octokitInstance.paginate(listFilesOptions);
  return listFilesResponse.map((file) => file.filename);
}

function lineRefersToChangedFile(lineWithFilename, changedFiles) {
  return changedFiles.some((changedFile) => lineWithFilename.startsWith(changedFile));
}

async function detail(coverageFile, octokit) {
  let output = '';
  const options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
      stderr: (data) => {
        output += data.toString();
      },
    },
  };

  const { listFullPaths } = readAndSetInputs();
  const args = listFullPaths ? ['--list-full-path'] : [];
  await exec.exec('lcov', ['--list', coverageFile, ...args, ...COMMON_LCOV_ARGS], options);

  let lines = output.trim().split(NEWLINE);
  // remove debug info
  lines.shift();
  lines.pop();
  lines.pop();

  const changedFiles = await getChangedFilenames(octokit);
  lines = lines.filter((line, index) => {
    const includeHeader = index <= 2;
    if (includeHeader) {
      return true;
    }

    return lineRefersToChangedFile(line, changedFiles);
  });

  const onlyHeaderRemains = lines.length === 3;
  return onlyHeaderRemains ? 'n/a' : `\n  ${lines.join('\n  ')}`;
}

run();
