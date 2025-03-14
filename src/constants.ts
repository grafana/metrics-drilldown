import { VariantVariable } from 'WingmanOnboarding/VariantVariable';

import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export const ROUTES = {
  Home: '',
  Trail: 'trail',
  OnboardWithSidebar: VariantVariable.OPTIONS[0],
  OnboardWithPills: VariantVariable.OPTIONS[1],
  TrialWithSidebar: VariantVariable.OPTIONS[0].replace('onboard', 'trail'),
  TrialWithPills: VariantVariable.OPTIONS[1].replace('onboard', 'trail'),
};

export const DATASOURCE_REF = {
  uid: 'gdev-testdata',
  type: 'testdata',
};
