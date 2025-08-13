#!/bin/bash

if [ $# -eq 0 ]; then
  echo "Deleting all E2E screenshots..."
  search_pattern="*.png"
else
  version_arg="$1"
  echo "Deleting E2E screenshots of Grafana 'v$version_arg'..."
  version_pattern="${version_arg//./-}"
  search_pattern="${version_pattern}-*.png"
fi

deleted_count=$(find ./e2e/tests -name "$search_pattern" -type f | wc -l | xargs)

find ./e2e/tests -name "$search_pattern" -type f -delete


if [ "$deleted_count" -eq 0 ]; then
  echo -e "No screenshots found."
else
  echo -e "🗑️  $deleted_count screenshots successfully deleted!"
fi