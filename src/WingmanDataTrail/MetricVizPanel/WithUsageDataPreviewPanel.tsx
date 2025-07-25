import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, Dropdown, Icon, Tooltip, useStyles2, type IconName } from '@grafana/ui';
import React from 'react';

import { logger } from 'tracking/logger/logger';
import { isCustomVariable } from 'utils/utils.variables';
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

// Add interface for detailed dashboard usage
interface DashboardUsage {
  name: string;
  count: number;
}

type WithUsageDataPreviewPanelState = SceneObjectState & {
  [key in MetricUsageType]: number;
} & {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  sortBy: SortBy;
  // Add detailed usage data
  dashboardDetails: DashboardUsage[];
};

// Generate dummy dashboard data
function generateDummyDashboardData(): DashboardUsage[] {
  const dashboardData = [
    { name: 'Infrastructure Overview Dashboard', count: 12 },
    { name: 'Application Performance Monitoring', count: 8 },
    { name: 'Database Metrics Dashboard', count: 15 },
    { name: 'Network Monitoring Dashboard', count: 6 },
    { name: 'Security Metrics Dashboard', count: 3 },
    { name: 'Business Intelligence Dashboard', count: 11 },
    { name: 'API Gateway Metrics', count: 9 },
    { name: 'Container Orchestration Dashboard', count: 14 },
    { name: 'Load Balancer Metrics', count: 5 },
    { name: 'Cache Performance Dashboard', count: 7 },
    { name: 'Search Service Metrics', count: 4 },
    { name: 'Message Queue Dashboard', count: 13 },
    { name: 'File System Monitoring', count: 2 },
    { name: 'User Activity Dashboard', count: 10 },
    { name: 'E-commerce Analytics Dashboard', count: 1 },
    { name: 'Customer Support Metrics', count: 6 },
    { name: 'Marketing Campaign Dashboard', count: 8 },
    { name: 'Sales Performance Dashboard', count: 9 },
  ];

  return dashboardData;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: Pick<WithUsageDataPreviewPanelState, 'vizPanelInGridItem' | 'metric'>) {
    super({
      ...state,
      sortBy: 'default',
      'alerting-usage': 0,
      'dashboard-usage': 0,
      dashboardDetails: [],
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
        // Generate dummy dashboard details
        const dashboardDetails = generateDummyDashboardData();
        const totalDashboardUsage = dashboardDetails.reduce((sum, dashboard) => sum + dashboard.count, 0);

        this.setState({
          'dashboard-usage': totalDashboardUsage,
          dashboardDetails,
        });

        if (currentGridLayoutHeight !== METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW) {
          gridLayout.setState({ autoRows: METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW });
        }
        break;
      case 'alerting-usage':
        metricsSorter.getUsageForMetric(this.state.metric, sortBy).then((usage) => {
          this.setState({
            [sortBy]: usage,
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
      dashboardDetails,
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
        dashboardDetails: dashboardDetails,
      },
      'alerting-usage': {
        usageCount: metricUsedInAlertingRulesCount,
        singularUsageType: 'alert rule',
        pluralUsageType: 'alert rules',
        icon: 'bell',
        dashboardDetails: [],
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
          dashboardDetails={usageDetails[sortBy].dashboardDetails}
        />
      </div>
    );
  };
}

interface UsageSectionProps {
  usageType: MetricUsageType;
  usageCount: number;
  singularUsageType: string;
  pluralUsageType: string;
  icon: IconName;
  dashboardDetails: DashboardUsage[];
}

function UsageData({
  usageType,
  usageCount,
  singularUsageType,
  pluralUsageType,
  icon,
  dashboardDetails,
}: Readonly<UsageSectionProps>) {
  const styles = useStyles2(getStyles);

  // Create dropdown menu for dashboard usage
  const renderDashboardsDropdown = () => {
    if (usageType !== 'dashboard-usage' || dashboardDetails.length === 0) {
      return null;
    }

    // Sort dashboards by count in descending order
    const sortedDashboards = [...dashboardDetails].sort((a, b) => b.count - a.count);

    const renderDropdownContent = () => (
      <div className={styles.dashboardMenu}>
        <div className={styles.menuHeader}>
          Used in {usageCount} {usageCount === 1 ? singularUsageType : pluralUsageType}:
        </div>
        <div className={styles.dashboardList}>
          {sortedDashboards.map((dashboard, index) => (
            <div key={index} className={styles.dashboardItem}>
              {dashboard.name} ({dashboard.count})
            </div>
          ))}
        </div>
      </div>
    );

    const tooltipContent = `Metric used in ${usageCount} dashboards. Click to view them.`;

    return (
      <Dropdown overlay={renderDropdownContent} placement="top-start">
        <Button variant="secondary" tooltip={tooltipContent} fill="text" size="sm" className={styles.dropdownButton}>
          <Icon name="apps" style={{ marginRight: '4px' }} /> {usageCount}
        </Button>
      </Dropdown>
    );
  };

  // For dashboard usage, show only the dropdown button with icon and count
  if (usageType === 'dashboard-usage') {
    return (
      <div className={styles.usageContainer} data-testid="usage-data-panel">
        {renderDashboardsDropdown()}
      </div>
    );
  }

  // For other usage types (like alerting), show the original format
  return (
    <div className={styles.usageContainer} data-testid="usage-data-panel">
      <Tooltip
        content={`Metric is used in ${usageCount} ${usageCount === 1 ? singularUsageType : pluralUsageType}`}
        placement="top"
      >
        <span className={styles.usageItem} data-testid={usageType}>
          <Icon name={icon} /> {usageCount}
        </span>
      </Tooltip>
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
    dropdownIcon: css({
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      opacity: '65%',
      '&:hover': {
        opacity: '100%',
      },
    }),
    dropdownButton: css({
      color: theme.colors.text.secondary,
      opacity: '65%',
      '&:hover': {
        opacity: '100%',
      },
    }),
    dashboardMenu: css({
      maxWidth: '400px',
      minWidth: '300px',
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
    }),
    menuHeader: css({
      fontWeight: 'bold',
      padding: '8px 12px',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    dashboardList: css({
      maxHeight: '200px',
      overflowY: 'auto',
      '&::-webkit-scrollbar': {
        width: '6px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: theme.colors.border.medium,
        borderRadius: '3px',
        '&:hover': {
          background: theme.colors.border.strong,
        },
      },
      '&::-webkit-scrollbar-corner': {
        background: 'transparent',
      },
    }),

    dashboardItem: css({
      padding: '8px 12px',
      display: 'block',
      width: '100%',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:last-child': {
        borderBottom: 'none',
      },
    }),
  };
}
