import * as core from '@actions/core';
import totalCoverage from 'total-coverage';
import { inputs } from './config';
import { getCoverageFiles, setCoverageOutputs } from './coverage';
import { getChangedFilenames, getOctokit, reportCoverages, uploadHTMLReport } from './github';
import { generateHTMLReport, installLcovIfNeeded, mergeCoverages, printLcovVersion } from './lcov';
import { createTempDir } from './utils';

async function main() {
  try {
    installLcovIfNeeded();
  } catch (err) {
    core.error(err.message);
    process.exit(core.ExitCode.Failure);
  }
  printLcovVersion();

  const octokit = getOctokit();

  let tmpDir;
  try {
    tmpDir = createTempDir();
  } catch (err) {
    core.error(err.message);
    process.exit(core.ExitCode.Failure);
  }
  const mergedCoverageFile = await mergeCoverages(await getCoverageFiles(), tmpDir);

  const totalCoverages = totalCoverage(mergedCoverageFile, await getChangedFilenames(octokit));
  reportCoverages(totalCoverages, octokit);

  const { htmlReportFile, htmlReportDir } = await generateHTMLReport(inputs.artifactName, mergedCoverageFile, tmpDir);
  uploadHTMLReport(inputs.artifactName, htmlReportFile, tmpDir);

  setCoverageOutputs({ totalCoverages, mergedCoverageFile, htmlReportFile, htmlReportDir });
}

main();
