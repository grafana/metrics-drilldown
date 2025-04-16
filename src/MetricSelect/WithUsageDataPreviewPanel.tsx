import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsSorter } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { type MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

interface WithUsageDataPreviewPanelState extends SceneObjectState {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  metricsUsedInDashboardsCount: number;
  metricsUsedInAlertingRulesCount: number;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Pick<WithUsageDataPreviewPanelState, 'vizPanelInGridItem' | 'metric'>) {
    super({
      ...state,
      metricsUsedInDashboardsCount: 0,
      metricsUsedInAlertingRulesCount: 0,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    const { metric } = this.state;
    const metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
    const filteredMetricsEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE);
    if (!filteredMetricsEngine) {
      return;
    }
    const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
    Promise.all([
      metricsSorter?.getUsageForMetric(metric, 'dashboards'),
      metricsSorter?.getUsageForMetric(metric, 'alerting'),
    ]).then(([dashboardUsage, alertingUsage]) => {
      this.setState({
        metricsUsedInDashboardsCount: dashboardUsage,
        metricsUsedInAlertingRulesCount: alertingUsage,
      });
    });
  }

  public static Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem, metricsUsedInAlertingRulesCount, metricsUsedInDashboardsCount } = model.useState();
    if (!vizPanelInGridItem) {
      console.log('no viz panel');
      return;
    }

    const styles = useStyles2(getStyles);

    return (
      <div className={styles.panelContainer} data-testid="with-usage-data-preview-panel">
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        <div className={styles.usageContainer} data-testid="usage-data-panel">
          <Tooltip content="Dashboards usage" placement="top">
            <span className={styles.usageItem} data-testid="dashboard-usage">
              <Icon name="apps" /> {metricsUsedInDashboardsCount}
            </span>
          </Tooltip>
          <Tooltip content="Alerting rules usage" placement="top">
            <span className={styles.usageItem} data-testid="alerting-usage">
              <Icon name="bell" /> {metricsUsedInAlertingRulesCount}
            </span>
          </Tooltip>
        </div>
      </div>
    );
  };
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    panelContainer: css({
      // height: '175px',
    }),
    usageContainer: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      gap: '17px',
      padding: '8px 12px',
      border: `1px solid ${theme.colors.border.weak}`,
      borderTopWidth: 0,
      backgroundColor: theme.colors.background.primary,
      alignItems: 'center',
    }),
    usageItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      color: theme.colors.text.secondary,
      opacity: '65%',
    }),
  };
}
