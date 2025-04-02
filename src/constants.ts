import pluginJson from './plugin.json';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

// we have to duplicate this definition from 'WingmanOnboarding/VariantVariable' here
// to prevent the E2E tests to fail with "ReferenceError: window is not defined"
// it happens in runtime because of the `import { CustomVariable } from '@grafana/scenes';` :man_shrug:
const VARIANT_VARIABLE_OPTIONS = ['onboard-filters-sidebar', 'onboard-filters-pills', 'onboard-filters-labels'];

export const ROUTES = {
  Home: '',
  Trail: 'trail',
  OnboardWithSidebar: VARIANT_VARIABLE_OPTIONS[0],
  TrailWithSidebar: VARIANT_VARIABLE_OPTIONS[0].replace('onboard', 'trail'),
  OnboardWithPills: VARIANT_VARIABLE_OPTIONS[1],
  TrailWithPills: VARIANT_VARIABLE_OPTIONS[1].replace('onboard', 'trail'),
  OnboardWithLabels: VARIANT_VARIABLE_OPTIONS[2],
  TrailWithLabels: VARIANT_VARIABLE_OPTIONS[2].replace('onboard', 'trail'),
};

export const DATASOURCE_REF = {
  uid: 'gdev-testdata',
  type: 'testdata',
};
