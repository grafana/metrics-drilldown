import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import React from 'react';

import { UI_TEXT } from '../constants/ui';
import { reportExploreMetrics } from '../interactions';
import { MetricScene } from '../MetricScene';
import { MetricSelectedEvent } from '../shared';
import { getTrailFor } from '../utils';

interface SelectNewMetricButtonState extends SceneObjectState {}

export class SelectNewMetricButton extends SceneObjectBase<SelectNewMetricButtonState> {
  constructor(state: Partial<SelectNewMetricButtonState> = {}) {
    super({
      ...state,
    });
  }

  private onSelectNewMetric = () => {
    const trail = getTrailFor(this);
    reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
    trail.publishEvent(new MetricSelectedEvent({}));
  };

  static readonly Component = ({ model }: SceneComponentProps<SelectNewMetricButton>) => {
    const trail = getTrailFor(model);
    const { topScene, embedded } = trail.useState();

    // Only show the button when:
    // 1. A metric is selected (topScene is MetricScene)
    // 2. Not in embedded mode
    const isButtonVisible = topScene instanceof MetricScene && !embedded;

    if (!isButtonVisible) {
      return null;
    }

    return (
      <ToolbarButton
        variant={'canvas'}
        tooltip={UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP}
        onClick={model.onSelectNewMetric}
        data-testid="select-new-metric-button"
      >
        Select new metric
      </ToolbarButton>
    );
  };
}
