import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu, Tooltip, useStyles2, type IconName } from '@grafana/ui';
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
// TODO: pass full MetricUsageDetailsObject into UsageSectionProps?
interface UsageSectionProps {
  usageType: MetricUsageType;
  usageCount: number;
  singularUsageType: string;
  pluralUsageType: string;
  icon: IconName;
  usageDetails: MetricUsageDetails;
}

function UsageData({
  usageType,
  usageCount,
  singularUsageType,
  pluralUsageType,
  icon,
  usageDetails,
}: Readonly<UsageSectionProps>) {
  const styles = useStyles2(getStyles);

  let dashboardItems: Array<{ label: string; value: string; count: number }> = [];
  if (usageDetails.usageType === 'dashboard-usage') {
    const { dashboards } = usageDetails;
    dashboardItems = Object.entries(dashboards)
      .map(([name, dashboardInfo]) => ({
        label: `${name.length > 25 ? name.substring(0, 22) + '...' : name} (${dashboardInfo.count})`, // truncate long dashboard names while preserving the count
        value: `/d/${dashboardInfo.uid}`,
        count: dashboardInfo.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  return (
    <div className={styles.usageContainer} data-testid="usage-data-panel">
      {usageDetails.usageType === 'dashboard-usage' ? (
        <>
          <Dropdown
            placement="right-start"
            overlay={
              <Menu style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {dashboardItems.map((item) => (
                  <Menu.Item key={item.value} label={item.label} onClick={() => window.open(item.value, '_blank')} />
                ))}
              </Menu>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              tooltip={`Metric used in ${usageCount} dashboards. Click to view them.`}
              className={`${styles.usageItem} ${styles.clickableUsageItem}`}
            >
              <Icon name={icon} style={{ marginRight: '4px' }} /> {usageCount}
            </Button>
          </Dropdown>
        </>
      ) : (
        <Tooltip
          content={`Metric is used in ${usageCount} ${usageCount === 1 ? singularUsageType : pluralUsageType}`}
          placement="top"
        >
          <span className={styles.usageItem} data-testid={usageType}>
            <Icon name={icon} /> {usageCount}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
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
    clickableUsageItem: css({
      backgroundColor: 'transparent',
      border: 'none',
    }),
  };
}
