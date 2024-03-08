import { execSync } from 'child_process';
import * as path from 'path';
import * as exec from '@actions/exec';
import { config, inputs } from '../config';

/**
 * Generates an HTML coverage report from a LCOV coverage file.
 *
 * @param {string} artifactName - The name to give the artifact
 * @param {string} mergedCoverageFile - Path to the merged LCOV coverage file
 * @param {string} tmpDir - The temp directory containing report
 * @returns {Promise<{htmlReportFile: string, htmlReportDir: string}>}
 */
export async function generateHTMLReport(artifactName, mergedCoverageFile, tmpDir) {
  if (!artifactName) {
    return {};
  }

  const htmlReportDir = 'html';
  const artifactPath = path.join(tmpDir, htmlReportDir);

  const args = [
    mergedCoverageFile,
    ...config.common_lcov_args,
    '--output-directory',
    artifactPath,
    '--prefix',
    process.env.GITHUB_WORKSPACE,
  ];

  await exec.exec('genhtml', args);
  const tarArchiveName = await createArchive(htmlReportDir, tmpDir);

  return {
    htmlReportFile: path.join(tmpDir, tarArchiveName),
    htmlReportDir: artifactPath,
  };
}

/**
 * Creates a tar archive of the given directory.
 *
 * @param {string} dirToArchive - The directory to archive
 * @param {string} cwd - The current working directory to run the command from
 * @returns {Promise<string>} The name of the created archive file
 */
async function createArchive(dirToArchive, cwd) {
  await exec.exec('tar', ['czf', config.tarArchiveName, dirToArchive], { cwd });
  return config.tarArchiveName;
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
 * Installs lcov code coverage tool if needed.
 *
 * Throws on error.
 */
export function installLcovIfNeeded() {
  if (!inputs.installLcov) {
    return;
  }

  try {
    console.log('Installing lcov');

    const platform = process.env.RUNNER_OS;
    if (platform === 'Linux') {
      execSync('sudo apt-get update');
      execSync('sudo apt-get install --assume-yes lcov');
    } else if (platform === 'macOS') {
      execSync('brew install lcov');
    } else {
      console.log('Unsupported platform. Lcov not installed.');
    }
  } catch (error) {
    throw new Error(`${config.action_msg_prefix} ${error.message}`);
  }
}

/**
 * Prints lcov version to console.
 */
export function printLcovVersion() {
  console.log(execSync('lcov --version', { encoding: 'utf-8' }));
}
