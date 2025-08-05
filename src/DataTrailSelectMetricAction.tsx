import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import React from 'react';

import { UI_TEXT } from './constants/ui';
import { reportExploreMetrics } from './interactions';
import { MetricSelectedEvent } from './shared';
import { getTrailFor } from './utils';

interface DataTrailSelectMetricActionState extends SceneObjectState {}

export class DataTrailSelectMetricAction extends SceneObjectBase<DataTrailSelectMetricActionState> {
  constructor() {
    super({
      key: 'datatrail-select-metric-action',
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<DataTrailSelectMetricAction>) => {
    const trail = getTrailFor(model);
    const {metric} = trail.useState();
    
    const handleClick = () => {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
      trail.publishEvent(new MetricSelectedEvent(undefined));
    };

    return (
      metric ? <ToolbarButton
        variant="canvas"
        icon="plus"
        tooltip={UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP}
        onClick={handleClick}
      >
        Select new metric
      </ToolbarButton>
      : <></>
    );
  };
}
