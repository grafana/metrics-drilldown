import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userPreferences } from 'UserPreferences/userPreferences';

import { type PanelConfigPreset } from './presets/types';

export function getPreferredConfigForMetric(metric: string): PanelConfigPreset | undefined {
  const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS) || {};
  return userPrefs[metric]?.config;
}
