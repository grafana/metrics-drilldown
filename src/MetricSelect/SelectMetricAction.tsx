import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { getOtelExperienceToggleState } from '../services/store';
import { MetricSelectedEvent } from '../shared';
import { getTrailFor } from '../utils';

export interface SelectMetricActionState extends SceneObjectState {
  title: string;
  metric: string;
}

export class SelectMetricAction extends SceneObjectBase<SelectMetricActionState> {
  public onClick = () => {
    const trail = getTrailFor(this);
    const isOtelEnabled = getOtelExperienceToggleState();

    // Ensure OTel state is preserved
    if (isOtelEnabled && !trail.state.useOtelExperience) {
      trail.setState({ useOtelExperience: true });
    }

    // Update trail state first to trigger URL sync
    trail.setState({
      metric: this.state.metric,
      useOtelExperience: isOtelEnabled || trail.state.useOtelExperience,
    });

    // Then publish event to trigger any additional updates
    this.publishEvent(new MetricSelectedEvent(this.state.metric), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectMetricAction>) => {
    const { title, metric } = model.useState();
    const navigate = useNavigate();

    const handleClick = () => {
      // Push current state to history before updating
      navigate('.', { state: { metric: model.state.metric } });
      model.onClick();
    };

    return (
      <Button variant="secondary" size="sm" fill="solid" onClick={handleClick} data-testid={`select ${metric}`}>
        {title}
      </Button>
    );
  };
}
