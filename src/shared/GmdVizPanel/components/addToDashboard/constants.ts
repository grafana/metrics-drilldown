import { PluginExtensionExposedComponents } from '@grafana/data';
import { t } from '@grafana/i18n';

export const ADD_TO_DASHBOARD_COMPONENT_ID =
  PluginExtensionExposedComponents?.AddToDashboardFormV1 || 'grafana/add-to-dashboard-form/v1';

export function getAddToDashboardLabel(): string {
  return t('panel-menu.action.add-to-dashboard', 'Add to dashboard');
}
