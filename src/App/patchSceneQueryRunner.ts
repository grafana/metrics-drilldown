import { logger } from 'shared/logger/logger';
import { SceneQueryRunner } from '@grafana/scenes';

let patched = false;

/**
 * Patches SceneQueryRunner.prototype.prepareRequests to strip __name__ from request.filters
 * before they reach the Prometheus datasource.
 *
 * Root cause: Scenes' DrilldownDependenciesManager finds VAR_FILTERS (because its datasource
 * UID matches the panel datasource UID) and passes ALL its filters, including __name__, as
 * request.filters. The Prometheus datasource then injects request.filters as label matchers
 * into every panel expression. A panel expression already contains the metric name, so having
 * __name__=~".*" also injected causes Prometheus to error: "metric name must not be set twice".
 *
 * __name__ filtering for the metrics list is handled separately by AdHocFiltersForMetricsVariable,
 * which reads VAR_FILTERS.state.filters directly via its own expressionBuilder. That path is
 * unaffected by this patch.
 */
export function patchSceneQueryRunnerFilters() {
  if (patched) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = SceneQueryRunner.prototype as any;
  const original = proto.prepareRequests;

  if (typeof original !== 'function') {
    logger.warn('[patchSceneQueryRunner] prepareRequests not found on SceneQueryRunner prototype -- patch NOT applied');
    return;
  }

  const stripNameFilter = (f: { key: string }) => f.key !== '__name__';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto.prepareRequests = function (timeRange: any, ds: any) {
    const result = original.call(this, timeRange, ds);
    if (result.primary?.filters) {
      result.primary.filters = result.primary.filters.filter(stripNameFilter);
    }
    // Secondaries are built from the primary request before our patch runs,
    // so clean them too in case any ExtraQueryProvider copied primary.filters.
    for (const secondary of result.secondaries ?? []) {
      if (secondary?.filters) {
        secondary.filters = secondary.filters.filter(stripNameFilter);
      }
    }
    return result;
  };

  patched = true;
}
