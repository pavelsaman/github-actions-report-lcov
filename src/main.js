const artifact = require('@actions/artifact');
const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const glob = require('@actions/glob');
const lcovTotal = require('lcov-total');
const path = require('path');
const fs = require('fs');

function readAndSetInputs() {
  return {
    coverageFilesPattern: core.getInput('coverage-files'),
    additionalMessage: core.getInput('additional-message'),
    updateComment: core.getInput('update-comment') === 'true',
    artifactName: core.getInput('artifact-name'),
    minimumCoverage: Number(core.getInput('minimum-coverage') || 0),
    gitHubToken: core.getInput('github-token'),
    workingDirectory: core.getInput('working-directory') || './',
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
  return `### ${isMinimumCoverageReached ? '' : ':no_entry:'} Code coverage of commit [<code>${sha().short}</code>](${
    github.context.payload.pull_request.number
  }/commits/${sha().full})\n\n`;
}

function buildMessageBody(params) {
  const { header, summary, details, additionalMessage, isMinimumCoverageReached, errorMessage } = params;

  return `${header}<pre>${summary}\n\nChanged files coverage rate: ${details}</pre>\n\n${
    isMinimumCoverageReached ? '' : `:no_entry: ${errorMessage}`
  }${additionalMessage ? `\n\n${additionalMessage}` : ''}`;
}

function runningInPullRequest() {
  const allowedGitHubEvents = ['pull_request', 'pull_request_target'];
  return allowedGitHubEvents.includes(github.context.eventName);
}

function getCommonLcovArgs() {
  return ['--rc', 'lcov_branch_coverage=1'];
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

async function run() {
  const { coverageFilesPattern, additionalMessage, updateComment, artifactName, minimumCoverage, gitHubToken } =
    readAndSetInputs();

  try {
    const tmpPath = `${process.env.GITHUB_WORKSPACE}/lcov-tmp-dir`;
    fs.mkdirSync(tmpPath);
    const globber = await glob.create(coverageFilesPattern);
    const coverageFiles = await globber.glob();

    if (artifactName) {
      await generateHTMLAndUpload(artifactName, coverageFiles, tmpPath);
    }

    const mergedCoverageFile = await mergeCoverages(coverageFiles, tmpPath);
    const totalCoverageRounded = Math.round(lcovTotal(mergedCoverageFile) * 10) / 10;
    const errorMessage = `Code coverage: **${Math.round(totalCoverageRounded).toFixed(
      1,
    )}** %. Expected at least **${minimumCoverage}** %.`;
    const isMinimumCoverageReached = totalCoverageRounded >= minimumCoverage;

    if (gitHubToken && runningInPullRequest()) {
      const octokit = github.getOctokit(gitHubToken);
      const body = buildMessageBody({
        header: buildHeader(isMinimumCoverageReached),
        summary: await summarize(mergedCoverageFile),
        details: await detail(mergedCoverageFile, octokit),
        additionalMessage,
        isMinimumCoverageReached,
        errorMessage,
      });

      commentOnPR({
        octokit,
        updateComment,
        header: 'Code coverage',
        body,
      });
    } else {
      core.info('github-token received is empty. Skipping writing a comment in the PR.');
      core.info(
        'Note: This could happen even if github-token was provided in workflow file. It could be because your github token does not have permissions for commenting in target repo.',
      );
    }

    core.setOutput('total-coverage', totalCoverageRounded);
    if (!isMinimumCoverageReached) {
      core.setFailed(errorMessage.replace('*', ''));
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function generateHTMLAndUpload(artifactName, coverageFiles, tmpPath) {
  const { workingDirectory } = readAndSetInputs();
  const artifactPath = path.resolve(tmpPath, 'html').trim();

  const args = [...coverageFiles, ...getCommonLcovArgs(), '--output-directory', artifactPath];

  await exec.exec('genhtml', args, { cwd: workingDirectory });

  const globber = await glob.create(`${artifactPath}/**`);
  const htmlFiles = await globber.glob();

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

  await exec.exec('lcov', [...args, ...getCommonLcovArgs()]);

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

  await exec.exec('lcov', ['--summary', mergedCoverageFile, ...getCommonLcovArgs()], options);

  const lines = output.trim().split(/\r?\n/);
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
  await exec.exec('lcov', ['--list', coverageFile, ...args, ...getCommonLcovArgs()], options);

  let lines = output.trim().split(/\r?\n/);
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

    for (const changedFile of changedFiles) {
      console.log(`${line} === ${changedFile}`);

      if (line.startsWith(changedFile)) {
        return true;
      }
    }

    return false;
  });

  const onlyHeaderRemains = lines.length === 3;
  return onlyHeaderRemains ? 'n/a' : `\n  ${lines.join('\n  ')}`;
}

run();
