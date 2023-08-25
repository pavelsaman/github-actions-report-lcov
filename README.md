# Report code coverage

This GitHub Action allows you to report code coverage from LCOV files. This action includes:

- generating an HTML report as an artifact
- commenting on a pull request
- failing if a minimum coverage is not met

## Usage

### Inputs

- `coverage-files`: The coverage files to scan. For example: `coverage/lcov.*.info`.
- `artifact-name`: The GitHub artifact name of the generated HTML report. For example: `code-coverage-report`. Optional. Default: `` (Do not create a HTML report and do not upload anything.)
- `minimum-coverage`: The minimum coverage to pass the check. Optional. Default: `0`.
- `github-token`: GitHub token to be able to comment on a PR. Optional.
- `working-directory`: The working directory containing the source files referenced in the LCOV files. Optional. Default: `./`
- `additional-message`: Custom text appended to the code coverage comment. Optional. Default: ``.
- `update-comment`: Set to `true` to update the previous code coverage comment if such exists. When set to `false`, a new comment is always created. Optional. Default: `false`.
- `list-full-paths`: Whether to list full paths of files reported in changed files detailed section. Long filenames may not fit on GitHub PR page. Optional. Default: `true`.

### Outputs

- `total-coverage`: total coverage from scanned files rounded to 1 decimal place

### Example usage

```yaml
jobs:
  coverage_report:
    name: Generate coverage report
    needs: test-job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Report code coverage
        uses: pavelsaman/github-actions-report-lcov@v4
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          coverage-files: coverage/lcov.*.info
          minimum-coverage: 90
          update-comment: 'true'
```

**Note**: Only the `pull_request` and `pull_request_target` events are supported. This action does nothing when triggered by other event types.

## Example comments

![screenshot](assets/comment-ok.png)
![screenshot](assets/comment-failure.png)
