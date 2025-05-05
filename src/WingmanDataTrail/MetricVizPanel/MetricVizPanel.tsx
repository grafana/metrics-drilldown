import { css, cx } from '@emotion/css';
import { FieldMatcherID, LoadingState, type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneDataQuery,
  type SceneObject,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { merge } from 'lodash';
import React from 'react';

import { buildPrometheusQuery, getPromqlFunction, type NonRateQueryFunction } from 'autoQuery/buildPrometheusQuery';
import { getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';

import { type PrometheusFn } from './actions/ConfigureAction';
import { SelectAction } from './actions/SelectAction';
import { NativeHistogramBadge } from './NativeHistogramBadge';
import { buildHeatmapPanel } from './panels/buildHeatmapPanel';
import { buildStatusHistoryPanel } from './panels/buildStatusHistoryPanel';
import { buildTimeseriesPanel } from './panels/buildTimeseriesPanel';

interface MetricVizPanelProps {
  metricName: string;
  color: string;
  headerActions?: SceneObject[];
  height?: string;
  hideLegend?: boolean;
  highlight?: boolean;
  isNativeHistogram: boolean;
  matchers?: string[];
  prometheusFunction?: PrometheusFn;
  title?: string;
}

interface MetricVizPanelState
  extends SceneObjectState,
    Pick<Required<MetricVizPanelProps>, 'height' | 'highlight' | 'prometheusFunction'> {
  body: VizPanel;
}

export const METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW = '240px';
export const METRICS_VIZ_PANEL_HEIGHT = '200px';
export const METRICS_VIZ_PANEL_HEIGHT_SMALL = '160px';
const rateQueryMetricSuffixes = new Set(['count', 'total', 'sum', 'bucket']);

export class MetricVizPanel extends SceneObjectBase<MetricVizPanelState> {
  private static readonly MAX_DATA_POINTS = 250;
  private static readonly MAX_Y_AXIS_SHORT_VALUE = 100_000;

  constructor(props: MetricVizPanelProps) {
    const { isRateQuery } = MetricVizPanel.determineQueryProperties(props.metricName, props.isNativeHistogram);
    const stateWithDefaults = {
      ...props,
      prometheusFunction: props.prometheusFunction ?? (getPromqlFunction(isRateQuery) as PrometheusFn),
      isNativeHistogram: props.isNativeHistogram,
      matchers: props.matchers || [],
      title: props.title || props.metricName,
      height: props.height || METRICS_VIZ_PANEL_HEIGHT,
      hideLegend: Boolean(props.hideLegend),
      highlight: Boolean(props.highlight),
      headerActions: [
        ...(props.isNativeHistogram ? [new NativeHistogramBadge({})] : []),
        ...(props.headerActions || [new SelectAction({ metricName: props.metricName })]),
      ],
    };

    super({
      key: `metric-viz-panel-${stateWithDefaults.metricName}`,
      ...stateWithDefaults,
      body: MetricVizPanel.buildVizPanel({
        ...stateWithDefaults,
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { body, prometheusFunction } = this.state;

    this._subs.add(
      (body.state.$data as SceneQueryRunner).subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }

        const { series } = newState.data;

        if (series?.length) {
          body.setState({
            fieldConfig: {
              defaults: merge({}, body.state.fieldConfig.defaults, { unit: MetricVizPanel.getUnit(series) }),
              overrides: [
                {
                  matcher: { id: FieldMatcherID.byFrameRefID, options: series[0].refId },
                  properties: [
                    {
                      id: 'displayName',
                      value: prometheusFunction,
                    },
                  ],
                },
              ],
            },
          });
        }
      })
    );
  }

  // This method determines the unit for the y-axis values
  // Without calling this method, the current default unit would be "short": a short number abbreviated with the SI prefix, e.g. "71K" for 71000
  // This methods checks if the max value received in the 1st data frame is lower than MetricVizPanel.MAX_Y_AXIS_SHORT_VALUE, and if it's the case,
  // it uses the full number, e.g. 71K becomes 71255
  private static getUnit(series: DataFrame[]) {
    if (series.length > 1) {
      return undefined;
    }

    const field = series[0].fields.find((f) => f.name === 'Value');
    if (!field) {
      return undefined;
    }

    return Math.max(...field.values) < MetricVizPanel.MAX_Y_AXIS_SHORT_VALUE ? 'none' : undefined;
  }

  private static buildVizPanel({
    metricName,
    title,
    highlight,
    color,
    hideLegend,
    prometheusFunction,
    matchers,
    headerActions,
    isNativeHistogram = false,
  }: Required<Omit<MetricVizPanelProps, 'prometheusFunction'>> & {
    prometheusFunction?: MetricVizPanelProps['prometheusFunction'];
  }) {
    const panelTitle = highlight ? `${title} (current)` : title;
    const unit = getUnit(metricName);

    // check if metric is a histogram (either classic or native)
    const isHistogram = metricName.endsWith('_bucket') || isNativeHistogram;

    const isUptime = metricName === 'up' || metricName.endsWith('_up');
    if (isUptime) {
      // For uptime metrics, use a status history panel which is better for binary states
      return buildStatusHistoryPanel({
        panelTitle,
        headerActions,
        // TODO: custom uptime query runner to prevent if/else in buildPrometheusQuery() (see below)
        queryRunner: MetricVizPanel.buildQueryRunner({
          metricName,
          matchers,
          prometheusFunction: 'min',
          isHistogram,
        }),
      })
        .setUnit(unit) // Set the appropriate unit for status history panel as well
        .build();
    }

    if (isHistogram) {
      return buildHeatmapPanel({
        panelTitle,
        color,
        headerActions,
        hideLegend,
        queryRunner: MetricVizPanel.buildQueryRunner({
          metricName,
          matchers,
          prometheusFunction: 'rate',
          isHistogram,
          queryOptions: {
            format: 'heatmap',
          },
        }),
      })
        .setUnit(unit)
        .build();
    }

    // Default settings for non-uptime metrics - use timeseries
    return buildTimeseriesPanel({
      panelTitle,
      headerActions,
      color,
      hideLegend,
      queryRunner: MetricVizPanel.buildQueryRunner({
        metricName,
        matchers,
        prometheusFunction,
        isHistogram,
      }),
    })
      .setUnit(unit) // Set the appropriate unit
      .build();
  }

  private static buildQueryRunner({
    metricName,
    matchers,
    isHistogram,
    prometheusFunction,
    queryOptions = {},
  }: {
    metricName: string;
    matchers: string[];
    isHistogram: boolean;
    prometheusFunction?: PrometheusFn;
    queryOptions?: Partial<SceneDataQuery>;
  }): SceneQueryRunner {
    const filters = matchers.map((matcher) => {
      const [key, value] = matcher.split('=');
      return {
        key,
        value: value.replace(/['"]/g, ''),
        operator: '=',
      };
    });
    const { isRateQuery, groupings } = MetricVizPanel.determineQueryProperties(metricName, isHistogram);
    const expr = buildPrometheusQuery({
      metric: metricName,
      filters,
      isRateQuery,
      useOtelJoin: false,
      ignoreUsage: true,
      groupings,
      ...(prometheusFunction ? { nonRateQueryFunction: prometheusFunction as NonRateQueryFunction } : {}),
    });

    return new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MetricVizPanel.MAX_DATA_POINTS,
      queries: [
        {
          ...queryOptions,
          refId: metricName,
          expr,
          fromExploreMetrics: true,
        },
      ],
    });
  }

  static determineQueryProperties(metricName: string, isHistogram: boolean) {
    const parts = metricName.split('_');
    const suffix = parts.at(-1);

    // Determine if this is a rate query based on metric suffix
    const isRateQuery = rateQueryMetricSuffixes.has(suffix || '');

    // Determine groupings based on metric suffix and native histogram status
    let groupings: string[] | undefined;

    if (isHistogram) {
      groupings = ['le'];
    }

    return { isRateQuery, groupings };
  }

  public static Component = ({ model }: SceneComponentProps<MetricVizPanel>) => {
    const { body, height, highlight } = model.useState();
    const styles = useStyles2(getStyles, height);

    return (
      <div className={cx(styles.container, highlight && styles.highlight)}>
        {body && <body.Component model={body} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, height: string) {
  return {
    container: css({
      height,
    }),
    highlight: css({
      border: `2px solid ${theme.colors.primary.main}`,
    }),
  };
}
