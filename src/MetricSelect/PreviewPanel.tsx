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

import { type AutoQueryDef } from 'autoQuery/types';
import { isAdHocFiltersVariable, isConstantVariable } from 'utils/utils.variables';

import { buildPrometheusQuery } from '../autoQuery/buildPrometheusQuery';
import { getAutoQueriesForMetric } from '../autoQuery/getAutoQueriesForMetric';
import { PanelMenu } from '../Menu/PanelMenu';
import {
  getVariablesWithMetricConstant,
  MDP_METRIC_PREVIEW,
  trailDS,
  VAR_FILTERS,
  VAR_OTEL_JOIN_QUERY,
} from '../shared';
import { getColorByIndex } from '../utils';
import { hideEmptyPreviews } from './hideEmptyPreviews';
import { NativeHistogramBadge } from './NativeHistogramBadge';
import { SelectMetricAction } from './SelectMetricAction';

interface PreviewPanelState extends SceneObjectState {
  autoQueryDef: AutoQueryDef;
  body: SceneObject;
  metric: string;
}

export class PreviewPanel extends SceneObjectBase<PreviewPanelState> {
  protected _variableDependency: VariableDependencyConfig<PreviewPanelState>;

  constructor(params: PreviewPanelState) {
    super(params);

    this._variableDependency = new VariableDependencyConfig<PreviewPanelState>(this, {
      variableNames: [VAR_FILTERS, VAR_OTEL_JOIN_QUERY],
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

    const otelJoinQueryVar = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);
    const otelJoinQuery =
      isConstantVariable(otelJoinQueryVar) && typeof otelJoinQueryVar.state.value === 'string'
        ? otelJoinQueryVar.state.value
        : '';

    // TODO: remove dependency on `autoQuery`
    const autoQuery = this.state.autoQueryDef.queries[0];

    const queryExpr = buildPrometheusQuery({
      metric: this.state.metric,
      filters,
      otelJoinQuery,
      isRateQuery: autoQuery.expr.includes('rate('),
      groupings: autoQuery.expr.includes('by(') ? ['le'] : undefined,
      ignoreUsage: true,
    });

    this.setState({
      $data: new SceneQueryRunner({
        datasource: trailDS,
        maxDataPoints: MDP_METRIC_PREVIEW,
        queries: [
          {
            ...autoQuery,
            expr: queryExpr,
          },
        ],
      }),
    });
  }

  static Component = ({ model }: SceneComponentProps<PreviewPanel>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };
}

export function getPreviewPanelFor(
  metric: string,
  index: number,
  description?: string,
  nativeHistogram?: boolean,
  hideMenu?: boolean
) {
  const autoQuery = getAutoQueriesForMetric(metric, nativeHistogram);
  let actions: Array<SelectMetricAction | NativeHistogramBadge> = [new SelectMetricAction({ metric, title: 'Select' })];

  if (nativeHistogram) {
    actions.unshift(new NativeHistogramBadge({}));
  }

  let vizPanelBuilder = autoQuery.preview
    .vizBuilder()
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
    .setDescription(description)
    .setHeaderActions(actions)
    .setShowMenuAlways(true)
    .setMenu(new PanelMenu({ labelName: metric }));

  if (!hideMenu) {
    vizPanelBuilder = vizPanelBuilder.setShowMenuAlways(true).setMenu(new PanelMenu({ labelName: metric }));
  }

  const vizPanel = vizPanelBuilder.build();

  return new SceneCSSGridItem({
    body: new PreviewPanel({
      $behaviors: [hideEmptyPreviews(metric)],
      $variables: new SceneVariableSet({
        variables: getVariablesWithMetricConstant(metric),
      }),
      autoQueryDef: autoQuery.preview,
      body: vizPanel,
      metric,
    }),
  });
}
