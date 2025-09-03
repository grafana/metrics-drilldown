import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

export const addUnspecifiedLabel = (label: string) => {
  const addUnspecifiedLabel = () => (source: Observable<DataFrame[]>) =>
    source.pipe(
      map((data: DataFrame[]) => {
        // eslint-disable-next-line sonarjs/no-nested-functions
        return data?.map((d) => {
          if (!d?.fields[1]) {
            return d;
          }

          if (!d.fields[1].labels?.[label]) {
            d.fields[1].labels = { ...d.fields[1].labels, [label]: `<unspecified ${label}>` };
          }

          return d;
        });
      })
    );

  // adding a name property so that panel behaviours can inspect the active transformations (e.g. see addCardinalityInfo)
  Object.defineProperty(addUnspecifiedLabel, '__gmd_name___', {
    value: 'addUnspecifiedLabel',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return addUnspecifiedLabel;
};
