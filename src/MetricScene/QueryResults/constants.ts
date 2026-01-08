import type { DataFrame, LoadingState } from '@grafana/data';
import type { TimeZone } from '@grafana/schema';

// TODO: Use `PluginExtensionExposedComponents.PrometheusQueryResultsV1` when it becomes available from @grafana/data
export const PROMETHEUS_QUERY_RESULTS_COMPONENT_ID = 'grafana/prometheus-query-results/v1';

// TODO: Swap the use of this type in favor of `PrometheusQueryResultsV1Props` from `@grafana/data` when it becomes available
export type PrometheusQueryResultsV1Props = {
  /** Raw DataFrames to display (processing handled internally). Defaults to empty array. */
  tableResult?: DataFrame[];
  /** Width of the container in pixels. Defaults to 800. */
  width?: number;
  /** Timezone for value formatting. Defaults to 'browser'. */
  timeZone?: TimeZone;
  /** Loading state for panel chrome indicator */
  loading?: LoadingState;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Start in Raw view instead of Table view. When true, shows toggle. */
  showRawPrometheus?: boolean;
  /** Callback when user adds a cell filter */
  onCellFilterAdded?: (filter: { key: string; value: string; operator: '=' | '!=' }) => void;
};
