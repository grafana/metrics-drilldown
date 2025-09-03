import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

export const addRefId = () => {
  const addRefId = (source: Observable<DataFrame[]>) =>
    source.pipe(
      map((data: DataFrame[]) =>
        data?.map((d, i) => {
          d.refId = `${d.refId}-${i}`;
          return d;
        })
      )
    );

  // adding a name property so that panel behaviours can inspect the active transformations (e.g. see addCardinalityInfo)
  Object.defineProperty(addRefId, '__gmd_name___', {
    value: 'addRefId',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return addRefId;
};
