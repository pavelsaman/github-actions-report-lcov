import*as o from"@actions/core";import*as l from"@actions/github";import p from"lcov-total";import{config as n,inputs as e}from"./config";import{commentOnPR as u}from"./github";import{listFiles as d}from"./utils";import{mergeCoverages as f,detail as v,summarize as C,generateHTMLAndUpload as w}from"./lcov";import{createTempDir as b,roundToOneDecimalPlace as h,runningInPullRequest as k,buildHeader as F,buildMessageBody as P}from"./utils";async function $(){const r=await d(e.coverageFilesPattern);r.length||(o.error(`${n.action_msg_prefix} no coverage lcov files found with pattern ${e.coverageFilesPattern}`),process.exit(1));const m=b();try{const t=await f(r,m),i=h(p(t)),s=`Code coverage: **${i}** %. Expected at least **${e.minimumCoverage}** %.`,a=i>=e.minimumCoverage;if(e.gitHubToken&&k()){const c=l.getOctokit(e.gitHubToken),g=P({header:F(a),summary:await C(t),details:await v(t,c),isMinimumCoverageReached:a,errorMessage:s});u({octokit:c,updateComment:e.updateComment,body:g})}else o.warning(`${n.action_msg_prefix} no github-token provided or not running in a PR workflow. Skipping creating a PR comment.`);e.artifactName&&w(r,e.artifactName,m),o.setOutput("total-coverage",i),a||o.setFailed(s.replace(/\*/g,""))}catch(t){o.setFailed(`${n.action_msg_prefix} ${t.message}`)}}$();
//# sourceMappingURL=index.js.map
