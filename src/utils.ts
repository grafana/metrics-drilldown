import { urlUtil, type AdHocVariableFilter, type GetTagResponse, type MetricFindValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  sceneGraph,
  SceneTimeRange,
  sceneUtils,
  type AdHocFiltersVariable,
  type SceneObject,
  type SceneVariable,
  type SceneVariableState,
} from '@grafana/scenes';

import { logger } from 'tracking/logger/logger';

import { ROUTES } from './constants';
import { DataTrail, type DataTrailState } from './DataTrail';
import { type DataTrailSettings } from './DataTrailSettings';
import { type MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { LOGS_METRIC } from './shared';
import { getClosestScopesFacade } from './utils/utils.scopes';
import { isAdHocFiltersVariable } from './utils/utils.variables';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}

export function newMetricsTrail(state?: Partial<DataTrailState>): DataTrail {
  return new DataTrail({
    initialDS: state?.initialDS,
    $timeRange: state?.$timeRange ?? new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: state?.embedded ?? false,
    ...state,
  });
}

export function getUrlForTrail(trail: DataTrail) {
  const params = sceneUtils.getUrlState(trail);
  return urlUtil.renderUrl(ROUTES.Drilldown, params);
}

function getCurrentPath(): Location['pathname'] {
  return window.location.pathname;
}

export function currentPathIncludes(path: string) {
  return getCurrentPath().includes(path);
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
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? dataTrail.getQueries() : [],
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
        queries: limitedFilterVariable.state.useQueriesAsFilterForOptions ? dataTrail.getQueries() : [],
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
