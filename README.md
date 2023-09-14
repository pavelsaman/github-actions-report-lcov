# Report code coverage

This GitHub Action reports code coverage from LCOV files. This action includes:

- failing if a minimum coverage is not met
- commenting on a pull request
- commenting on the summary page
- generating an HTML report as an artifact

[![Test and Build](https://github.com/sli-do/action-report-lcov/actions/workflows/test-and-build.yml/badge.svg?branch=main)](https://github.com/sli-do/action-report-lcov/actions/workflows/test-and-build.yml)

## Usage

### Inputs

- `coverage-files` (required): Coverage files to scan (e.g. `coverage/lcov.*.info`).
- `artifact-name` (optional): Name of generated coverage report artifact. Default is no artifact created.
- `minimum-line-coverage` (optional): Minimum % coverage to pass check. Default `0`.
- `minimum-branch-coverage` (optional): Minimum % coverage to pass check. Default `0`.
- `minimum-function-coverage` (optional): Minimum % coverage to pass check. Default `0`.
- `github-token` (optional): GitHub token to comment on PR.
- `working-directory` (optional): Directory containing source files. Default `./`.
- `update-comment` (optional): Whether to update existing comment. Default `false`.
- `install-lcov` (optional): Whether lcov should be installed by this action. Default `true`.
- `comment-on-pr` (optional): Whether to create a comment in PR. Default `true`.

### Outputs

- `total-line-coverage`: Total line coverage.
- `total-branch-coverage`: Total branch coverage.
- `total-function-coverage`: Total function coverage.
- `merged-lcov-file`: Path to merged LCOV file.

### Example usage

```yaml
jobs:
  coverage_report:
    name: Generate coverage report
    needs: test-job
    # Linux and macOS runners are supported
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # if running on Windows, please install `lcov` here

      - name: Report code coverage
        uses: pavelsaman/github-actions-report-lcov@v5
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          coverage-files: coverage/lcov.*.info
          minimum-line-coverage: 90
          minimum-branch-coverage: 90
          minimum-function-coverage: 90
          update-comment: 'true'
```

### Limitations

The action works out of the box with Linux and macOS runners. If you want to use it on Windows runners, please install `lcov` before running this action in a workflow.

## Contribution

Initial setup:

```bash
nvm use
make install
```

After source code changes, format, lint, and build the project with:

```bash
make build
```

Then push to remote.
Then create a new tag or move the latest tag.
You can use [Create new version](https://github.com/sli-do/action-report-lcov/actions/workflows/create-new-version.yml) workflow for creating a new version.
