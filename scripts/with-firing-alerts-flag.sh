#!/usr/bin/env bash
#
# Starts the dev server with the firing alerts feature flag enabled.
# Patches evaluateFeatureFlag to bypass the OpenFeature provider
# (which returns false for unknown flags locally) and return true
# for the firing alerts flag. Restores the file on exit.
#
set -euo pipefail

FLAG_FILE="src/shared/featureFlags/openFeature.ts"
FLAG_NAME="drilldown.metrics.sort_by_firing_alerts"

cleanup() {
  git checkout -- "$FLAG_FILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! grep -q "$FLAG_NAME" "$FLAG_FILE"; then
  echo "Error: Could not find $FLAG_NAME in $FLAG_FILE"
  exit 1
fi

# Inject an early return at the top of evaluateFeatureFlag that returns
# defaultValue directly, bypassing the OpenFeature provider.
sed -i '/^export async function evaluateFeatureFlag/a\  return goffFeatureFlags[flagName].defaultValue as FlagValue<T>;' "$FLAG_FILE"

# Set the firing alerts flag default to true
sed -i "/$FLAG_NAME/,/defaultValue:/{s/defaultValue: false/defaultValue: true/}" "$FLAG_FILE"

echo "✓ Enabled $FLAG_NAME (bypassing OpenFeature provider)"

docker compose up --build
