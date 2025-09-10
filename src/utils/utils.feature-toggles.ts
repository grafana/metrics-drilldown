import { type FeatureToggles } from '@grafana/data';
import { config } from '@grafana/runtime';

/**
 * Feature toggles defined in Hosted Grafana (not OSS).
 * @remarks See https://github.com/grafana/hosted-grafana/wiki/All-Things-Feature-Toggles#grafana-plugins for details.
 */
export const HGFeatureToggles = {
  // Add new feature toggles here
  sidebarOpenByDefault: 'metricsDrilldownDefaultOpenSidebar',
} as const;

type HGFeatureToggleName = (typeof HGFeatureToggles)[keyof typeof HGFeatureToggles];

type OssAndHGFeatureToggles = FeatureToggles & {
  [key in HGFeatureToggleName]: boolean;
};

export function isFeatureToggleEnabled(featureToggle: HGFeatureToggleName): boolean {
  return (config.featureToggles as OssAndHGFeatureToggles)[featureToggle] ?? false;
}
