import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

import { getTrailFor } from '../utils';

export type UsageStats = {
  alertRules: Record<string, number>;
  dashboards: Record<string, number>;
};

interface WithUsageDataPreviewPanelState extends SceneObjectState {
  vizPanelInGridItem: MetricVizPanel;
  metric: string;
  stats?: UsageStats;
}

export class WithUsageDataPreviewPanel extends SceneObjectBase<WithUsageDataPreviewPanelState> {
  constructor(state: WithUsageDataPreviewPanelState) {
    super({ ...state });
  }

  public static Component = ({ model }: SceneComponentProps<WithUsageDataPreviewPanel>) => {
    const { vizPanelInGridItem, metric } = model.useState();
    if (!vizPanelInGridItem) {
      console.log('no viz panel');
      return;
    }

    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const usageStats = {
      dashboards: trail.state.dashboardMetrics?.[metric] ?? 0,
      alertingRules: trail.state.alertingMetrics?.[metric] ?? 0,
    };

    return (
      <div className={styles.panelContainer}>
        <vizPanelInGridItem.Component model={vizPanelInGridItem} />
        <div className={styles.usageContainer}>
          <span className={styles.usageItem}>
            <Icon name="apps" /> {usageStats.dashboards}
          </span>
          <span className={styles.usageItem}>
            <Icon name="bell" /> {usageStats.alertingRules}
          </span>
        </div>
      </div>
    );
  };
}

export function getStyles(theme: GrafanaTheme2) {
  return {
    panelContainer: css({
      height: '175px',
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
