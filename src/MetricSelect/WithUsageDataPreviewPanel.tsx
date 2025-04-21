import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { isCustomVariable } from 'utils/utils.variables';
import {
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import {
  METRICS_VIZ_PANEL_HEIGHT,
  METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
  type MetricVizPanel,
} from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

interface WithUsageDataPreviewPanelState extends SceneObjectState {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  metricsUsedInDashboardsCount: number;
  metricsUsedInAlertingRulesCount: number;
  sortBy: SortingOption;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Pick<WithUsageDataPreviewPanelState, 'vizPanelInGridItem' | 'metric'>) {
    super({
      ...state,
      metricsUsedInDashboardsCount: 0,
      metricsUsedInAlertingRulesCount: 0,
      sortBy: 'default',
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    const metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
    const filteredMetricsEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE);
    if (!filteredMetricsEngine) {
      return;
    }
    const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
    const sortByVar = sceneGraph.getVariables(metricsSorter).getByName(VAR_WINGMAN_SORT_BY);

    if (isCustomVariable(sortByVar)) {
      this.updateSortBy(metricsSorter, sortByVar.getValue() as SortingOption);
      this._subs.add(
        sortByVar.subscribeToState(({ value }) => {
          this.updateSortBy(metricsSorter, value as SortingOption);
        })
      );
    }
  }
  private updateSortBy(metricsSorter: MetricsSorter, sortBy: SortingOption) {
    this.setState({ sortBy });
    const gridLayout = sceneGraph.getAncestor(this, SceneCSSGridLayout);
    const currentGridLayoutHeight = gridLayout?.state.autoRows;

    switch (sortBy) {
      case 'dashboard-usage':
        metricsSorter?.getUsageForMetric(this.state.metric, 'dashboards').then((usage) => {
          this.setState({
            metricsUsedInDashboardsCount: usage,
          });
        });
        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW) {
          gridLayout?.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW });
        }
        break;
      case 'alerting-usage':
        metricsSorter?.getUsageForMetric(this.state.metric, 'alerting').then((usage) => {
          this.setState({
            metricsUsedInAlertingRulesCount: usage,
          });
        });
        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW) {
          gridLayout?.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW });
        }
        break;
      default:
        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT) {
          gridLayout?.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT });
        }
        break;
    }
  }

  public static Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem, metricsUsedInAlertingRulesCount, metricsUsedInDashboardsCount, sortBy } =
      model.useState();
    if (!vizPanelInGridItem) {
      console.log('no viz panel');
      return;
    }

    const styles = useStyles2(getStyles);

    if (sortBy === 'default') {
      return (
        <div className={styles.panelContainer} data-testid="with-usage-data-preview-panel">
          <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        </div>
      );
    }

    return (
      <div className={styles.panelContainer} data-testid="with-usage-data-preview-panel">
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        {sortBy === 'dashboard-usage' && (
          <div className={styles.usageContainer} data-testid="usage-data-panel">
            <Tooltip
              content={`Metric is used in ${metricsUsedInDashboardsCount} dashboard panel ${
                metricsUsedInDashboardsCount === 1 ? 'query' : 'queries'
              }`}
              placement="top"
            >
              <span className={styles.usageItem} data-testid="dashboard-usage">
                <Icon name="apps" /> {metricsUsedInDashboardsCount}
              </span>
            </Tooltip>
          </div>
        )}
        {sortBy === 'alerting-usage' && (
          <div className={styles.usageContainer} data-testid="usage-data-panel">
            <Tooltip
              content={`Metric is used in ${metricsUsedInAlertingRulesCount} alert rule${
                metricsUsedInAlertingRulesCount === 1 ? '' : 's'
              }`}
              placement="top"
            >
              <span className={styles.usageItem} data-testid="alerting-usage">
                <Icon name="bell" /> {metricsUsedInAlertingRulesCount}
              </span>
            </Tooltip>
          </div>
        )}
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
