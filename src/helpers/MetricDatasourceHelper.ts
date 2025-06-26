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
import { sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';

import { displayError } from 'WingmanDataTrail/helpers/displayStatus';

import { type DataTrail } from '../DataTrail';
import { VAR_DATASOURCE, VAR_DATASOURCE_EXPR } from '../shared';
import { isPrometheusDataSource } from '../utils/utils.datasource';

export class MetricDatasourceHelper {
  constructor(trail: DataTrail) {
    this._trail = trail;
  }

  public reset() {
    this._datasource = undefined;
    this._metricsMetadata = undefined;
    this._classicHistograms = {};
    this._nativeHistograms = [];
  }

  private _trail: DataTrail;

  private _datasource?: PrometheusDatasource;

  private async getDatasource() {
    if (this._datasource) {
      return this._datasource;
    }

    const ds = await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this._trail } });

    if (isPrometheusDataSource(ds)) {
      this._datasource = ds;
    }

    return this._datasource;
  }

  // store metadata in a more easily accessible form
  _metricsMetadata?: PromMetricsMetadata;

  private async _ensureMetricsMetadata(): Promise<void> {
    if (this._metricsMetadata) {
      return;
    }

    await this._getMetricsMetadata();
  }

  private async _getMetricsMetadata(): Promise<void> {
    const ds = await this.getDatasource();

    if (!ds) {
      return;
    }

    const queryMetadata =
      typeof ds.languageProvider.queryMetricsMetadata === 'function'
        ? ds.languageProvider.queryMetricsMetadata
        : () => Promise.resolve(ds.languageProvider.metricsMetadata); // eslint-disable-line sonarjs/deprecation

    const loadMetadata =
      typeof ds.languageProvider.retrieveMetricsMetadata === 'function'
        ? () => Promise.resolve(ds.languageProvider.retrieveMetricsMetadata())
        : () => (ds.languageProvider.loadMetricsMetadata as unknown as Promise<void>).then(queryMetadata); // eslint-disable-line sonarjs/deprecation

    let metadata = await queryMetadata();

    if (!metadata) {
      metadata = await loadMetadata();
    }

    this._metricsMetadata = metadata;
  }

  public async getMetadataForMetric(metric?: string) {
    if (!metric) {
      return undefined;
    }
    await this._ensureMetricsMetadata();

    return this._metricsMetadata?.[metric];
  }

  private _classicHistograms: Record<string, number> = {};
  private _nativeHistograms: string[] = [];

  public listNativeHistograms() {
    return this._nativeHistograms;
  }

  /**
   * Identify native histograms by 2 strategies.
   * 1. querying classic histograms and all metrics,
   * then comparing the results and build the collection of native histograms.
   * 2. querying all metrics and checking if the metric is a histogram type and dies not have the bucket suffix.
   *
   * classic histogram = test_metric_bucket
   * native histogram = test_metric
   */
  public async initializeHistograms() {
    const ds = await this.getDatasource();
    if (ds && Object.keys(this._classicHistograms).length === 0) {
      const classicHistogramsCall = ds.metricFindQuery('metrics(.*_bucket)');
      const allMetricsCall = ds.metricFindQuery('metrics(.+)');

      const [classicHistograms, allMetrics] = await Promise.all([classicHistogramsCall, allMetricsCall]);

      classicHistograms.forEach((m) => {
        this._classicHistograms[m.text] = 1;
      });

      await this._ensureMetricsMetadata();

      allMetrics.forEach((m) => {
        if (this.isNativeHistogram(m.text)) {
          // Build the collection of native histograms.
          this.addNativeHistogram(m.text);
        }
      });
    }
  }

  /**
   * Identify native histograms by 2 strategies.
   * 1. querying classic histograms and all metrics,
   * then comparing the results and build the collection of native histograms.
   * 2. querying all metrics and checking if the metric is a histogram type and dies not have the bucket suffix.
   *
   * classic histogram = test_metric_bucket
   * native histogram = test_metric
   *
   * @param metric
   * @returns boolean
   */
  public isNativeHistogram(metric: string): boolean {
    if (!metric) {
      return false;
    }

    // check when fully migrated, we only have metadata, and there are no more classic histograms
    const metadata = this._metricsMetadata;
    // suffix is not 'bucket' and type is histogram
    const suffix: string = metric.split('_').pop() ?? '';
    // the string is not equal to bucket
    const notClassic = suffix !== 'bucket';
    if (metadata?.[metric]?.type === 'histogram' && notClassic) {
      return true;
    }

    // check for comparison when there is overlap between native and classic histograms
    return this._classicHistograms[`${metric}_bucket`] > 0;
  }

  private addNativeHistogram(metric: string) {
    if (!this._nativeHistograms.includes(metric)) {
      this._nativeHistograms.push(metric);
    }
  }

  /**
   * Used for additional filtering for adhoc vars labels in Metrics Drilldown.
   * @param options
   * @returns
   */
  public async getTagKeys(options: DataSourceGetTagKeysOptions<PromQuery>): Promise<MetricFindValue[]> {
    const ds = await this.getDatasource();

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
    const ds = await this.getDatasource();

    if (!ds) {
      return [];
    }

    options.key = unwrapQuotes(options.key);
    const keys = await ds.getTagValues(options);
    return keys;
  }

  /**
   * Check if the datasource uses time range in language provider methods.
   * @param ds
   * @returns boolean
   * @remarks
   * This is a hack to check if the datasource uses time range in language provider methods.
   * It will be removed when we upgrade the Grafana dependency to 12.0.0.
   * For more details, see https://github.com/grafana/metrics-drilldown/issues/370.
   */
  public static datasourceUsesTimeRangeInLanguageProviderMethods(ds: PrometheusDatasource): boolean {
    // This works because the `fetchLabelValues` method happens to have changed in a way that
    // can be used as a heuristic to check if the runtime datasource uses the G12-style
    // language provider methods introduced in https://github.com/grafana/grafana/pull/101889.
    return ds.languageProvider.fetchLabelValues.length > 1; // eslint-disable-line sonarjs/deprecation
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
    const { ds, timeRange, matcher } = params;

    if (typeof ds.languageProvider.queryLabelKeys === 'function') {
      return ds.languageProvider.queryLabelKeys(timeRange, matcher);
    }

    if (MetricDatasourceHelper.datasourceUsesTimeRangeInLanguageProviderMethods(ds)) {
      // eslint-disable-next-line sonarjs/deprecation
      return ds.languageProvider.fetchLabelsWithMatch(timeRange, matcher).then((labels) => Object.keys(labels));
    }

    // @ts-expect-error: Ignoring type error due to breaking change in fetchLabelsWithMatch signature
    return ds.languageProvider.fetchLabelsWithMatch(matcher).then((labels) => Object.keys(labels)); // eslint-disable-line sonarjs/deprecation
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
   * 2. **(12.0.0)**: Uses `fetchSeriesValuesWithMatch` with timeRange parameter
   * 3. **(11.6.0-11.x)**: Uses `fetchSeriesValuesWithMatch` without timeRange parameter
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
    const { ds, labelName, timeRange, matcher } = params;

    if (typeof ds.languageProvider.queryLabelValues === 'function') {
      return ds.languageProvider.queryLabelValues(timeRange, labelName, matcher);
    }

    if (MetricDatasourceHelper.datasourceUsesTimeRangeInLanguageProviderMethods(ds)) {
      // eslint-disable-next-line sonarjs/deprecation
      return ds.languageProvider.fetchSeriesValuesWithMatch(timeRange, '__name__', matcher);
    }

    // @ts-expect-error: Ignoring type error due to breaking change in fetchSeriesValuesWithMatch signature
    return ds.languageProvider.fetchSeriesValuesWithMatch('__name__', matcher); // eslint-disable-line sonarjs/deprecation
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
}

interface FetchLabelsOptions {
  ds: PrometheusDatasource;
  timeRange: TimeRange;
  matcher: string;
}

interface FetchLabelValuesOptions {
  ds: PrometheusDatasource;
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
