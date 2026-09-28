import { type BackendSrvRequest } from '@grafana/runtime';

export const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

export const GRAFANA_RULER_RULES_URL = '/api/prometheus/grafana/api/v1/rules';
export const SLO_PLUGIN_ID = 'grafana-slo-app';
export const SLO_RESOURCE_URL = `/api/plugins/${SLO_PLUGIN_ID}/resources/v1/slo`;
