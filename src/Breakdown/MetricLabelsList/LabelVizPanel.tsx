import { css } from '@emotion/css';
import { FieldMatcherID, LoadingState, type DataFrame } from '@grafana/data';
import {
  PanelBuilders,
  SceneDataTransformer,
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

import { SelectLabelAction } from 'Breakdown/SelectLabelAction';
import { PanelMenu } from 'Menu/PanelMenu';
import { MDP_METRIC_PREVIEW, trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { publishTimeseriesData } from './behaviors/publishTimeseriesData';
import { addRefId } from './transformations/addRefId';
import { SERIES_COUNT_STATS_NAME, sliceSeries } from './transformations/sliceSeries';

interface LabelVizPanelState extends SceneObjectState {
  metric: string;
  label: string;
  query: string;
  unit: string;
  startColorIndex: number;
  body: VizPanel;
}

const MAX_SERIES_TO_RENDER = 20;
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
    const data = new SceneDataTransformer({
      $data: new SceneQueryRunner({
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
      }),
      // addRefId is required for setting the overrides below
      transformations: [sliceSeries(0, MAX_SERIES_TO_RENDER), addRefId],
    });

    const vizPanel = PanelBuilders.timeseries()
      .setTitle(label)
      .setUnit(unit)
      .setData(data)
      // publishTimeseriesData is required for the syncYAxis behavior (see MetricLabelsList)
      .setBehaviors([publishTimeseriesData()])
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
      .setHeaderActions([new SelectLabelAction({ label })])
      .setMenu(new PanelMenu({ labelName: label }))
      .setShowMenuAlways(true)
      .build();

    return vizPanel;
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
      })
    );
  }

  getAllValuesConfig(series: DataFrame[]) {
    const { label } = this.state;

    const seriesCountStats = series[0].meta?.stats?.find((s) => s.displayName === SERIES_COUNT_STATS_NAME);
    const seriesCount = seriesCountStats ? seriesCountStats.value : series.length;
    const description =
      series.length < seriesCount
        ? `Showing only ${series.length} series out of ${seriesCount} to keep the data easy to read. Click on "Select" on this panel to view a breakdown of all the "${label}" label's values.`
        : '';

    return {
      title: `${label} (${seriesCount})`,
      description,
      fieldConfig: {
        overrides: this.getOverrides(series),
      },
    };
  }

  getOverrides(series: DataFrame[]) {
    const { label, startColorIndex } = this.state;

    return series.map((s, i) => {
      return {
        matcher: { id: FieldMatcherID.byFrameRefID, options: s.refId },
        properties: [
          {
            id: 'displayName',
            value: s.fields[1]?.labels?.[label] || `<unspecified ${label}>`,
          },
          {
            id: 'color',
            value: { mode: 'fixed', fixedColor: getColorByIndex(startColorIndex + i) },
          },
        ],
      };
    });
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
