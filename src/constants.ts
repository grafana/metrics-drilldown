import pluginJson from './plugin.json';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export const ROUTES = {
  Trail: 'trail',
  Drilldown: 'drilldown',
};

export const DATASOURCE_REF = {
  uid: 'gdev-testdata',
  type: 'testdata',
};
