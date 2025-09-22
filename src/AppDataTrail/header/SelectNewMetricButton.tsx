import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { LinkButton, ToolbarButton } from '@grafana/ui';
import React from 'react';

import { UI_TEXT } from '../../constants/ui';
import { createAppUrl } from '../../extensions/links';
import { reportExploreMetrics } from '../../interactions';
import { MetricSelectedEvent } from '../../shared';
import { getTrailFor, getUrlForTrail } from '../../utils';

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
    const { embedded } = trail.useState();

    // In embedded mode, show "Metrics Drilldown" button to open full app
    if (embedded) {
      return (
        <LinkButton
          href={createAppUrl(getUrlForTrail(trail))}
          variant={'secondary'}
          icon="arrow-right"
          tooltip="Open in Metrics Drilldown"
          onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
          data-testid="open-metrics-drilldown-button"
        >
          Metrics Drilldown
        </LinkButton>
      );
    }

    // In non-embedded mode, show "Select new metric" button
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
