import * as glob from '@actions/glob';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { config } from '../config';
import fs from 'fs';

export async function listFiles(path) {
  const globber = await glob.create(path, { followSymbolicLinks: false, matchDirectories: false });
  return await globber.glob();
}

export function buildHeader(isMinimumCoverageReached, sha) {
  return `## ${isMinimumCoverageReached ? '' : ':no_entry:'} Code coverage of commit [<code>${sha.short}</code>](${
    github.context.payload.pull_request.number
  }/commits/${sha.full})\n\n`;
}

export function buildMessageBody(params) {
  const { header, summary, details, isMinimumCoverageReached, errorMessage } = params;

  return `${header}<pre>${summary}\n\nChanged files coverage rate: ${details}</pre>\n\n${
    isMinimumCoverageReached ? '' : `:no_entry: ${errorMessage}`
  }`;
}

export function runningInPullRequest() {
  const allowedGitHubEvents = ['pull_request', 'pull_request_target'];
  return allowedGitHubEvents.includes(github.context.eventName);
}

export function roundToOneDecimalPlace(num) {
  return Math.round(num * 10) / 10;
}

export function createTempDir() {
  try {
    const tmpPath = `${process.env.GITHUB_WORKSPACE}/lcov-tmp-dir`;
    fs.mkdirSync(tmpPath);
    return tmpPath;
  } catch (error) {
    core.error(`${config.action_msg_prefix} creating a temp dir failed with: ${error.message}`);
    process.exit(1);
  }
}
