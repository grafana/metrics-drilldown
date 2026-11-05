import { buildSemconvIndex, type SemconvIndex } from './semconvIndex';
import { type SemconvData } from './types';

let indexPromise: Promise<SemconvIndex> | undefined;
let loadedIndex: SemconvIndex | undefined;

/**
 * Loads the generated semconv data in its own chunk and builds the lookup index. The promise is memoized,
 * and cleared on failure so a later call can retry. Callers should render without enrichment until it
 * resolves and treat a rejection as "no semconv info".
 */
export function loadSemconvIndex(): Promise<SemconvIndex> {
  indexPromise ??= import('./semconv.generated.json')
    .then((module) => {
      loadedIndex = buildSemconvIndex(module.default as unknown as SemconvData);
      return loadedIndex;
    })
    .catch((error: unknown) => {
      indexPromise = undefined;
      throw error;
    });
  return indexPromise;
}

/** Returns the index once loadSemconvIndex has resolved, for synchronous render paths. */
export function getLoadedSemconvIndex(): SemconvIndex | undefined {
  return loadedIndex;
}
