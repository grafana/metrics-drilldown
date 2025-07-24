#!/bin/bash

# parse Grafana versions and images
PARSED_VERSIONS=($(node -e "
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, './e2e/config/grafana-versions-supported.ts'), 'utf8');
const objectMatches = content.match(/\{ image: '[^']+', version: '[^']+' \}/g);
if (objectMatches) {
  objectMatches.forEach((m) => {
    const [, image] = m.match(/image: '([^']+)'/);
    const [, version] = m.match(/version: '([^']+)'/);
    console.log(image + ':' + version);
  });
} else {
  console.error('Could not find image/version objects!');
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

for entry in "${PARSED_VERSIONS[@]}"; do
  IFS=':' read -r image version <<< "$entry"
  GRAFANA_IMAGES+=("$image")
  GRAFANA_VERSIONS+=("$version")
done

# get args to pass to Playwright
PLAYWRIGHT_FILTERS=$1


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
  
  GRAFANA_IMAGE="$grafana_image" GRAFANA_VERSION="$grafana_version" PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" npm run e2e:ci
  exit_code=$?
  
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
