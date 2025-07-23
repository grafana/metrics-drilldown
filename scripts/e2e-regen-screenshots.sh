#!/bin/bash

GRAFANA_VERSIONS=("12.0.2" "11.6.3")
PLAYWRIGHT_FILTERS=$1

if [ -n "$PLAYWRIGHT_FILTERS" ]; then
  PLAYWRIGHT_ARGS="$PLAYWRIGHT_FILTERS -u"
else
  PLAYWRIGHT_ARGS="-u all"
fi

overall_success=true

for grafana_version in "${GRAFANA_VERSIONS[@]}"; do
  echo -e "\n🧪 Updating E2E screenshots for Grafana v$grafana_version..."
  
  GRAFANA_VERSION="$grafana_version" PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" DEBUG="pw*" npm run e2e:ci
  exit_code=$?
  
  if [ $exit_code -ne 0 ]; then
    echo "❌ E2E tests failed for Grafana v$grafana_version (exit code: $exit_code)"
    overall_success=false
  else
    echo "✅ E2E tests completed successfully for Grafana v$grafana_version"
  fi
done

if [ "$overall_success" = true ]; then
    echo -e "\n🎉 All E2E screenshot updates completed successfully!"
    exit 0
else
    echo -e "\nSome E2E tests failed. All the E2E screenshots may not have been updated. Check the output above for details."
    exit 1
fi
