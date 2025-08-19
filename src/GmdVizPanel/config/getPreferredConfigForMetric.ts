import { AVAILABLE_PANEL_TYPES } from 'GmdVizPanel/types/available-panel-types';
import { reportExploreMetrics } from 'interactions';
import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userPreferences } from 'UserPreferences/userPreferences';
import { displayWarning } from 'WingmanDataTrail/helpers/displayStatus';

import { CONFIG_PRESETS, type PanelConfigPreset } from './presets/types';
import { PROMQL_FUNCTIONS } from './promql-functions';

const availableConfigPresetIds = new Set<string>(Object.values(CONFIG_PRESETS));
const availablePanelTypes = new Set<string>(AVAILABLE_PANEL_TYPES);

export function getPreferredConfigForMetric(metric: string): PanelConfigPreset | undefined {
  const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS) || {};
  const metricConfig = userPrefs[metric]?.config;

  if (!metricConfig) {
    return undefined;
  }

  if (!isValid(metricConfig)) {
    reportExploreMetrics('invalid_metric_config', { metricConfig });

    delete userPrefs[metric]?.config;
    userPreferences.setItem(PREF_KEYS.METRIC_PREFS, userPrefs);

    displayWarning([
      `Invalid configuration found for metric ${metric}!`,
      'The configuration has been deleted and will not be applied.',
    ]);

    return undefined;
  }

  return metricConfig;
}

/* eslint-disable sonarjs/prefer-single-boolean-return */
export function isValid(metricConfig: PanelConfigPreset): boolean {
  if (!['id', 'panelOptions', 'queryOptions'].every((key) => key in metricConfig)) {
    return false;
  }

  if (typeof metricConfig.id !== 'string' || !availableConfigPresetIds.has(metricConfig.id)) {
    return false;
  }

  if (typeof metricConfig.panelOptions.type !== 'string' || !availablePanelTypes.has(metricConfig.panelOptions.type)) {
    return false;
  }

  if (!Array.isArray(metricConfig.queryOptions.queries)) {
    return false;
  }

  if (
    !metricConfig.queryOptions.queries.every((q) => {
      if (!PROMQL_FUNCTIONS.has(q.fn)) {
        return false;
      }

      if (!['quantile', 'histogram_quantile'].includes(q.fn)) {
        return true;
      }

      if (!Array.isArray(q.params?.percentiles) || !q.params.percentiles.length) {
        return false;
      }

      return q.params.percentiles.every((p) => p >= 1 && p <= 99);
    })
  ) {
    return false;
  }

  return true;
}
