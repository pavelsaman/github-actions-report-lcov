import * as github from '@actions/github';

/**
 * Gets existing coverage comment on pull request.
 *
 * @param {Object} octokitInstance - Octokit instance
 * @returns {Promise<Object|undefined>} The existing comment object
 */
async function getExistingPullRequestComment(octokitInstance) {
  const issueComments = await octokitInstance.rest.issues.listComments({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    issue_number: github.context.payload.pull_request.number,
  });

  return issueComments.data.find((comment) => comment.body.includes('Code coverage'));
}

/**
 * Gets commit SHA information.
 *
 * @returns {{full: string, short: string}} The commit object with full and short SHA
 */
export function sha() {
  const full = github.context.payload.pull_request.head.sha;
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
  const listFilesOptions = octokitInstance.rest.pulls.listFiles.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: github.context.payload.pull_request.number,
  });
  const listFilesResponse = await octokitInstance.paginate(listFilesOptions);
  return listFilesResponse.map((file) => file.filename);
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
  const prAction = shouldUpdateComment
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

  prAction(data);
}
