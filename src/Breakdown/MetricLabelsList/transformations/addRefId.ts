import { type DataFrame } from '@grafana/data';
import { merge } from 'lodash';
import { map, type Observable } from 'rxjs';

export const addRefId = () => (source: Observable<DataFrame[]>) =>
  source.pipe(map((data: DataFrame[]) => data?.map((d, i) => merge(d, { refId: `${d.refId}-${i}` }))));
