import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsSorter } from 'MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { VAR_DATASOURCE } from 'shared/shared';

interface SloTrackedBadgeState extends SceneObjectState {
  metric: string;
  ownerCount: number;
  visible: boolean;
}

export class SloTrackedBadge extends SceneObjectBase<SloTrackedBadgeState> {
  private loadGeneration = 0;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: () => {
      void this.loadOwnerCount();
    },
  });

  constructor({ metric }: { metric: string }) {
    super({ metric, ownerCount: 0, visible: false });
    this.addActivationHandler(() => {
      void this.loadOwnerCount();
    });
  }

  private async loadOwnerCount() {
    const generation = ++this.loadGeneration;
    this.setState({ ownerCount: 0, visible: false });

    try {
      const datasourceUid = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString() ?? '';
      const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
      const signals = await metricsSorter.getSloMetricSignals(datasourceUid);
      if (generation !== this.loadGeneration) {
        return;
      }

      const ownerCount = signals.status === 'ready' ? (signals.trackedMetrics.get(this.state.metric)?.size ?? 0) : 0;
      this.setState({ ownerCount, visible: ownerCount > 0 });
    } catch {
      if (generation === this.loadGeneration) {
        this.setState({ ownerCount: 0, visible: false });
      }
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<SloTrackedBadge>) => {
    const styles = useStyles2(getStyles);
    const { ownerCount, visible } = model.useState();
    if (!visible || ownerCount === 0) {
      return null;
    }

    const tooltip = t('slo-tracked-badge.tooltip', '{{count}} SLO definitions reference this metric', {
      count: ownerCount,
    });

    return (
      <Tooltip content={tooltip}>
        <div className={styles.badge} data-testid="slo-tracked-badge" role="img" aria-label={tooltip}>
          <span aria-hidden="true">
            <Icon name="heart" size="sm" />
          </span>
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
      padding: theme.spacing(0, 0.5),
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.info.transparent,
      color: theme.colors.info.text,
      lineHeight: 1,
      cursor: 'default',
    }),
  };
}
