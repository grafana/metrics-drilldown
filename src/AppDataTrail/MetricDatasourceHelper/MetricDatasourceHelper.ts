import {
  type DataSourceGetTagKeysOptions,
  type DataSourceGetTagValuesOptions,
  type MetricFindValue,
  type TimeRange,
} from '@grafana/data';
import {
  type PrometheusDatasource,
  type PromMetricsMetadata,
  type PromMetricsMetadataItem,
  type PromQuery,
} from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, type DataSourceVariable, type SceneObject, type VariableValueOption } from '@grafana/scenes';
import { type Unsubscribable } from 'rxjs';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { displayError, displayWarning } from 'MetricsReducer/helpers/displayStatus';
import { areArraysEqual } from 'MetricsReducer/metrics-variables/helpers/areArraysEqual';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { isClassicHistogramMetric } from 'shared/GmdVizPanel/matchers/isClassicHistogramMetric';
import { isPrometheusDataSource } from 'shared/utils/utils.datasource';

import { languageProviderVersionIs } from './types/language-provider/versionCheck';
import { VAR_DATASOURCE, VAR_DATASOURCE_EXPR, VAR_FILTERS_EXPR } from '../../shared/shared';

/**
 * When we fetch the Prometheus data source with `@grafana/runtime`, its language provider
 * could be one of multiple flavors that we need to support. We use this type to represent
 * the Prometheus data source before we have checked the version of the language provider.
 * The language provider version is then checked with the `languageProviderVersionIs` helper.
 */
export type PrometheusRuntimeDatasource = Omit<PrometheusDatasource, 'languageProvider'> & {
  languageProvider: unknown;
};

export class MetricDatasourceHelper {
  private trail: DataTrail;
  private datasource?: PrometheusRuntimeDatasource;
  private cache = {
    metadata: new Map<string, PromMetricsMetadataItem>(),
    classicHistograms: new Set<string>(),
  };
  private subs: Unsubscribable[] = [];

  constructor(trail: DataTrail) {
    this.trail = trail;
  }

  private async getRuntimeDatasource(): Promise<PrometheusRuntimeDatasource | undefined> {
    if (!this.datasource) {
      const ds = await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this.trail } });
      this.datasource = isPrometheusDataSource(ds) ? ds : undefined;
    }
    return this.datasource;
  }

  public init() {
    this.reset();

    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    this.subs = [];

    const metricsVariable = sceneGraph.findByKeyAndType(this.trail, VAR_METRICS_VARIABLE, MetricsVariable);
    this.subs.push(
      metricsVariable.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.options, prevState.options)) {
          this.onNewMetrics(newState.options);
        }
      })
    );

    const datasourceVariable = sceneGraph.findByKeyAndType(
      this.trail,
      VAR_DATASOURCE,
      MetricsDrilldownDataSourceVariable
    );
    this.subs.push(
      datasourceVariable.subscribeToState(async (newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.reset();
        }
      })
    );

    this.onNewMetrics(metricsVariable.state.options);
  }

  private reset() {
    this.datasource = undefined;

    this.cache = {
      metadata: new Map(),
      classicHistograms: new Set(),
    };

    this.fetchMetricsMetadata().catch(() => {});
  }

  private onNewMetrics(metricsVariableOptions: VariableValueOption[]) {
    for (const metricData of metricsVariableOptions) {
      const name = metricData.value as string;

      if (isClassicHistogramMetric(name)) {
        this.cache.classicHistograms.add(name);
      }
    }
  }

  /**
   * Identify native histograms by 2 strategies.
   * 1. querying classic histograms and all metrics,
   * then comparing the results and build the collection of native histograms.
   * 2. querying all metrics and checking if the metric is a histogram type and does not have the bucket suffix.
   *
   * classic histogram = test_metric_bucket
   * native histogram = test_metric
   */
  public async isNativeHistogram(metric: string): Promise<boolean> {
    if (this.cache.classicHistograms.has(metric)) {
      return false;
    }

    // Prometheus creates a classic histogram metric, which is useful when the metadata is not available
    // TODO: add reference for future review
    if (this.cache.classicHistograms.has(`${metric}_bucket`)) {
      return true;
    }

    try {
      const metadata = await this.getMetadataForMetric(metric);
      return metadata?.type === 'histogram';
    } catch (error) {
      displayWarning([`Error while fetching ${metric} metadata!`, (error as Error).toString()]);
      return false;
    }
  }

  /**
   * We fetch all the metadata at once in init() but it can lead to inconsistencies in the UI because
   * it usually takes a couple of Prometheus scrape intervals to have all the metadata available.
   * Additionally, fetching them separately and caching them once we have a result gives another chance to Prometheus while the user navigates across the app.
   */
  public async getMetadataForMetric(metric: string): Promise<PromMetricsMetadataItem | undefined> {
    if (this.cache.metadata.has(metric)) {
      return this.cache.metadata.get(metric)!;
    }

    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return;
    }

    const response = await (ds.languageProvider as any).request(`/api/v1/metadata?metric=${metric}`);
    const metadata = response[metric]?.[0];

    if (metadata) {
      this.cache.metadata.set(metric, metadata);
    }

    return metadata;
  }

  private async fetchMetricsMetadata() {
    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return;
    }

    const queryMetadata = getQueryMetricsMetadata(ds);
    let metadata = await queryMetadata();

    if (!metadata) {
      const loadMetadata = getLoadMetricsMetadata(ds, queryMetadata);
      metadata = await loadMetadata();
    }

    if (metadata) {
      for (const [metric, metricMetadata] of Object.entries(metadata)) {
        this.cache.metadata.set(metric, metricMetadata);
      }
    }
  }

  public async fetchRecentMetrics({ interval, extraFilter }: { interval: string; extraFilter?: string }) {
    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return [];
    }

    const filters = ['__name__!=""', extraFilter, sceneGraph.interpolate(this.trail, VAR_FILTERS_EXPR)]
      .filter(Boolean)
      .join(',');

    const query = `group by (__name__) ({${filters}}) unless (group by (__name__) ({${filters}} offset ${interval}))`;

    const response = (await (ds.languageProvider as any).request(`/api/v1/query?query=${query}`)) as {
      result: Array<{ metric: { __name__: string } }>;
    };

    if (!Array.isArray(response?.result)) {
      throw new Error(
        `The query to search for recent metrics timed out or failed. Try a shorter time interval and/or add label filters to narrow the search.`
      );
    }

    return response.result.map(({ metric }) => metric.__name__);
  }

  /**
   * Used for additional filtering for adhoc vars labels in Metrics Drilldown.
   * @param options
   * @returns
   */
  public async getTagKeys(options: DataSourceGetTagKeysOptions<PromQuery>): Promise<MetricFindValue[]> {
    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return [];
    }

    const keys = await ds.getTagKeys(options);
    return keys;
  }

  /**
   * Used for additional filtering for adhoc vars label values in Metrics Drilldown.
   * @param options
   * @returns
   */
  public async getTagValues(options: DataSourceGetTagValuesOptions<PromQuery>) {
    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return [];
    }

    options.key = unwrapQuotes(options.key);
    const keys = await ds.getTagValues(options);
    return keys;
  }

  /**
   * Fetches available labels from a Prometheus datasource with version compatibility.
   *
   * This method abstracts the complexity of supporting multiple versions of `@grafana/prometheus`
   * spanning from 11.6.0 up to the latest 12.x versions. It detects which API style the current
   * datasource supports and calls the appropriate method with the correct signature.
   * It handles three different `@grafana/prometheus` API styles:
   *
   * 1. **(12.1.0+)**: Uses the modern `queryLabelKeys` method
   * 2. **(12.0.0)**: Uses `fetchLabelsWithMatch` with timeRange parameter
   * 3. **(11.6.0-11.x)**: Uses `fetchLabelsWithMatch` without timeRange parameter
   *
   * @param params - Configuration object containing datasource, time range, and matcher
   * @param params.ds - The Prometheus datasource instance
   * @param params.timeRange - Time range for the query
   * @param params.matcher - PromQL matcher string to filter labels (e.g., '{job="prometheus"}')
   * @returns Promise that resolves to an array of available label keys
   *
   * @example
   * ```typescript
   * const labels = await MetricDatasourceHelper.fetchLabels({
   *   ds: prometheusDatasource,
   *   timeRange: { from: 'now-1h', to: 'now' },
   *   matcher: '{job="prometheus"}'
   * });
   * ```
   */
  public static fetchLabels(params: FetchLabelsOptions): Promise<string[]> {
    const { timeRange, matcher } = params;
    const ds = params.ds;

    if (languageProviderVersionIs['12.1.0-plus'](ds)) {
      return ds.languageProvider.queryLabelKeys(timeRange, matcher);
    } else if (languageProviderVersionIs['12.0.0'](ds)) {
      return ds.languageProvider.fetchLabelsWithMatch(timeRange, matcher).then((labels) => Object.keys(labels));
    } else if (languageProviderVersionIs['11.6.x'](ds)) {
      return ds.languageProvider.fetchLabelsWithMatch(matcher).then((labels) => Object.keys(labels));
    }

    throw new Error('Unsupported language provider version');
  }

  /**
   * Fetches available values for a specific label from a Prometheus datasource with version compatibility.
   *
   * This method abstracts the complexity of supporting multiple versions of `@grafana/prometheus`
   * spanning from 11.6.0 up to the latest 12.x versions. It detects which API style the current
   * datasource supports and calls the appropriate method with the correct signature.
   * It handles three different `@grafana/prometheus` API styles:
   *
   * 1. **(12.1.0+)**: Uses the modern `queryLabelValues` method
   * 2. **(12.0.0)**: Uses `fetchLabelValues` or `fetchSeriesValuesWithMatch` with timeRange parameter
   * 3. **(11.6.0-11.x)**: Uses `fetchLabelValues` or `fetchSeriesValuesWithMatch` without timeRange parameter
   *
   * @param params - Configuration object containing datasource, label name, time range, and optional matcher
   * @param params.ds - The Prometheus datasource instance
   * @param params.labelName - The name of the label to fetch values for (e.g., 'job', 'instance')
   * @param params.timeRange - Time range for the query
   * @param params.matcher - Optional PromQL matcher string to filter results (e.g., '{job="prometheus"}')
   * @returns Promise that resolves to an array of available values for the specified label
   *
   * @example
   * ```typescript
   * const jobValues = await MetricDatasourceHelper.fetchLabelValues({
   *   ds: prometheusDatasource,
   *   labelName: 'job',
   *   timeRange: { from: 'now-1h', to: 'now' },
   *   matcher: '{__name__=~".*_total"}'
   * });
   * ```
   */
  public static fetchLabelValues(params: FetchLabelValuesOptions) {
    const { labelName, timeRange, matcher = '' } = params;
    const ds = params.ds as PrometheusRuntimeDatasource;

    if (languageProviderVersionIs['12.1.0-plus'](ds)) {
      return ds.languageProvider.queryLabelValues(timeRange, labelName, matcher);
    }

    if (languageProviderVersionIs['12.0.0'](ds)) {
      // If a matcher isn't provided, use the simpler `fetchLabelValues` method.
      const fetchLabelValuesWithOptionalMatcher = matcher
        ? ds.languageProvider.fetchSeriesValuesWithMatch
        : ds.languageProvider.fetchLabelValues;

      return fetchLabelValuesWithOptionalMatcher(timeRange, labelName, matcher);
    }

    if (languageProviderVersionIs['11.6.x'](ds)) {
      // If a matcher isn't provided, use the simpler `fetchLabelValues` method.
      const fetchLabelValuesWithOptionalMatcher = matcher
        ? ds.languageProvider.fetchSeriesValuesWithMatch
        : ds.languageProvider.fetchLabelValues;

      return fetchLabelValuesWithOptionalMatcher(labelName, matcher);
    }

    throw new Error('Unsupported language provider version');
  }

  public static async getPrometheusDataSourceForScene(
    sceneObject: SceneObject
  ): Promise<PrometheusDatasource | undefined> {
    try {
      const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable;
      const uid = (dsVariable?.state.value as string) ?? '';
      const ds = await getDataSourceSrv().get({ uid });

      return ds as unknown as PrometheusDatasource; // we trust that VAR_DATASOURCE has been set to a Prometheus datasource
    } catch (error) {
      displayError(error as Error, ['Error while getting the Prometheus data source!']);
      return undefined;
    }
  }

  public async getPrometheusBuildInfo(): Promise<PrometheusBuildInfo | undefined> {
    const ds = await this.getRuntimeDatasource();
    if (!ds) {
      return;
    }

    // request is part of the base Prometheus language provider interface so we shouldn't have to worry about versioning here
    const response = await (ds.languageProvider as PrometheusDatasource['languageProvider']).request(
      '/api/v1/status/buildinfo'
    );

    if (!response.application) {
      response.application = 'Prometheus';
      response.repository = 'https://github.com/prometheus/prometheus'; // fix typo in response ;)
    }

    if (response.buildDate) {
      response.buildDate = response.buildDate.replace(/(\d{4})(\d{2})(\d{2})(.+)/, '$1-$2-$3');
    }

    return response;
  }
}

export type PrometheusBuildInfo = {
  application?: string;
  version: string;
  buildDate?: string;
  branch?: string;
  repository: string;
  revision: string;
};

interface FetchLabelsOptions {
  ds: PrometheusRuntimeDatasource;
  timeRange: TimeRange;
  matcher: string;
}

interface FetchLabelValuesOptions {
  ds: PrometheusRuntimeDatasource;
  timeRange: TimeRange;
  labelName: string;
  matcher?: string;
}

export function getMetricDescription(metadata?: PromMetricsMetadataItem) {
  if (!metadata) {
    return undefined;
  }

  const { type, help, unit } = metadata;

  const lines = [
    help, //
    type && `**Type:** *${type}*`,
    unit && `**Unit:** ${unit}`,
  ];

  return lines.join('\n\n');
}

function unwrapQuotes(value: string): string {
  if (value === '' || !isWrappedInQuotes(value)) {
    return value;
  }
  return value.slice(1, -1);
}

function isWrappedInQuotes(value: string): boolean {
  const wrappedInQuotes = /^".*"$/;
  return wrappedInQuotes.test(value);
}

function getQueryMetricsMetadata(ds: PrometheusRuntimeDatasource) {
  if (languageProviderVersionIs['12.1.0-plus'](ds)) {
    return ds.languageProvider.queryMetricsMetadata;
  }

  if (languageProviderVersionIs['12.0.0'](ds) || languageProviderVersionIs['11.6.x'](ds)) {
    return () => Promise.resolve(ds.languageProvider.metricsMetadata);
  }

  throw new Error('Unsupported language provider version');
}

function getLoadMetricsMetadata(
  ds: PrometheusRuntimeDatasource,
  queryMetadata: () => Promise<PromMetricsMetadata | undefined>
) {
  if (languageProviderVersionIs['12.1.0-plus'](ds)) {
    return ds.languageProvider.retrieveMetricsMetadata;
  }

  if (languageProviderVersionIs['12.0.0'](ds) || languageProviderVersionIs['11.6.x'](ds)) {
    return () => (ds.languageProvider.loadMetricsMetadata?.() ?? Promise.resolve()).then(() => queryMetadata());
  }

  throw new Error('Unsupported language provider version');
}
