import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

// we have to duplicate this definition from 'WingmanOnboarding/VariantVariable' here
// to prevent the E2E tests to fail with "ReferenceError: window is not defined"
// it happens in runtime because of the `import { CustomVariable } from '@grafana/scenes';` :man_shrug:
const VARIANT_VARIABLE_OPTIONS = ['onboard-filters-sidebar', 'onboard-filters-pills'];

export const ROUTES = {
  Home: '',
  Trail: 'trail',
  OnboardWithSidebar: VARIANT_VARIABLE_OPTIONS[0],
  OnboardWithPills: VARIANT_VARIABLE_OPTIONS[1],
  TrialWithSidebar: VARIANT_VARIABLE_OPTIONS[0].replace('onboard', 'trail'),
  TrialWithPills: VARIANT_VARIABLE_OPTIONS[1].replace('onboard', 'trail'),
};

export const DATASOURCE_REF = {
  uid: 'gdev-testdata',
  type: 'testdata',
};
