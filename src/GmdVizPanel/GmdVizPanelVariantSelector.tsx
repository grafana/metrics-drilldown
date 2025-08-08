import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { PANEL_TYPE } from './GmdVizPanel';

interface GmdVizPanelVariantSelectorState extends SceneObjectState {
  metric: string;
  panelType: PANEL_TYPE;
  options: Array<{
    label: string;
    value: PANEL_TYPE;
  }>;
  currentPanelType: PANEL_TYPE;
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

  private static getOptions(metric: string, panelType: PANEL_TYPE) {
    if ([PANEL_TYPE.HEATMAP, PANEL_TYPE.PERCENTILES].includes(panelType)) {
      return [
        { value: PANEL_TYPE.PERCENTILES, label: 'percentiles' },
        { value: PANEL_TYPE.HEATMAP, label: 'heatmap' },
      ];
    }
    return [];
  }

  private onChange = (newPanelType: PANEL_TYPE) => {
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
