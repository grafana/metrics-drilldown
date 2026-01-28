import { urlUtil, type AdHocVariableFilter, type GetTagResponse, type MetricFindValue } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
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

import { isSceneQueryRunner } from './utils.queries';
import { getClosestScopesFacade } from './utils.scopes';
import { isAdHocFiltersVariable } from './utils.variables';
import { type MetricDatasourceHelper } from '../../AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { ROUTES } from '../constants/routes';

/**
 * Get the DataTrail ancestor for a given scene object.
 */
export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

/**
 * When Metrics Drilldown is embedded in another plugin, we need to use a namespace for the url params
 * to avoid conflicts with other plugins in embedded mode.
 */
export const embeddedTrailNamespace = 'gmd';

/**
 * Create a new DataTrail instance with optional state overrides.
 */
export function newMetricsTrail(state?: Partial<DataTrailState>): DataTrail {
  return new DataTrail({
    initialDS: state?.initialDS,
    $timeRange: state?.$timeRange ?? new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: state?.embedded ?? false,
    embeddedMini: state?.embeddedMini ?? false,
    // Use namespace for embedded mode, skip entirely for embeddedMini (no URL sync)
    urlNamespace: state?.embedded && !state?.embeddedMini ? embeddedTrailNamespace : undefined,
    ...state,
  });
}

/**
 * Get the URL for a given DataTrail instance.
 */
export function getUrlForTrail(trail: DataTrail) {
  const params = sceneUtils.getUrlState(trail);
  return urlUtil.renderUrl(ROUTES.Drilldown, params);
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
 * @param sceneRoot - The root scene object (typically DataTrail) to search for queries
 * @param limitedFilterVariable - The filters variable to configure
 * @param datasourceHelper - Helper for fetching tag keys and values
 */
export function limitAdhocProviders(
  sceneRoot: SceneObject,
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
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? getQueries(sceneRoot) : [],
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
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? getQueries(sceneRoot) : [],
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
