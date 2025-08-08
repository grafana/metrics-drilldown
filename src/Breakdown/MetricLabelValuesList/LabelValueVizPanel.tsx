import {
  PanelBuilders,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneDataNode,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import React from 'react';

import { type PanelMenu } from 'Menu/PanelMenu';

import { publishTimeseriesData } from '../MetricLabelsList/behaviors/publishTimeseriesData';

interface LabelValueVizPanelState extends SceneObjectState {
  labelValue: string;
  unit: string;
  fixedColor: string;
  body: VizPanel;
}

export class LabelValueVizPanel extends SceneObjectBase<LabelValueVizPanelState> {
  constructor({
    labelValue,
    data,
    unit,
    fixedColor,
    headerActions,
    menu,
  }: {
    labelValue: LabelValueVizPanelState['labelValue'];
    data: SceneDataNode;
    unit: LabelValueVizPanelState['unit'];
    fixedColor: LabelValueVizPanelState['fixedColor'];
    headerActions: VizPanelState['headerActions'];
    menu: PanelMenu;
  }) {
    super({
      key: `label-value-viz-panel-${labelValue}`,
      labelValue,
      unit,
      fixedColor,
      body: LabelValueVizPanel.buildVizPanel({
        labelValue,
        data,
        unit,
        fixedColor,
        headerActions,
        menu,
      }),
    });
  }

  private static buildVizPanel({
    labelValue,
    data,
    unit,
    fixedColor,
    headerActions,
    menu,
  }: {
    labelValue: LabelValueVizPanelState['labelValue'];
    data: SceneDataNode;
    unit: LabelValueVizPanelState['unit'];
    fixedColor: LabelValueVizPanelState['fixedColor'];
    headerActions: VizPanelState['headerActions'];
    menu: PanelMenu;
  }) {
    return PanelBuilders.timeseries()
      .setTitle(labelValue)
      .setBehaviors([publishTimeseriesData()]) // publishTimeseriesData is required for the syncYAxis behavior
      .setData(data)
      .setUnit(unit)
      .setColor({ mode: 'fixed', fixedColor })
      .setCustomFieldConfig('fillOpacity', 9)
      .setHeaderActions(headerActions)
      .setOption('legend', { showLegend: false })
      .setShowMenuAlways(true)
      .setMenu(menu)
      .build();
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelValueVizPanel>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
