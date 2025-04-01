import { type AdHocVariableFilter } from '@grafana/data';
import { SceneCSSGridItem, sceneGraph, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { type DataTrail } from 'DataTrail';
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

export function getPreviewPanelFor(
  metric: string,
  index: number,
  trail: DataTrail,
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

  const queryExpr = buildPrometheusQuery({
    metric,
    filters: getVariablesFromTrail(trail),
    otelJoinQuery: getOtelJoinQueryFromTrail(trail),
    isRateQuery: autoQuery.preview.queries[0].expr.includes('rate('),
    groupings: autoQuery.preview.queries[0].expr.includes('by(') ? ['le'] : undefined,
    ignoreUsage: true,
  });

  // Override the autoQuery's preview panel query with the one created with `@grafana/promql-builder`
  const queries = [
    {
      ...autoQuery.preview.queries[0],
      expr: queryExpr,
    },
  ];

  return new SceneCSSGridItem({
    $variables: new SceneVariableSet({
      variables: getVariablesWithMetricConstant(metric),
    }),
    $behaviors: [hideEmptyPreviews(metric)],
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MDP_METRIC_PREVIEW,
      queries,
    }),
    body: vizPanel,
  });
}

function getVariablesFromTrail(trail: DataTrail): AdHocVariableFilter[] {
  const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  if (!isAdHocFiltersVariable(filtersVar)) {
    return [];
  }

  return filtersVar.state.filters;
}

function getOtelJoinQueryFromTrail(trail: DataTrail): string {
  const otelJoinQueryVar = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
  if (!isConstantVariable(otelJoinQueryVar) || typeof otelJoinQueryVar.state.value !== 'string') {
    return '';
  }

  return otelJoinQueryVar.state.value;
}
