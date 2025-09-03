import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

const SERIES_COUNT_STATS_NAME = 'seriesCount';

export function sliceSeries(start: number, end: number) {
  // naming so that panel behaviours can inspect the active transformations (e.g. see addCardinalityInfo)
  const sliceSeries = () => (source: Observable<DataFrame[]>) =>
    source.pipe(
      map((data: DataFrame[]) =>
        // eslint-disable-next-line sonarjs/no-nested-functions
        data?.slice(start, end).map((d) => {
          d.meta = { ...d.meta };
          d.meta.stats ||= [];
          d.meta.stats.unshift({ displayName: SERIES_COUNT_STATS_NAME, value: data.length });
          return d;
        })
      )
    );

  // adding a name property so that panel behaviours can inspect the active transformations (e.g. see addCardinalityInfo)
  Object.defineProperty(sliceSeries, '__gmd_name___', {
    value: 'sliceSeries',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return sliceSeries;
}
