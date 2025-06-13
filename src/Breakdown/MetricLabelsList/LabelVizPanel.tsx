import { css } from '@emotion/css';
import { FieldMatcherID, LoadingState, type DataFrame } from '@grafana/data';
import {
  PanelBuilders,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { TooltipDisplayMode, useStyles2 } from '@grafana/ui';
import { merge } from 'lodash';
import React from 'react';

import { EventTimeseriesDataReceived } from 'Breakdown/events/EventTimeseriesDataReceived';
import { SelectLabelAction } from 'Breakdown/LabelBreakdownScene';
import { PanelMenu } from 'Menu/PanelMenu';
import { MDP_METRIC_PREVIEW, trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { fixLegendForUnspecifiedLabelValueBehavior } from '../behaviours/fixLegendForUnspecifiedLabelValueBehavior';

interface LabelVizPanelState extends SceneObjectState {
  metric: string;
  label: string;
  query: string;
  unit: string;
  startColorIndex: number;
  body: VizPanel;
}

export const LABELS_VIZ_PANEL_HEIGHT = '220px';

export class LabelVizPanel extends SceneObjectBase<LabelVizPanelState> {
  constructor({
    metric,
    label,
    query,
    unit,
    startColorIndex,
  }: {
    metric: LabelVizPanelState['label'];
    label: LabelVizPanelState['label'];
    query: LabelVizPanelState['query'];
    unit: LabelVizPanelState['unit'];
    startColorIndex: LabelVizPanelState['startColorIndex'];
  }) {
    super({
      key: `label-viz-panel-${label}`,
      metric,
      label,
      query,
      unit,
      startColorIndex,
      body: LabelVizPanel.buildVizPanel({ metric, label, query, unit }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { body } = this.state;

    this._subs.add(
      (body.state.$data as SceneQueryRunner).subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }
        const { series } = newState.data;

        if (series?.length) {
          const config = this.getAllValuesConfig(series);
          body.setState(merge({}, body.state, config));
        }

        // we publish the event only after setting the new config so that the subscribers can modify it (e.g. for syncing y-axis)
        this.publishEvent(new EventTimeseriesDataReceived({ series }), true);
      })
    );
  }

  getAllValuesConfig(series: DataFrame[]) {
    return {
      fieldConfig: {
        overrides: this.getOverrides(series),
      },
    };
  }

  getOverrides(series: DataFrame[]) {
    const { label, startColorIndex } = this.state;

    return series.map((s, i) => {
      const displayName = s.fields[1]?.labels?.[label] || `<unspecified ${label}>`;

      return {
        matcher: { id: FieldMatcherID.byName, options: displayName },
        properties: [
          {
            id: 'displayName',
            value: displayName,
          },
          {
            id: 'color',
            value: { mode: 'fixed', fixedColor: getColorByIndex(startColorIndex + i) },
          },
        ],
      };
    });
  }

  private static buildVizPanel({
    metric,
    label,
    query,
    unit,
  }: {
    metric: LabelVizPanelState['label'];
    label: LabelVizPanelState['label'];
    query: LabelVizPanelState['query'];
    unit: LabelVizPanelState['unit'];
  }) {
    const vizPanel = PanelBuilders.timeseries()
      .setTitle(label!)
      .setData(
        new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: MDP_METRIC_PREVIEW,
          queries: [
            {
              refId: `${metric}-${label}`,
              expr: query,
              legendFormat: `{{${label}}}`,
              fromExploreMetrics: true,
            },
          ],
        })
      )
      .setUnit(unit)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
      .setHeaderActions([new SelectLabelAction({ labelName: String(label) })])
      .setMenu(new PanelMenu({ labelName: String(label) }))
      .setShowMenuAlways(true)
      .setBehaviors([fixLegendForUnspecifiedLabelValueBehavior])
      .build();

    return vizPanel;
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelVizPanel>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <body.Component model={body} />
      </div>
    );
  };
}

function getStyles() {
  return {
    container: css({
      height: LABELS_VIZ_PANEL_HEIGHT,
    }),
  };
}
