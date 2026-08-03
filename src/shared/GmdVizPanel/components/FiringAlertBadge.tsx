import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsSorter } from 'MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { isFiringAlertsSortingEnabled } from 'shared/featureFlags/openFeature';

interface FiringAlertBadgeState extends SceneObjectState {
  metric: string;
  count: number;
  visible: boolean;
}

export class FiringAlertBadge extends SceneObjectBase<FiringAlertBadgeState> {
  constructor({ metric }: { metric: string }) {
    super({
      metric,
      count: 0,
      visible: false,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const flagEnabled = await isFiringAlertsSortingEnabled();
    if (!flagEnabled) {
      return;
    }

    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
      const count = await metricsSorter.getFiringAlertCountForMetric(this.state.metric);
      if (count > 0) {
        this.setState({ count, visible: true });
      }
    } catch {
      // MetricsSorter not in scene graph — badge stays hidden
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<FiringAlertBadge>) => {
    const styles = useStyles2(getStyles);
    const { count, visible } = model.useState();

    if (!visible || count === 0) {
      return null;
    }

    const tooltip = t('firing-alert-badge.tooltip', '{{count}} firing alert rule(s) reference this metric', { count });

    return (
      <Tooltip content={tooltip}>
        <div className={styles.badge} data-testid="firing-alert-badge">
          <Icon name="bell" size="sm" className={styles.icon} />
          <span className={styles.count}>{count}</span>
        </div>
      </Tooltip>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    badge: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.warning.transparent,
      color: theme.colors.warning.text,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: 1,
      cursor: 'default',
    }),
    icon: css({
      color: theme.colors.warning.text,
    }),
    count: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}
