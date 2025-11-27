import { urlUtil, type AdHocVariableFilter, type GetTagResponse, type MetricFindValue } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import {
  sceneGraph,
  SceneTimeRange,
  sceneUtils,
  type AdHocFiltersVariable,
  type SceneObject,
  type SceneQueryRunner,
  type SceneVariable,
  type SceneVariableState,
} from '@grafana/scenes';

import { DataTrail, type DataTrailState } from 'AppDataTrail/DataTrail';
import { logger } from 'shared/logger/logger';
import { isSceneQueryRunner } from 'shared/utils/utils.queries';

import { ROUTES } from '../constants/routes';
import { LOGS_METRIC } from '../shared';
import { getClosestScopesFacade } from './utils.scopes';
import { isAdHocFiltersVariable } from './utils.variables';
import { type MetricDatasourceHelper } from '../../AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

/**
 * When Metrics Drilldown is embedded in another plugin, we need to use a namespace for the url params
 * to avoid conflicts with other plugins in embedded mode.
 */
export const embeddedTrailNamespace = 'gmd';

export function newMetricsTrail(state?: Partial<DataTrailState>): DataTrail {
  return new DataTrail({
    initialDS: state?.initialDS,
    $timeRange: state?.$timeRange ?? new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: state?.embedded ?? false,
    urlNamespace: state?.embedded ? embeddedTrailNamespace : undefined,
    ...state,
  });
}

export function getUrlForTrail(trail: DataTrail) {
  const params = sceneUtils.getUrlState(trail);
  return urlUtil.renderUrl(ROUTES.Drilldown, params);
}

export function getMetricName(metric?: string) {
  if (!metric) {
    return 'All metrics';
  }

  if (metric === LOGS_METRIC) {
    return 'Logs';
  }

  return metric;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

function getQueries(sceneObject: SceneObject): PromQuery[] {
  const allQueryRunners = sceneGraph.findAllObjects(sceneObject, isSceneQueryRunner) as SceneQueryRunner[];
  return allQueryRunners.flatMap((sqr) =>
    sqr.state.queries.map((q) => ({ ...q, expr: sceneGraph.interpolate(sqr, q.expr) }))
  );
}

// frontend hardening limit
const MAX_ADHOC_VARIABLE_OPTIONS = 10000;

/**
 * Add custom providers for the adhoc filters variable that limit the responses for labels keys and label values.
 * Currently hard coded to 10000.
 *
 * The current provider functions for adhoc filter variables are the functions getTagKeys and getTagValues in the data source.
 * This function still uses these functions from inside the data source helper.
 *
 * @param dataTrail
 * @param limitedFilterVariable this is the filters variable
 * @param datasourceHelper
 */
export function limitAdhocProviders(
  dataTrail: DataTrail,
  limitedFilterVariable: SceneVariable<SceneVariableState> | null,
  datasourceHelper: MetricDatasourceHelper
) {
  if (!isAdHocFiltersVariable(limitedFilterVariable)) {
    return;
  }

  limitedFilterVariable.setState({
    getTagKeysProvider: async (): Promise<{
      replace?: boolean;
      values: GetTagResponse | MetricFindValue[];
    }> => {
      // For the Prometheus label names endpoint, '/api/v1/labels'
      // get the previously selected filters from the variable
      // to use in the query to filter the response
      // using filters, e.g. {previously_selected_label:"value"},
      // as the series match[] parameter in Prometheus labels endpoint
      const filters = limitedFilterVariable.state.filters;
      // call getTagKeys and truncate the response
      // we're passing the queries so we get the labels that adhere to the queries
      // we're also passing the scopes so we get the labels that adhere to the scopes filters

      const opts = {
        filters,
        scopes: getClosestScopesFacade()?.value,
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? getQueries(dataTrail) : [],
      };

      // if there are too many queries it takes to much time to process the requests.
      // In this case we favour responsiveness over reducing the number of options.
      if (opts.queries.length > 20) {
        opts.queries = [];
      }

      let values = (await datasourceHelper.getTagKeys(opts)).slice(0, MAX_ADHOC_VARIABLE_OPTIONS);

      // use replace: true to override the default lookup in adhoc filter variable
      return { replace: true, values };
    },
    getTagValuesProvider: async (
      _: AdHocFiltersVariable,
      filter: AdHocVariableFilter
    ): Promise<{
      replace?: boolean;
      values: GetTagResponse | MetricFindValue[];
    }> => {
      // For the Prometheus label values endpoint, /api/v1/label/${interpolatedName}/values
      // get the previously selected filters from the variable
      // to use in the query to filter the response
      // using filters, e.g. {previously_selected_label:"value"},
      // as the series match[] parameter in Prometheus label values endpoint
      const filtersValues = limitedFilterVariable.state.filters;
      // remove current selected filter if updating a chosen filter
      const filters = filtersValues.filter((f) => f.key !== filter.key);
      // call getTagValues and truncate the response
      // we're passing the queries so we get the label values that adhere to the queries
      // we're also passing the scopes so we get the label values that adhere to the scopes filters

      const opts = {
        key: filter.key,
        filters,
        scopes: getClosestScopesFacade()?.value,
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? getQueries(dataTrail) : [],
      };

      // if there are too many queries it takes to much time to process the requests.
      // In this case we favour responsiveness over reducing the number of options.
      if (opts.queries.length > 20) {
        opts.queries = [];
      }

      const values = (await datasourceHelper.getTagValues(opts)).slice(0, MAX_ADHOC_VARIABLE_OPTIONS);
      // use replace: true to override the default lookup in adhoc filter variable
      return { replace: true, values };
    },
  });
}

interface SceneType<T> extends Function {
  new (...args: never[]): T;
}

export function findObjectOfType<T extends SceneObject>(
  scene: SceneObject,
  check: (obj: SceneObject) => boolean,
  returnType: SceneType<T>
) {
  const obj = sceneGraph.findObject(scene, check);
  if (obj instanceof returnType) {
    return obj;
  } else if (obj !== null) {
    logger.warn(`invalid return type: ${returnType.toString()}`);
  }

  return null;
}

export function noOp() {}

/**
 * Helper function to cast `Object.values` to the correct, narrowed type
 * @param obj - The object to get the values from
 * @returns The values of the object
 */
export function getObjectValues<T extends Record<string, unknown>>(obj: T): ReadonlyArray<T[keyof T]> {
  return Object.values(obj) as ReadonlyArray<T[keyof T]>;
}
