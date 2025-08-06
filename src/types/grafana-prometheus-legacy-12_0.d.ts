import type { TimeRange } from '@grafana/data';
import type { PromMetricsMetadata, PromQuery } from '@grafana/prometheus';

/**
 * Augment `@grafana/prometheus`' `PrometheusLanguageProviderInterface` interface
 * to preserve deprecated methods that are being removed in 12.2.x.
 *
 * @remarks
 * This is a temporary solution. We can remove this (and the usage of the deprecated
 * methods in MetricDatasourceHelper) once we upgrade Metrics Drilldown App's minimum
 * Grafana version to 12.2.0 or higher.
 *
 * @remarks
 * See https://github.com/grafana/grafana/pull/108352 for context on the removal of the
 * deprecated language provider methods.
 */
declare module '@grafana/prometheus' {
  // eslint-disable-next-line no-unused-vars
  interface PrometheusLanguageProviderInterface {
    /**
     * @deprecated Use retrieveHistogramMetrics() method instead
     */
    histogramMetrics?: string[];

    /**
     * @deprecated Use retrieveMetrics() method instead
     */
    metrics?: string[];

    /**
     * @deprecated Use retrieveMetricsMetadata() method instead
     */
    metricsMetadata?: PromMetricsMetadata;

    /**
     * @deprecated Use retrieveLabelKeys() method instead
     */
    labelKeys?: string[];

    /**
     * @deprecated Use queryMetricsMetadata() method instead.
     */
    loadMetricsMetadata?: () => void;

    /**
     * @deprecated Use retrieveMetricsMetadata() method instead
     */
    getLabelKeys?: () => string[];

    /**
     * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
     */
    getSeries?(timeRange: TimeRange, selector: string, withName?: boolean): Promise<Record<string, string[]>>;

    /**
     * @deprecated Use queryLabelValues() method instead. It'll determine the right endpoint based on the datasource settings
     */
    fetchLabelValues?(range: TimeRange, key: string, limit?: string | number): Promise<string[]>;

    /**
     * @deprecated Use queryLabelValues() method instead. It'll determine the right endpoint based on the datasource settings
     */
    getLabelValues?(range: TimeRange, key: string): Promise<string[]>;

    /**
     * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
     */
    fetchLabels?(timeRange: TimeRange, queries?: PromQuery[], limit?: string): Promise<string[]>;

    /**
     * @deprecated Use queryLabelValues() method instead. It'll determine the right endpoint based on the datasource settings
     */
    getSeriesValues?(timeRange: TimeRange, labelName: string, selector: string): Promise<string[]>;

    /**
     * @deprecated Use queryLabelValues() method instead. It'll determine the right endpoint based on the datasource settings
     */
    fetchSeriesValuesWithMatch?(
      timeRange: TimeRange,
      name: string,
      match?: string,
      requestId?: string,
      withLimit?: string | number
    ): Promise<string[]>;

    /**
     * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
     */
    getSeriesLabels?(timeRange: TimeRange, selector: string, otherLabels: any[]): Promise<string[]>;

    /**
     * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
     */
    fetchLabelsWithMatch?(
      timeRange: TimeRange,
      name: string,
      withName?: boolean,
      withLimit?: string | number
    ): Promise<Record<string, string[]>>;

    /**
     * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
     */
    fetchSeriesLabels?(
      timeRange: TimeRange,
      name: string,
      withName?: boolean,
      withLimit?: string | number
    ): Promise<Record<string, string[]>>;

    /**
     * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
     */
    fetchSeriesLabelsMatch?(
      timeRange: TimeRange,
      name: string,
      withLimit?: string | number
    ): Promise<Record<string, string[]>>;

    /**
     * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
     */
    fetchSeries?(timeRange: TimeRange, match: string): Promise<Array<Record<string, string>>>;

    /**
     * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
     */
    fetchDefaultSeries?(timeRange: TimeRange): Promise<{}>;
  }
}
