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

import { GmdVizPanel, PANEL_HEIGHT } from 'GmdVizPanel/GmdVizPanel';
import { type PanelMenu } from 'Menu/PanelMenu';

import { publishTimeseriesData } from '../MetricLabelsList/behaviors/publishTimeseriesData';

interface LabelValueVizPanelState extends SceneObjectState {
  labelValue: string;
  data: SceneDataNode;
  unit: string;
  fixedColor: string;
  headerActions: VizPanelState['headerActions'];
  menu: PanelMenu;
  body: VizPanel;
}

export const LABEL_VALUE_VIZ_PANEL_HEIGHT = `${GmdVizPanel.getPanelHeightInPixels(PANEL_HEIGHT.M)}px`;

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
    data: LabelValueVizPanelState['data'];
    unit: LabelValueVizPanelState['unit'];
    fixedColor: LabelValueVizPanelState['fixedColor'];
    headerActions: LabelValueVizPanelState['headerActions'];
    menu: LabelValueVizPanelState['menu'];
  }) {
    super({
      key: `label-value-viz-panel-${labelValue}`,
      labelValue,
      data,
      unit,
      fixedColor,
      headerActions,
      menu,
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
    data: LabelValueVizPanelState['data'];
    unit: LabelValueVizPanelState['unit'];
    fixedColor: LabelValueVizPanelState['fixedColor'];
    headerActions: LabelValueVizPanelState['headerActions'];
    menu: LabelValueVizPanelState['menu'];
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
