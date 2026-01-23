import { t } from '@grafana/i18n';
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

function getDefaultVariantOptions(): Array<{ label: string; value: PanelType }> {
  return [
    { value: 'percentiles' as PanelType, label: t('gmd-viz-panel.variant.percentiles', 'percentiles') },
    { value: 'heatmap' as PanelType, label: t('gmd-viz-panel.variant.heatmap', 'heatmap') },
  ];
}

// currently used only for histogram metrics
export class GmdVizPanelVariantSelector extends SceneObjectBase<GmdVizPanelVariantSelectorState> {
  constructor() {
    super({
      options: getDefaultVariantOptions(),
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
    const { currentPanelType } = model.useState();
    const translatedOptions = getDefaultVariantOptions();

    if (!translatedOptions.length) {
      return null;
    }

    return (
      <RadioButtonGroup size="sm" options={translatedOptions} value={currentPanelType} onChange={model.onChange} />
    );
  };
}
