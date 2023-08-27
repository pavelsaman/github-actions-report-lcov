import * as github from '@actions/github';

async function getExistingPullRequestComment(octokitInstance) {
  const issueComments = await octokitInstance.rest.issues.listComments({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    issue_number: github.context.payload.pull_request.number,
  });

  return issueComments.data.find((comment) => comment.body.includes('Code coverage'));
}

export function sha() {
  const full = github.context.payload.pull_request.head.sha;
  return {
    full,
    short: full.substr(0, 7),
  };
}

export async function getChangedFilenames(octokitInstance) {
  const listFilesOptions = octokitInstance.rest.pulls.listFiles.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: github.context.payload.pull_request.number,
  });
  const listFilesResponse = await octokitInstance.paginate(listFilesOptions);
  return listFilesResponse.map((file) => file.filename);
}

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
