import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { type PanelType } from './GmdVizPanel';

interface GmdVizPanelVariantSelectorState extends SceneObjectState {
  metric: string;
  options: Array<{
    label: string;
    value: PanelType;
  }>;
  currentPanelType?: PanelType;
}

export class GmdVizPanelVariantSelector extends SceneObjectBase<GmdVizPanelVariantSelectorState> {
  constructor({ metric }: { metric: GmdVizPanelVariantSelectorState['metric'] }) {
    super({
      metric,
      options: [
        { value: 'percentiles' as PanelType, label: 'percentiles' },
        { value: 'heatmap' as PanelType, label: 'heatmap' },
      ],
      currentPanelType: undefined,
    });
  }

  private onChange = (newPanelType: PanelType) => {
    this.publishEvent(new EventPanelTypeChanged({ panelType: newPanelType }), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<GmdVizPanelVariantSelector>) => {
    const { options, currentPanelType } = model.useState();

    if (!options.length) {
      return null;
    }

    return <RadioButtonGroup size="sm" options={options} value={currentPanelType} onChange={model.onChange} />;
  };
}
