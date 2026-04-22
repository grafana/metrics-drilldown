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
// Minimal shapes for the internal prepareRequests API.
// Typed loosely because this is a private Scenes method; the goal is to avoid
// propagating `any` through our own logic while keeping the prototype cast contained.
type FilterEntry = { key: string; [k: string]: unknown };
type RequestWithFilters = { filters?: FilterEntry[] };
type PrepareRequestsResult = { primary: RequestWithFilters; secondaries?: RequestWithFilters[] } | null | undefined;
type DsArg = { meta?: { id?: string } } | null | undefined;

export function patchSceneQueryRunnerFilters() {
  // `as any` is required: Symbol keys and private methods are not part of the public
  // SceneQueryRunner type, so TypeScript cannot index the prototype without it.
  const proto = SceneQueryRunner.prototype as any;

  if (proto[PATCHED]) {
    return;
  }

  const original = proto.prepareRequests;

  if (typeof original !== 'function') {
    logger.warn('[patchSceneQueryRunner] prepareRequests not found on SceneQueryRunner prototype -- patch NOT applied');
    return;
  }

  const stripNameFilter = (f: FilterEntry) => f.key !== '__name__';

  proto.prepareRequests = function (timeRange: unknown, ds: DsArg): PrepareRequestsResult {
    const result: PrepareRequestsResult = original.call(this, timeRange, ds);

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
