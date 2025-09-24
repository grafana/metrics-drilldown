import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { type PanelType } from 'shared/GmdVizPanel/types/available-panel-types';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { EventPanelTypeChanged } from './EventPanelTypeChanged';

interface GmdVizPanelVariantSelectorState extends SceneObjectState {
  options: Array<{
    label: string;
    value: PanelType;
  }>;
  currentPanelType?: PanelType;
}

// currently used only for histogram metrics
export class GmdVizPanelVariantSelector extends SceneObjectBase<GmdVizPanelVariantSelectorState> {
  constructor(state: Record<string, any>) {
    super({
      ...state,
      options: [
        { value: 'percentiles' as PanelType, label: 'percentiles' },
        { value: 'heatmap' as PanelType, label: 'heatmap' },
      ],
      currentPanelType: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const vizPanel = sceneGraph.getAncestor(this, GmdVizPanel);

    this.setState({
      currentPanelType: vizPanel.state.panelConfig.type,
    });

    this._subs.add(
      vizPanel.subscribeToState((newState, prevState) => {
        if (newState.panelConfig.type !== prevState.panelConfig.type) {
          this.setState({
            currentPanelType: newState.panelConfig.type,
          });
        }
      })
    );
  }

  private onChange = (newPanelType: PanelType) => {
    reportExploreMetrics('histogram_panel_type_changed', { panelType: newPanelType });

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
