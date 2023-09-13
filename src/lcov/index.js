import * as path from 'path';
import * as artifact from '@actions/artifact';
import * as exec from '@actions/exec';
import { config, inputs } from '../config';
import { listFiles } from '../utils';

/**
 * Generates HTML coverage report and uploads artifact
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
 * Merges coverage data files into a single file
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
