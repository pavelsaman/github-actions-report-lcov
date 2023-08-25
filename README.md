# Report code coverage

This GitHub Action allows you to report code coverage from LCOV files. This action includes:

- generating an HTML report as an artifact
- commenting on a pull request
- failing if a minimum coverage is not met

## Usage

### Inputs

- `coverage-files` (required): Coverage files to scan (e.g. `coverage/lcov.*.info`)
- `artifact-name` (optional): Name of generated coverage report artifact. Default is no artifact created.
- `minimum-coverage` (optional): Minimum % coverage to pass check. Default `0`.
- `github-token` (optional): GitHub token to comment on PR.
- `working-directory` (optional): Directory containing source files. Default `./`
- `additional-message` (optional): Custom text appended to comment.
- `update-comment` (optional): Whether to update existing comment. Default `false`.
- `list-full-paths` (optional): Whether to list full file paths in details. Default `true`.

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
