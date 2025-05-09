import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { MetricSelectedEvent } from 'shared';

interface SelectActionState extends SceneObjectState {
  metricName: string;
  variant: 'primary' | 'secondary';
  fill: 'solid' | 'outline' | 'text';
}

export class SelectAction extends SceneObjectBase<SelectActionState> {
  constructor({
    metricName,
    variant,
    fill,
  }: {
    metricName: SelectActionState['metricName'];
    variant?: SelectActionState['variant'];
    fill?: SelectActionState['fill'];
  }) {
    super({
      key: `select-action-${metricName}`,
      metricName,
      variant: variant || 'primary',
      fill: fill || 'outline',
    });
  }

  public onClick = () => {
    this.publishEvent(new MetricSelectedEvent(this.state.metricName), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectAction>) => {
    const { variant, fill } = model.useState();

    return (
      <Button
        variant={variant}
        fill={fill}
        size="sm"
        onClick={model.onClick}
        data-testid={`select-action-${model.state.metricName}`}
      >
        Select
      </Button>
    );
  };
}
