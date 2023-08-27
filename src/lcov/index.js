import * as artifact from '@actions/artifact';
import * as exec from '@actions/exec';
import * as path from 'path';
import { config, inputs } from '../config';
import { listFiles } from '../utils';

function lineRefersToChangedFile(lineWithFilename, changedFiles) {
  return changedFiles.some((changedFile) => lineWithFilename.startsWith(changedFile));
}

export async function generateHTMLAndUpload(coverageFiles, artifactName, tmpPath) {
  const artifactPath = path.resolve(tmpPath, 'html').trim();

  const args = [...coverageFiles, ...config.common_lcov_args, '--output-directory', artifactPath];
  await exec.exec('genhtml', args, { cwd: inputs.workingDirectory });

  const htmlFiles = await listFiles(`${artifactPath}/**`);
  artifact.create().uploadArtifact(artifactName, htmlFiles, artifactPath, { continueOnError: false });
}

export async function mergeCoverages(coverageFiles, tmpPath) {
  const mergedCoverageFile = `${tmpPath}/merged-lcov.info`;

  const args = coverageFiles.flatMap((coverageFile) => ['--add-tracefile', coverageFile]);
  args.push('--output-file', mergedCoverageFile);

  await exec.exec('lcov', [...args, ...config.common_lcov_args]);

  return mergedCoverageFile;
}

export async function summarize(mergedCoverageFile) {
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

  await exec.exec('lcov', ['--summary', mergedCoverageFile, ...config.common_lcov_args], options);

  const lines = output.trim().split(config.newline);
  lines.shift(); // remove debug info
  return lines.join('\n');
}

export async function detail(coverageFile, changedFiles) {
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

  const args = inputs.listFullPaths ? ['--list-full-path'] : [];
  await exec.exec('lcov', ['--list', coverageFile, ...args, ...config.common_lcov_args], options);

  let lines = output.trim().split(config.newline);
  // remove debug info
  lines.shift();
  lines.pop();
  lines.pop();

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
