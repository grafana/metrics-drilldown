import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

const SERIES_COUNT_STATS_NAME = 'seriesCount';

export const sliceSeries = (start: number, end: number) => () => (source: Observable<DataFrame[]>) =>
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
