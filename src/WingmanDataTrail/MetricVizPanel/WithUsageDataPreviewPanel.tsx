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
import { type MetricUsageDetails } from 'WingmanDataTrail/ListControls/MetricsSorter/fetchers/fetchDashboardMetrics';
import {
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';
import { type MetricUsageType } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricUsageFetcher';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import {
  METRICS_VIZ_PANEL_HEIGHT,
  METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
  type MetricVizPanel,
} from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

import { UsageData, type UsageSectionProps } from './UsageData';

type SortBy = Exclude<SortingOption, 'related'>;

type WithUsageDataPreviewPanelState = SceneObjectState & {
  [key in MetricUsageType]: number;
} & {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  sortBy: SortBy;
  metricUsageDetails: MetricUsageDetails;
};

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Pick<WithUsageDataPreviewPanelState, 'vizPanelInGridItem' | 'metric'>) {
    super({
      ...state,
      sortBy: 'default',
      'alerting-usage': 0,
      'dashboard-usage': 0,
      metricUsageDetails: { usageType: 'dashboard-usage', count: 0, dashboards: {} },
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

  private updateSortBy(metricsSorter: MetricsSorter, sortBy: SortBy) {
    this.setState({ sortBy });

    const gridLayout = sceneGraph.getAncestor(this, SceneCSSGridLayout);
    const currentGridLayoutHeight = gridLayout?.state.autoRows;

    switch (sortBy) {
      case 'dashboard-usage':
      case 'alerting-usage':
        metricsSorter.getUsageDetailsForMetric(this.state.metric, sortBy).then((usage) => {
          this.setState({
            [sortBy]: usage.count,
            metricUsageDetails: usage,
          });
        });
        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW) {
          gridLayout.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW });
        }
        break;
      default:
        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT) {
          gridLayout.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT });
        }
        break;
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const {
      vizPanelInGridItem,
      sortBy,
      'alerting-usage': metricUsedInAlertingRulesCount,
      'dashboard-usage': metricUsedInDashboardsCount,
      metricUsageDetails,
    } = model.useState();

    if (!vizPanelInGridItem) {
      logger.log('no viz panel');
      return;
    }

    if (sortBy === 'default') {
      return (
        <div data-testid="with-usage-data-preview-panel">
          <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        </div>
      );
    }

    const usageDetails: Record<MetricUsageType, Omit<UsageSectionProps, 'usageType'>> = {
      'dashboard-usage': {
        usageCount: metricUsedInDashboardsCount,
        singularUsageType: 'dashboard panel query',
        pluralUsageType: 'dashboard panel queries',
        icon: 'apps',
        usageDetails: metricUsageDetails,
      },
      'alerting-usage': {
        usageCount: metricUsedInAlertingRulesCount,
        singularUsageType: 'alert rule',
        pluralUsageType: 'alert rules',
        icon: 'bell',
        usageDetails: metricUsageDetails,
      },
    };

    return (
      <div data-testid="with-usage-data-preview-panel">
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        <UsageData
          usageType={sortBy}
          usageCount={usageDetails[sortBy].usageCount}
          singularUsageType={usageDetails[sortBy].singularUsageType}
          pluralUsageType={usageDetails[sortBy].pluralUsageType}
          icon={usageDetails[sortBy].icon as IconName}
          usageDetails={usageDetails[sortBy].usageDetails}
        />
      </div>
    );
  };
}
