import * as path from 'path';
import * as artifact from '@actions/artifact';
import * as exec from '@actions/exec';
import { config } from '../config';

/**
 * Generates HTML coverage report and uploads artifact
 *
 * @param {string} mergedCoverageFile - Merged LCOV file path
 * @param {string} artifactName - Name of artifact
 * @param {string} tmpPath - Temp directory path
 */
export async function generateHTMLAndUpload(mergedCoverageFile, artifactName, tmpPath) {
  const htmlReportDir = 'html';
  const artifactPath = path.join(tmpPath, htmlReportDir);

  const args = [
    mergedCoverageFile,
    ...config.common_lcov_args,
    '--output-directory',
    artifactPath,
    '--prefix',
    process.env.GITHUB_WORKSPACE,
  ];

  const tarFile = 'coverage-report.tar.gz';
  await exec.exec('genhtml', args);
  await exec.exec('tar', ['czf', tarFile, htmlReportDir], { cwd: tmpPath });

  artifact.create().uploadArtifact(artifactName, [path.join(tmpPath, tarFile)], tmpPath, { continueOnError: false });
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
