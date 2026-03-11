import { createDataFrame, FieldType } from '@grafana/data';
import { firstValueFrom, of } from 'rxjs';

import { filterZeroBucketFrames } from '../transformations/filterZeroBucketFrames';

// The zero bucket sentinel values used by Prometheus native histograms
const ZERO_BUCKET_Y_MIN = -1e-128;
const ZERO_BUCKET_Y_MAX = 1e-128;

function makeZeroBucketFrame(length: number) {
  const timestamps = Array.from({ length }, (_, i) => 1000 + i * 60000);
  const zeroes = Array(length).fill(0);

  return createDataFrame({
    fields: [
      { name: 'xMax', type: FieldType.time, values: timestamps },
      { name: 'yMin', type: FieldType.number, values: Array(length).fill(ZERO_BUCKET_Y_MIN) },
      { name: 'yMax', type: FieldType.number, values: Array(length).fill(ZERO_BUCKET_Y_MAX) },
      { name: 'count', type: FieldType.number, values: zeroes.map(() => 1800) },
      { name: 'yLayout', type: FieldType.number, values: zeroes.map(() => 3) },
    ],
  });
}

function makeNormalFrame() {
  return createDataFrame({
    fields: [
      { name: 'xMax', type: FieldType.time, values: [1000, 2000, 3000] },
      { name: 'yMin', type: FieldType.number, values: [0.1, 0.2, 0.4] },
      { name: 'yMax', type: FieldType.number, values: [0.2, 0.4, 0.8] },
      { name: 'count', type: FieldType.number, values: [10, 20, 30] },
    ],
  });
}

describe('filterZeroBucketFrames - prevents native histogram zero-bucket crash', () => {
  it('filters out a zero-bucket-only frame', async () => {
    const result = await firstValueFrom(filterZeroBucketFrames()(of([makeZeroBucketFrame(61)])));

    expect(result).toEqual([]);
  });

  it('keeps a normal frame with positive yMin values', async () => {
    const normalFrame = makeNormalFrame();
    const result = await firstValueFrom(filterZeroBucketFrames()(of([normalFrame])));

    expect(result).toEqual([normalFrame]);
  });

  it('filters zero-bucket frame but keeps normal frame when both are present', async () => {
    const normalFrame = makeNormalFrame();
    const result = await firstValueFrom(filterZeroBucketFrames()(of([makeZeroBucketFrame(61), normalFrame])));

    expect(result).toEqual([normalFrame]);
  });
});
