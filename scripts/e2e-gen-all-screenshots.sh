#!/bin/bash

# parse command line arguments
SPECIFIED_VERSIONS=()
PLAYWRIGHT_FILTERS=""

while [[ $# -gt 0 ]]; do
  case $1 in
  --grafana-version)
    SPECIFIED_VERSIONS+=("$2")
    shift 2
    ;;
  *)
    PLAYWRIGHT_FILTERS="$1"
    shift
    ;;
  esac
done

# parse Grafana versions and images
# TODO: automate (see https://github.com/grafana/plugin-actions/blob/main/e2e-version/README.md)
PARSED_VERSIONS=($(node -e "
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, './e2e/config/grafana-versions-supported.ts'), 'utf8');
const objectMatches = content.match(/(?<!^[\s]*\/\/.*)(\{ name: '[^']+', version: '[^']+' \})/gm);
if (objectMatches) {
  objectMatches.forEach((m) => {
    const [, name] = m.match(/name: '([^']+)'/);
    const [, version] = m.match(/version: '([^']+)'/);
    console.log(name + ':' + version);
  });
} else {
  console.error('Could not find name/version objects!');
  process.exit(1);
}
"))

if [ ${#PARSED_VERSIONS[@]} -eq 0 ]; then
  echo -e "\n❌ Error: No Grafana versions found in e2e/config/grafana-versions-supported.ts"
  echo "Please ensure the file exists and contains valid GRAFANA_VERSIONS_SUPPORTED entries."
  exit 1
fi

GRAFANA_VERSIONS=()
GRAFANA_IMAGES=()

# filter versions if --grafana-version flag(s) provided
if [ ${#SPECIFIED_VERSIONS[@]} -gt 0 ]; then
  echo -e "\nFiltering for specified Grafana version(s): ${SPECIFIED_VERSIONS[*]}"
  for entry in "${PARSED_VERSIONS[@]}"; do
    IFS=':' read -r image version <<<"$entry"
    for specified in "${SPECIFIED_VERSIONS[@]}"; do
      if [ "$version" = "$specified" ]; then
        GRAFANA_IMAGES+=("$image")
        GRAFANA_VERSIONS+=("$version")
        break
      fi
    done
  done

  if [ ${#GRAFANA_VERSIONS[@]} -eq 0 ]; then
    echo -e "\n❌ Error: None of the specified versions found in supported versions"
    echo "Specified: ${SPECIFIED_VERSIONS[*]}"
    exit 1
  fi
else
  for entry in "${PARSED_VERSIONS[@]}"; do
    IFS=':' read -r image version <<<"$entry"
    GRAFANA_IMAGES+=("$image")
    GRAFANA_VERSIONS+=("$version")
  done
fi

echo -e "\nWill update screenshots for the following Grafana versions:"
for i in "${!GRAFANA_VERSIONS[@]}"; do
  echo "  - '${GRAFANA_IMAGES[$i]}' v${GRAFANA_VERSIONS[$i]}"
done

# get args to pass to Playwright
if [ -n "$PLAYWRIGHT_FILTERS" ]; then
  PLAYWRIGHT_ARGS="-u all $PLAYWRIGHT_FILTERS"
else
  PLAYWRIGHT_ARGS="-u all"
fi

# loop and update screenshots
overall_success=true

for i in "${!GRAFANA_VERSIONS[@]}"; do
  grafana_version="${GRAFANA_VERSIONS[$i]}"
  grafana_image="${GRAFANA_IMAGES[$i]}"

  echo -e "\n🧪 Updating E2E screenshots for '$grafana_image v$grafana_version'..."

  # start the e2e server
  echo -e "\n🚀 Starting E2E server..."
  GRAFANA_IMAGE="$grafana_image" GRAFANA_VERSION="$grafana_version" npm run e2e:server:up

  # wait for Grafana to be ready
  echo -e "\n⏳ Waiting for Grafana to be ready..."
  ./scripts/wait-for-grafana.sh "http://localhost:3001/api/health" 200 120 2
  wait_exit_code=$?

  if [ $wait_exit_code -ne 0 ]; then
    echo -e "\n❌ Grafana failed to start for '$grafana_image v$grafana_version'"
    npm run e2e:server:down
    overall_success=false
    continue
  fi

  # run the e2e tests
  GRAFANA_VERSION="$grafana_version" GRAFANA_PORT="3001" GRAFANA_SCOPES_PORT="3002" PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" npm run e2e
  exit_code=$?

  # stop the e2e server
  echo -e "\n🛑 Stopping E2E server..."
  npm run e2e:server:down

  if [ $exit_code -ne 0 ]; then
    echo -e "\n❌ E2E tests failed for '$grafana_image v$grafana_version' (exit code: $exit_code)"
    overall_success=false
  else
    echo -e "\n✅ E2E tests completed successfully for '$grafana_image v$grafana_version'"
  fi
done

# done, report overall status
if [ "$overall_success" = true ]; then
  echo -e "\n🎉 All E2E screenshot updates completed successfully!"
  exit 0
else
  echo -e "\n❌ Some E2E tests failed. All the E2E screenshots may not have been updated. Check the output above for details."
  exit 1
fi
