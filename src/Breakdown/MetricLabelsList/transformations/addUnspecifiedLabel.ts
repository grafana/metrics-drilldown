import { type DataFrame } from '@grafana/data';
import { map, type Observable } from 'rxjs';

export const addUnspecifiedLabel = (label: string) => () => (source: Observable<DataFrame[]>) =>
  source.pipe(
    map((data: DataFrame[]) => {
      // eslint-disable-next-line sonarjs/no-nested-functions
      return data?.map((d) => {
        if (!d.fields[1].labels?.[label]) {
          d.fields[1].labels = { ...d.fields[1].labels, [label]: `<unspecified ${label}>` };
        }
        return d;
      });
    })
  );
