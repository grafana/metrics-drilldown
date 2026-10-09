import { t } from '@grafana/i18n';

// NOTE: Until a new version of @grafana/data is released that includes
// PluginExtensionExposedComponents.CreateAlertFromPanelV1, use the string literal:
export const CREATE_ALERT_COMPONENT_ID = 'grafana/alerting/create-alert-from-panel/v1';

export function getCreateAlertLabel(): string {
  return t('panel-menu.action.create-alert', 'Create alert');
}
