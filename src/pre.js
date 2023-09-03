import * as core from '@actions/core';
import { execSync } from 'child_process';
import { config, inputs } from './config';

function run() {
  try {
    if (inputs.installLcov) {
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
    } else {
      console.log('lcov already installed, doing nothing');
    }
  } catch (error) {
    core.setFailed(`${config.action_msg_prefix} ${error.message}`);
  }
}

run();
