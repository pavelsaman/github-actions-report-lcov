import * as core from '@actions/core';
import { execSync } from 'child_process';
import { config } from './config';

function run() {
  try {
    console.log('Installing lcov');

    const platform = process.env.RUNNER_OS;
    if (platform === 'Linux') {
      execSync('sudo apt-get update');
      execSync('sudo apt-get install --assume-yes lcov');
    } else if (platform === 'macOS') {
      execSync('brew install lcov');
    }

    const lcovVersion = execSync('lcov --version', { encoding: 'utf-8' });
    console.log(lcovVersion);
  } catch (error) {
    core.setFailed(`${config.action_msg_prefix} ${error.message}`);
  }
}

run();
