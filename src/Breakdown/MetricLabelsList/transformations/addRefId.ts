import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

export const addRefId = () => (source: Observable<DataFrame[]>) =>
  source.pipe(
    map((data: DataFrame[]) =>
      data?.map((d, i) => {
        d.refId = `${d.refId}-${i}`;
        return d;
      })
    )
  );
