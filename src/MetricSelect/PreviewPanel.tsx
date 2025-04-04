import {
  SceneCSSGridItem,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { isAdHocFiltersVariable } from 'utils/utils.variables';

import { buildPrometheusQuery } from '../autoQuery/buildPrometheusQuery';
import { heatmapGraphBuilder, simpleGraphBuilder } from '../autoQuery/graphBuilders';
import { getUnit } from '../autoQuery/units';
import { PanelMenu } from '../Menu/PanelMenu';
import { getVariablesWithMetricConstant, MDP_METRIC_PREVIEW, trailDS, VAR_FILTERS } from '../shared';
import { getColorByIndex } from '../utils';
import { hideEmptyPreviews } from './hideEmptyPreviews';
import { NativeHistogramBadge } from './NativeHistogramBadge';
import { SelectMetricAction } from './SelectMetricAction';

interface PreviewPanelState extends SceneObjectState {
  body: SceneObject;
  metric: string;
  hasOtelResources: boolean;
  nativeHistogram?: boolean;
}

export class PreviewPanel extends SceneObjectBase<PreviewPanelState> {
  protected _variableDependency: VariableDependencyConfig<PreviewPanelState>;

  constructor(params: PreviewPanelState) {
    super(params);

    this._variableDependency = new VariableDependencyConfig<PreviewPanelState>(this, {
      variableNames: [VAR_FILTERS],
      onReferencedVariableValueChanged: () => {
        this.updateQuery();
      },
    });

    // Initial query setup
    this.updateQuery();
  }

  private updateQuery() {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const filters = isAdHocFiltersVariable(filtersVar) ? filtersVar.state.filters : [];

    // Determine if this is a rate query and what groupings to use based on metric name
    const { isRateQuery, groupings } = this.determineQueryProperties();

    const queryExpr = buildPrometheusQuery({
      metric: this.state.metric,
      filters,
      isRateQuery,
      groupings,
      ignoreUsage: true,
      useOtelJoin: this.state.hasOtelResources,
    });

    this.setState({
      $data: new SceneQueryRunner({
        datasource: trailDS,
        maxDataPoints: MDP_METRIC_PREVIEW,
        queries: [
          {
            refId: 'A',
            expr: queryExpr,
            legendFormat: this.state.metric,
          },
        ],
      }),
    });
  }

  private determineQueryProperties() {
    const metric = this.state.metric;
    const parts = metric.split('_');
    const suffix = parts.at(-1);

    // Determine if this is a rate query based on metric suffix
    const isRateForSuffix = new Set(['count', 'total', 'sum', 'bucket']);
    const isRateQuery = isRateForSuffix.has(suffix || '');

    // Determine groupings based on metric suffix and native histogram status
    let groupings: string[] | undefined;
    if (suffix === 'bucket' || this.state.nativeHistogram) {
      groupings = ['le'];
    }

    return { isRateQuery, groupings };
  }

  static Component = ({ model }: SceneComponentProps<PreviewPanel>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}

export function getPreviewPanelFor(
  metric: string,
  index: number,
  hasOtelResources: boolean,
  description?: string,
  nativeHistogram?: boolean,
  hideMenu?: boolean
) {
  const parts = metric.split('_');
  const suffix = parts.at(-1);
  const unitSuffix = parts.at(-2);
  const unit = getUnit(unitSuffix);

  let actions: Array<SelectMetricAction | NativeHistogramBadge> = [new SelectMetricAction({ metric, title: 'Select' })];

  if (nativeHistogram) {
    actions.unshift(new NativeHistogramBadge({}));
  }

  // Choose the appropriate visualization based on the metric's suffix
  const isHistogram = suffix === 'bucket' || nativeHistogram;

  let vizPanelBuilder = isHistogram
    ? heatmapGraphBuilder({ title: metric, unit })
    : simpleGraphBuilder({ title: metric, unit });

  vizPanelBuilder = vizPanelBuilder
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setDescription(description)
    .setHeaderActions(actions)
    .setShowMenuAlways(true);

  if (!hideMenu) {
    vizPanelBuilder = vizPanelBuilder.setMenu(new PanelMenu({ labelName: metric }));
  }

  const vizPanel = vizPanelBuilder.build();

  return new SceneCSSGridItem({
    body: new PreviewPanel({
      $behaviors: [hideEmptyPreviews(metric)],
      $variables: new SceneVariableSet({
        variables: getVariablesWithMetricConstant(metric),
      }),
      body: vizPanel,
      metric,
      hasOtelResources,
      nativeHistogram,
    }),
  });
}
