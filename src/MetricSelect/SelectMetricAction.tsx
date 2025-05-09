import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { MetricSelectedEvent } from '../shared';

export interface SelectMetricActionState extends SceneObjectState {
  title: string;
  metric: string;
}

export class SelectMetricAction extends SceneObjectBase<SelectMetricActionState> {
  public onClick = () => {
    this.publishEvent(new MetricSelectedEvent(this.state.metric), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<SelectMetricAction>) => {
    const { title, metric } = model.useState();
    return (
      <Button variant="primary" size="sm" fill="outline" onClick={model.onClick} data-testid={`select ${metric}`}>
        {title}
      </Button>
    );
  };
}
