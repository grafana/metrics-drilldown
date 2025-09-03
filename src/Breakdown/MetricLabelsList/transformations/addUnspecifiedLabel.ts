import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

export const addUnspecifiedLabel = (label: string) => {
  // naming so that panel behaviours can inspect the active transformations (e.g. see addCardinalityInfo)
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

  return addUnspecifiedLabel;
};
