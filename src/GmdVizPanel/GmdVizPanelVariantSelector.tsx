import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { type PanelType } from './GmdVizPanel';

interface GmdVizPanelVariantSelectorState extends SceneObjectState {
  metric: string;
  panelType: PanelType;
  options: Array<{
    label: string;
    value: PanelType;
  }>;
  currentPanelType: PanelType;
}

export class GmdVizPanelVariantSelector extends SceneObjectBase<GmdVizPanelVariantSelectorState> {
  constructor({
    metric,
    panelType,
  }: {
    metric: GmdVizPanelVariantSelectorState['metric'];
    panelType: GmdVizPanelVariantSelectorState['panelType'];
  }) {
    super({
      metric,
      panelType,
      options: GmdVizPanelVariantSelector.getOptions(metric, panelType),
      currentPanelType: panelType,
    });
  }

  private static getOptions(metric: string, panelType: PanelType) {
    if (['heatmap', 'percentiles'].includes(panelType)) {
      return [
        { value: 'percentiles' as PanelType, label: 'percentiles' },
        { value: 'heatmap' as PanelType, label: 'heatmap' },
      ];
    }
    return [];
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
