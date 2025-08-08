import {
  type AbstractQuery,
  type AdHocVariableFilter,
  type LanguageProvider,
  type Scope,
  type TimeRange,
} from '@grafana/data';
import { type PrometheusDatasource, type PromMetricsMetadata, type PromQuery } from '@grafana/prometheus';
import { type BackendSrvRequest } from '@grafana/runtime';

import { type PromQLLabelMatcher } from 'extensions/links';
import { type PrometheusRuntimeDatasource } from 'helpers/MetricDatasourceHelper';

export interface PromQlLanguageProviderTwelveDotZero extends LanguageProvider {
  histogramMetrics: string[];
  metrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  startTask: Promise<any>;
  datasource: PrometheusDatasource;
  labelKeys: string[];
  labelFetchTs: number;
  getDefaultCacheHeaders():
    | {
        headers: {
          'X-Grafana-Cache': string;
        };
      }
    | undefined;
  cleanText(s: string): string;
  get syntax(): Prism.Grammar;
  request: (url: string, defaultValue: any, params?: {}, options?: Partial<BackendSrvRequest>) => Promise<any>;
  start: (timeRange?: TimeRange) => Promise<any[]>;
  loadMetricsMetadata(): Promise<void>;
  getLabelKeys(): string[];
  importFromAbstractQuery(labelBasedQuery: AbstractQuery): PromQuery;
  exportToAbstractQuery(query: PromQuery): AbstractQuery;
  getSeries(timeRange: TimeRange, selector: string, withName?: boolean): Promise<Record<string, string[]>>;
  fetchLabelValues: (range: TimeRange, key: string) => Promise<string[]>;
  getLabelValues(range: TimeRange, key: string): Promise<string[]>;
  /**
   * Fetches all label keys
   */
  fetchLabels: (timeRange: TimeRange, queries?: PromQuery[]) => Promise<string[]>;
  /**
   * Gets series values
   * Function to replace old getSeries calls in a way that will provide faster endpoints
   * for new prometheus instances, while maintaining backward compatability
   */
  getSeriesValues: (timeRange: TimeRange, labelName: string, selector: string) => Promise<string[]>;
  /**
   * Fetches all values for a label, with optional match[]
   * @param name
   * @param match
   * @param timeRange
   * @param requestId
   */
  fetchSeriesValuesWithMatch: (
    timeRange: TimeRange,
    name: string,
    match: string,
    requestId?: string
  ) => Promise<string[]>;
  /**
   * Gets series labels
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability. The old API call got the labels and the values in a single query,
   * but with the new query we need two calls, one to get the labels, and another to get the values.
   *
   * @param selector
   * @param otherLabels
   */
  getSeriesLabels: (timeRange: TimeRange, selector: string, otherLabels: PromQLLabelMatcher[]) => Promise<string[]>;
  /**
   * Fetch labels using the best endpoint that datasource supports.
   * This is cached by its args but also by the global timeRange currently selected as they can change over requested time.
   */
  fetchLabelsWithMatch: (timeRange: TimeRange, name: string, withName?: boolean) => Promise<Record<string, string[]>>;
  /**
   * Fetch labels for a series using /series endpoint. This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   */
  fetchSeriesLabels: (
    timeRange: TimeRange,
    name: string,
    withName?: boolean,
    withLimit?: string
  ) => Promise<Record<string, string[]>>;
  /**
   * Fetch labels for a series using /labels endpoint.  This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   */
  fetchSeriesLabelsMatch: (timeRange: TimeRange, name: string, withName?: boolean) => Promise<Record<string, string[]>>;
  /**
   * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
   */
  fetchSeries: (timeRange: TimeRange, match: string) => Promise<Array<Record<string, string>>>;
  /**
   * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
   * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
   * fetchSeriesLabels.
   */
  fetchDefaultSeries: (timeRange: TimeRange) => Promise<{}>;
  /**
   * Fetch labels or values for a label based on the queries, scopes, filters and time range
   * @param timeRange
   * @param queries
   * @param scopes
   * @param adhocFilters
   * @param labelName
   * @param limit
   * @param requestId
   */
  fetchSuggestions: (
    timeRange?: TimeRange,
    queries?: PromQuery[],
    scopes?: Scope[],
    adhocFilters?: AdHocVariableFilter[],
    labelName?: string,
    limit?: number,
    requestId?: string
  ) => Promise<string[]>;
}

export function isPrometheusDatasourceV12_0_0(ds: PrometheusRuntimeDatasource): ds is PrometheusRuntimeDatasource & {
  languageProvider: PromQlLanguageProviderTwelveDotZero;
} {
  const languageProvider = ds.languageProvider as PromQlLanguageProviderTwelveDotZero;

  // eslint-disable-next-line sonarjs/deprecation
  return typeof languageProvider.fetchLabelValues === 'function' && languageProvider.fetchLabelValues.length > 1;
}
