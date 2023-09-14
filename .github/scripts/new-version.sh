#!/usr/bin/env bash

set -euo pipefail

function increment_version() {
  local latest_tag="$1"
  latest_tag_number="$(tr -d 'v' <<< "$latest_tag")"
  if [[ "$latest_tag_number" =~ \. ]]; then
    # in case of tags with dots, consider only the last part
    latest_tag_number="$(awk -F'.' '{ print $NF }' <<<"$latest_tag_number")"
  fi
  echo "v$((latest_tag_number+1))"
}

function delete_latest_tag_or_create_new() {
  local latest_tag="$1"
  local move_latest_tag="$2"

  if [[ "$move_latest_tag" == "true" ]]; then
    git tag --delete "$latest_tag" >/dev/null
    git push --delete origin "$latest_tag" >/dev/null
    new_version="$latest_tag"
  else
    new_version="$(increment_version "$latest_tag")"
  fi

  echo "$new_version"
}

function main() {
  ref="$1"
  move_latest_tag="$2"

  if [[ -z "$ref" ]]; then
    ref="$(git rev-parse HEAD)"
  fi

  latest_tag="$(git tag --list --sort=-version:refname v* | head -1)"
  if [[ -z "$latest_tag" ]]; then
    latest_tag=v1
    new_version=v1
    latest_tag_ref=-
  else
    latest_tag_ref="$(git rev-parse "$latest_tag")"
  fi

  if [[ "$latest_tag" != "v1" ]]; then
    new_version="$(delete_latest_tag_or_create_new "$latest_tag" "$move_latest_tag")"
  fi

  git tag "$new_version" "$ref"
  git push --tags

  {
    echo "previous version: $latest_tag on ref: $latest_tag_ref"
    echo "new version: $new_version on ref: $ref"
  } >> "$GITHUB_STEP_SUMMARY"
}

main "$@"
