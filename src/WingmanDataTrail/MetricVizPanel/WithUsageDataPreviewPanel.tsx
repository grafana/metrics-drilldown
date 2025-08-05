import {
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { type IconName } from '@grafana/ui';
import React from 'react';

import { logger } from 'tracking/logger/logger';
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

import { UsageData } from './UsageData';

type SortBy = Exclude<SortingOption, 'related'>;

export type WithUsageDataPreviewPanelState = SceneObjectState & {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  sortBy: SortBy;
  usageCount: number;
  singularUsageType: string;
  pluralUsageType: string;
  icon: IconName;
  dashboardItems: Array<{ label: string; value: string; count: number }>;
};

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Pick<WithUsageDataPreviewPanelState, 'vizPanelInGridItem' | 'metric'>) {
    super({
      ...state,
      sortBy: 'default',
      usageCount: 0,
      singularUsageType: '',
      pluralUsageType: '',
      icon: '' as IconName,
      dashboardItems: [],
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    let metricsReducer;

    try {
      metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
    } catch {
      return;
    }

    const filteredMetricsEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE);
    if (!filteredMetricsEngine) {
      return;
    }

    const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
    const sortByVar = sceneGraph.getVariables(metricsSorter).getByName(VAR_WINGMAN_SORT_BY);

    if (isCustomVariable(sortByVar)) {
      this.updateSortBy(metricsSorter, sortByVar.getValue() as SortBy);

      this._subs.add(
        sortByVar.subscribeToState(({ value }) => {
          this.updateSortBy(metricsSorter, value as SortBy);
        })
      );
    }
  }

  private async updateSortBy(metricsSorter: MetricsSorter, sortBy: SortBy) {
    this.setState({ sortBy });
    this.updateLayout(sortBy);

    if (sortBy === 'default') {
      return;
    }

    const usage = await metricsSorter.getUsageDetailsForMetric(this.state.metric, sortBy);

    switch (sortBy) {
      case 'dashboard-usage':
        // FIXME: we do this only to satisfy TS Lord
        if (usage.usageType !== 'dashboard-usage') {
          return;
        }

        const { dashboards } = usage;

        this.setState({
          usageCount: usage.count,
          singularUsageType: 'dashboard panel query',
          pluralUsageType: 'dashboard panel queries',
          icon: 'apps',
          dashboardItems: Object.entries(dashboards)
            .map(([label, dashboardInfo]) => ({
              label,
              value: `/d/${dashboardInfo.uid}`,
              count: dashboardInfo.count,
            }))
            .sort((a, b) => b.count - a.count),
        });
        break;

      case 'alerting-usage':
        this.setState({
          usageCount: usage.count,
          singularUsageType: 'alert rule',
          pluralUsageType: 'alert rules',
          icon: 'bell',
        });
        break;

      default:
        break;
    }
  }

  private updateLayout(sortBy: WithUsageDataPreviewPanelState['sortBy']) {
    const gridLayout = sceneGraph.getAncestor(this, SceneCSSGridLayout);
    const currentGridLayoutHeight = gridLayout?.state.autoRows;

    const expectedPanelHeight =
      sortBy === 'default' ? METRICS_VIZ_PANEL_HEIGHT : METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW;

    if (currentGridLayoutHeight !== expectedPanelHeight) {
      gridLayout.setState({ autoRows: expectedPanelHeight });
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem, sortBy, usageCount, singularUsageType, pluralUsageType, icon, dashboardItems } =
      model.useState();

    if (!vizPanelInGridItem) {
      logger.log('no viz panel');
      return;
    }

    return (
      <div data-testid="with-usage-data-preview-panel">
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        {sortBy !== 'default' && (
          <UsageData
            usageType={sortBy}
            usageCount={usageCount}
            singularUsageType={singularUsageType}
            pluralUsageType={pluralUsageType}
            icon={icon}
            dashboardItems={dashboardItems}
          />
        )}
      </div>
    );
  };
}
