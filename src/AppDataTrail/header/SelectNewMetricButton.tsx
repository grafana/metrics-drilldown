import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { LinkButton, ToolbarButton } from '@grafana/ui';
import React from 'react';

import { createAppUrl } from '../../extensions/links';
import { UI_TEXT } from '../../shared/constants/ui';
import { MetricSelectedEvent } from '../../shared/shared';
import { reportExploreMetrics } from '../../shared/tracking/interactions';
import { getTrailFor, getUrlForTrail } from '../../shared/utils/utils';

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
          tooltip={t('select-new-metric.open-in-drilldown-tooltip', 'Open in Metrics Drilldown')}
          onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
          data-testid="open-metrics-drilldown-button"
        >
          {t('select-new-metric.metrics-drilldown', 'Metrics Drilldown')}
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
        {t('select-new-metric.button', 'Select new metric')}
      </ToolbarButton>
    );
  };
}
