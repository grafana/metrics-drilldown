#!/bin/bash

# parse command line arguments
SPECIFIED_VERSIONS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --grafana-version)
      SPECIFIED_VERSIONS+=("$2")
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--grafana-version VERSION] [--grafana-version VERSION ...]"
      exit 1
      ;;
  esac
done

if [ ${#SPECIFIED_VERSIONS[@]} -eq 0 ]; then
  echo "Deleting all E2E screenshots..."
  search_pattern="*.png"

  deleted_count=$(find ./e2e/tests -name "$search_pattern" -type f | wc -l | xargs)
  find ./e2e/tests -name "$search_pattern" -type f -delete

  if [ "$deleted_count" -eq 0 ]; then
    echo -e "No screenshots found."
  else
    echo -e "🗑️  $deleted_count screenshots successfully deleted!"
  fi
else
  echo "Deleting E2E screenshots for Grafana version(s): ${SPECIFIED_VERSIONS[*]}"
  total_deleted=0

  for version in "${SPECIFIED_VERSIONS[@]}"; do
    version_pattern="${version//./-}"
    search_pattern="${version_pattern}-*.png"

    deleted_count=$(find ./e2e/tests -name "$search_pattern" -type f | wc -l | xargs)
    find ./e2e/tests -name "$search_pattern" -type f -delete

    echo "  v$version: $deleted_count screenshot(s) deleted"
    total_deleted=$((total_deleted + deleted_count))
  done

  if [ "$total_deleted" -eq 0 ]; then
    echo -e "\nNo screenshots found for specified version(s)."
  else
    echo -e "\n🗑️  $total_deleted total screenshot(s) successfully deleted!"
  fi
fi
