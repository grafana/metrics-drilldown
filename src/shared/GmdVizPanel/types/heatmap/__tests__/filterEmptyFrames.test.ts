import { createDataFrame, FieldType } from '@grafana/data';
import { firstValueFrom, of } from 'rxjs';

import { filterEmptyFrames } from '../transformations/filterEmptyFrames';

// Native histogram heatmap frames have xMax, yMin, yMax, count fields
function makeHeatmapFrame(values: number[]) {
  return createDataFrame({
    fields: [
      { name: 'xMax', type: FieldType.time, values },
      { name: 'yMin', type: FieldType.number, values },
      { name: 'yMax', type: FieldType.number, values },
      { name: 'count', type: FieldType.number, values },
    ],
  });
}

describe('filterEmptyFrames', () => {
  it('removes empty frames and keeps non-empty frames', async () => {
    const emptyFrame = makeHeatmapFrame([]);
    const nonEmptyFrame = makeHeatmapFrame([1, 2, 3]);

    const result = await firstValueFrom(filterEmptyFrames()(of([emptyFrame, nonEmptyFrame])));

    expect(result).toEqual([nonEmptyFrame]);
  });
});
