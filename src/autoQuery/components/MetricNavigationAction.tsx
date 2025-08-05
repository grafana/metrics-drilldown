import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, LinkButton } from '@grafana/ui';
import React from 'react';

import { UI_TEXT } from '../../constants/ui';
import { createAppUrl } from '../../extensions/links';
import { reportExploreMetrics } from '../../interactions';
import { MetricSelectedEvent } from '../../shared';
import { getTrailFor, getUrlForTrail } from '../../utils';

interface MetricNavigationActionState extends SceneObjectState {}

export class MetricNavigationAction extends SceneObjectBase<MetricNavigationActionState> {
  constructor() {
    super({
      key: 'metric-navigation-action',
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricNavigationAction>) => {
    const trail = getTrailFor(model);

    if (trail.state.embedded) {
      return (
        <LinkButton
          href={createAppUrl(getUrlForTrail(trail))}
          variant={'secondary'}
          icon="arrow-right"
          tooltip="Open in Metrics Drilldown"
          onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
        >
          Metrics Drilldown
        </LinkButton>
      );
    }

    return (
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        tooltip={UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP}
        icon="plus"
        onClick={() => {
          reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
          trail.publishEvent(new MetricSelectedEvent(undefined));
        }}
      >
        Select new metric
      </Button>
    );
  };
}


