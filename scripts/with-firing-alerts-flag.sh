#!/usr/bin/env bash
#
# Starts the dev server with the firing alerts feature flag enabled.
# Uses GF_FEATURE_TOGGLES_ENABLE to set the metricsExploreFireAlerts
# toggle, which evaluateFeatureFlag checks before consulting GoFF.
#
# No source files are modified.
#
set -euo pipefail

export GF_FEATURE_TOGGLES_ENABLE="${GF_FEATURE_TOGGLES_ENABLE:+${GF_FEATURE_TOGGLES_ENABLE},}metricsExploreFireAlerts"

echo "✓ Enabled metricsExploreFireAlerts via GF_FEATURE_TOGGLES_ENABLE"

docker compose up --build
