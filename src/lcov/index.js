import * as artifact from '@actions/artifact';
import * as exec from '@actions/exec';
import * as path from 'path';
import { config, inputs } from '../config';
import { listFiles } from '../utils';

/**
 * Checks if a line refers to a changed file.
 *
 * @param {string} lineWithFilename - The line containing a filename
 * @param {string[]} changedFiles - List of changed file paths
 * @returns {boolean} True if line refers to changed file
 */
function lineRefersToChangedFile(lineWithFilename, changedFiles) {
  return changedFiles.some((changedFile) => lineWithFilename.startsWith(changedFile));
}

/**
 * Checks if the last directory is not present in output lines.
 *
 * @param {string} dir - The directory path to check for
 * @param {string[]} output - Array of output lines
 * @returns {boolean} True if dir is not found in output, false otherwise
 */
function lastDirNotInOutput(dir, output) {
  return !output.some((outputLine) => outputLine === dir);
}

/**
 * Get the directory name from a line if present.
 *
 * @param {string} line - The input line to parse
 * @returns {string|undefined} The directory name if there could be directory names and the line starts with '[', otherwise undefined
 */
function getDirectory(line) {
  if (!inputs.listFullPaths && line.startsWith('[')) {
    return line.replace(/[[\]]/g, '');
  }
  return undefined;
}

/**
 * Generates HTML coverage report and uploads artifact.
 *
 * @param {string[]} coverageFiles - List of coverage files
 * @param {string} artifactName - Name of artifact
 * @param {string} tmpPath - Temp directory path
 */
export async function generateHTMLAndUpload(coverageFiles, artifactName, tmpPath) {
  const artifactPath = path.resolve(tmpPath, 'html').trim();

  const args = [...coverageFiles, ...config.common_lcov_args, '--output-directory', artifactPath];
  await exec.exec('genhtml', args, { cwd: inputs.workingDirectory });

  const htmlFiles = await listFiles(`${artifactPath}/**`);
  artifact.create().uploadArtifact(artifactName, htmlFiles, artifactPath, { continueOnError: false });
}

/**
 * Merges coverage data files into a single file.
 *
 * @param {string[]} coverageFiles - List of coverage files
 * @param {string} tmpPath - Temp directory path
 * @returns {Promise<string>} Path to merged coverage file
 */
export async function mergeCoverages(coverageFiles, tmpPath) {
  const mergedCoverageFile = path.join(tmpPath, 'merged-lcov.info');

  const args = coverageFiles.flatMap((coverageFile) => ['--add-tracefile', coverageFile]);
  args.push('--output-file', mergedCoverageFile);

  await exec.exec('lcov', [...args, ...config.common_lcov_args]);

  return mergedCoverageFile;
}

/**
 * Generates a coverage summary from a merged coverage file.
 *
 * @param {string} mergedCoverageFile - Path to merged coverage file
 * @returns {Promise<string>} The coverage summary
 */
export async function summarize(mergedCoverageFile) {
  let output = '';
  const options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  };

  await exec.exec('lcov', ['--summary', mergedCoverageFile, ...config.common_lcov_args], options);

  const lines = output.trim().split(config.newline);
  lines.shift(); // remove debug info
  return lines.join('\n');
}

/**
 * Generates detailed coverage info for changed files.
 *
 * @param {string} coverageFile - Path to coverage file
 * @param {string[]} changedFiles - List of changed files
 * @returns {Promise<string>} The detailed coverage info
 */
export async function detail(coverageFile, changedFiles) {
  let output = '';
  const options = {
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  };

  const args = inputs.listFullPaths ? ['--list-full-path'] : [];
  await exec.exec('lcov', ['--list', coverageFile, ...args, ...config.common_lcov_args], options);

  const lines = output.trim().split(config.newline);
  // remove debug info
  lines.shift();
  lines.pop();
  lines.pop();

  const headerLines = lines.slice(0, 3);
  const contentLines = [];
  let currectDirectory = '';
  for (const line of lines.slice(3)) {
    const directory = getDirectory(line);
    if (directory) {
      currectDirectory = directory;
    }
    if (lineRefersToChangedFile(path.join(currectDirectory, line), changedFiles)) {
      if (lastDirNotInOutput(`[${currectDirectory}]`, contentLines)) {
        contentLines.push(`[${currectDirectory}]`);
      }
      contentLines.push(line);
    }
  }
  const finalLines = [...headerLines, ...contentLines];

  const onlyHeaderRemains = finalLines.length === 3;
  return onlyHeaderRemains ? 'n/a' : `\n  ${finalLines.join('\n  ')}`;
}
