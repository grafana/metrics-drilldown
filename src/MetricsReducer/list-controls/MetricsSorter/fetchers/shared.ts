import { type BackendSrvRequest } from '@grafana/runtime';

export const usageRequestOptions: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;
