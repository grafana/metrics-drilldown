import { type Environment } from '../getEnvironment';
import { type FaroEnvironment } from './getFaroEnvironment';

export const FARO_ENVIRONMENTS = new Map<Environment, FaroEnvironment>([
  // Uncomment this map entry to test from your local machine
  // [
  //   'local',
  //   {
  //     environment: 'local',
  //     appName: 'grafana-metricsdrilldown-app-local',
  //     faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/b854cd2319527968f415fd44ea01fe8a',
  //   },
  // ],
  // Always keep the options below
  [
    'dev',
    {
      environment: 'dev',
      appName: 'grafana-metricsdrilldown-app-dev',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/8c57b32175ba39d35dfaccee7cd793c7',
    },
  ],
  [
    'ops',
    {
      environment: 'ops',
      appName: 'grafana-metricsdrilldown-app-ops',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/d65ab91eb9c5e8c51b474d9313ba28f4',
    },
  ],
  [
    'prod',
    {
      environment: 'prod',
      appName: 'grafana-metricsdrilldown-app-prod',
      faroUrl: 'https://faro-collector-ops-eu-south-0.grafana-ops.net/collect/0f4f1bbc97c9e2db4fa85ef75a559885',
    },
  ],
]);
