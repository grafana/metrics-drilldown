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

  public static Component = ({ model }: SceneComponentProps<SelectMetricAction>) => {
    const { title } = model.useState();
    return (
      <Button variant="secondary" size="sm" fill="solid" onClick={model.onClick}>
        {title}
      </Button>
    );
  };
}
