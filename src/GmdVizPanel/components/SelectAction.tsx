import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { MetricSelectedEvent } from 'shared';

interface SelectActionState extends SceneObjectState {
  metric: string;
  variant: 'primary' | 'secondary';
  fill: 'solid' | 'outline' | 'text';
}

export class SelectAction extends SceneObjectBase<SelectActionState> {
  constructor({
    metric,
    variant,
    fill,
  }: {
    metric: SelectActionState['metric'];
    variant?: SelectActionState['variant'];
    fill?: SelectActionState['fill'];
  }) {
    super({
      key: `select-action-${metric}`,
      metric,
      variant: variant || 'primary',
      fill: fill || 'outline',
    });
  }

  public onClick = () => {
    this.publishEvent(new MetricSelectedEvent(this.state.metric), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<SelectAction>) => {
    const { variant, fill } = model.useState();

    return (
      <Button
        variant={variant}
        fill={fill}
        size="sm"
        onClick={model.onClick}
        data-testid={`select-action-${model.state.metric}`}
      >
        Select
      </Button>
    );
  };
}
