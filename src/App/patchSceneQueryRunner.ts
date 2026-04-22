import { SceneQueryRunner } from '@grafana/scenes';

import { logger } from 'shared/logger/logger';

// Symbol.for uses the global registry so the guard survives HMR and jest.resetModules().
// Symbol() would create a new symbol each module load and break idempotency.
const PATCHED = Symbol.for('metrics-drilldown/patchSceneQueryRunnerFilters');

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
 * DrilldownDependenciesManager.getFilters() ignores the expressionBuilder on AdHocFiltersVariable
 * and always injects raw state.filters. Tracked upstream:
 * TODO: remove this patch once Scenes respects expressionBuilder in DrilldownDependenciesManager
 * https://github.com/grafana/scenes/issues/new (open an issue referencing getFilters / expressionBuilder)
 *
 * __name__ filtering for the metrics list is handled separately by AdHocFiltersForMetricsVariable,
 * which reads VAR_FILTERS.state.filters directly via its own expressionBuilder. That path is
 * unaffected by this patch.
 */
export function patchSceneQueryRunnerFilters() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = SceneQueryRunner.prototype as any;

  if (proto[PATCHED]) {
    return;
  }

  const original = proto.prepareRequests;

  if (typeof original !== 'function') {
    logger.warn('[patchSceneQueryRunner] prepareRequests not found on SceneQueryRunner prototype -- patch NOT applied');
    return;
  }

  const stripNameFilter = (f: { key: string }) => f.key !== '__name__';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto.prepareRequests = function (timeRange: any, ds: any) {
    const result = original.call(this, timeRange, ds);

    if (!result || !result.primary) {
      logger.warn('[patchSceneQueryRunner] prepareRequests returned unexpected shape -- skipping filter strip');
      return result;
    }

    // Only strip for Prometheus: other datasources do not inject request.filters into metric names.
    if (ds?.meta?.id !== 'prometheus') {
      return result;
    }

    if (result.primary.filters) {
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

  proto[PATCHED] = true;
}
