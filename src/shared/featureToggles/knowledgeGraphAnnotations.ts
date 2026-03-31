import { config } from '@grafana/runtime';

const FEATURE_TOGGLE_NAME = 'kgAnnotationsInMetricsDrilldown';

export function isKnowledgeGraphAnnotationsEnabled(): boolean {
  return Boolean(FEATURE_TOGGLE_NAME in config.featureToggles && config.featureToggles[FEATURE_TOGGLE_NAME]);
}
