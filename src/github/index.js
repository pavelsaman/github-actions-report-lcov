import * as artifact from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { buildMessageBody, shouldCommentOnPr } from '../comments';
import { config, inputs } from '../config';

/**
 * Gets existing coverage comment on pull request.
 *
 * @param {Object} octokitInstance - Octokit instance
 * @returns {Promise<Object|undefined>} The existing comment object
 */
async function getExistingPullRequestComment(octokitInstance) {
  try {
    const issueComments = await octokitInstance.rest.issues.listComments({
      repo: github.context.repo.repo,
      owner: github.context.repo.owner,
      issue_number: github.context.payload.pull_request.number,
    });
    return issueComments.data.find((comment) => comment.body.includes('Code coverage'));
  } catch (err) {
    core.warning(`${config.action_msg_prefix} cannot get current PR comments, error: ${err.message}`);
  }
  return undefined;
}

/**
 * Gets commit SHA information.
 *
 * @returns {{full: string, short: string}} The commit object with full and short SHA
 */
export function sha() {
  const full = github.context.payload.pull_request?.head?.sha ?? github.context.sha;
  return {
    full,
    short: full.substr(0, 7),
  };
}

/**
 * Gets changed filenames for a pull request.
 *
 * @param {Object} octokitInstance - Octokit instance
 * @returns {Promise<string[]>} Changed filenames
 */
export async function getChangedFilenames(octokitInstance) {
  if (!octokitInstance) {
    return [];
  }

  try {
    const listFilesOptions = octokitInstance.rest.pulls.listFiles.endpoint.merge({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.pull_request.number,
    });
    const listFilesResponse = await octokitInstance.paginate(listFilesOptions);
    return listFilesResponse.map((file) => file.filename);
  } catch (err) {
    core.warning(`${config.action_msg_prefix} cannot list changed files in the PR, error: ${err.message}`);
  }

  return [];
}

/**
 * Comments on a pull request.
 *
 * @param {Object} params - Parameters including updateComment, body, Octokit instance
 */
export async function commentOnPR(params) {
  const { updateComment, body, octokit: octokitInstance } = params;

  const existingComment = await getExistingPullRequestComment(octokitInstance);
  const shouldUpdateComment = updateComment && existingComment;
  const sendCommentToPR = shouldUpdateComment
    ? octokitInstance.rest.issues.updateComment
    : octokitInstance.rest.issues.createComment;
  const data = {
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    body,
    ...(shouldUpdateComment
      ? { comment_id: existingComment.id }
      : { issue_number: github.context.payload.pull_request.number }),
  };

  try {
    sendCommentToPR(data);
  } catch (err) {
    core.warning(`${config.action_msg_prefix} cannot post comment to the PR, error: ${err.message}`);
  }
}

/**
 * Checks if the action is running in a pull request context.
 *
 * @returns {boolean} True if running in PR, false otherwise
 */
export function runningInPullRequest() {
  return config.allowedGitHubEvents.includes(github.context.eventName);
}

/**
 * Posts a message to the summary section of the GitHub workflow run.
 *
 * @param {string} message - The message to post to the summary
 */
export async function postToSummary(message) {
  // remember current summary buffer content
  const summaryBuffer = core.summary.stringify();
  await core.summary.emptyBuffer().addRaw(message).write();
  // restore summary buffer
  core.summary.emptyBuffer().addRaw(summaryBuffer);
}

/**
 * Initializes an Octokit client if conditions are met.
 *
 * @returns {Octokit} The Octokit instance, or undefined if not initialized
 */
export function getOctokit() {
  if (inputs.gitHubToken && runningInPullRequest()) {
    return github.getOctokit(inputs.gitHubToken);
  }
}

/**
 * Reports code coverage results.
 *
 * @param {number} totalCoverages - The total code coverage percentage
 * @param {Object} octokit - Octokit SDK instance for GitHub API access
 */
export async function reportCoverages(totalCoverages, octokit) {
  const body = buildMessageBody(totalCoverages);
  if (octokit && shouldCommentOnPr()) {
    commentOnPR({
      octokit,
      updateComment: inputs.updateComment,
      body,
    });
  }
  postToSummary(body);
}

/**
 * Uploads an HTML report file as a build artifact.
 *
 * @param {string} artifactName - The name to give the artifact
 * @param {string} htmlReportFile - Path to the HTML report file to upload
 * @param {string} tmpDir - The temp directory containing report
 * @returns {Promise<void>}
 */
export async function uploadHTMLReport(artifactName, htmlReportFile, tmpDir) {
  if (artifactName && htmlReportFile && tmpDir) {
    artifact.create().uploadArtifact(artifactName, [htmlReportFile], tmpDir, { continueOnError: false });
  }
}

/**
 * Returns current workflow URL.
 *
 * @returns {string} The workflow URL
 */
export function workflowUrl() {
  return config.workflowUrl
    .replace('{project}', github.context.repo.repo)
    .replace('{runId}', github.context.runId.toString())
    .replace('{attemptId}', process.env.GITHUB_RUN_ATTEMPT ?? '1');
}
