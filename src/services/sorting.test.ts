import { FieldType, ReducerID, toDataFrame } from '@grafana/data';

import { sortSeries } from './sorting';

const frameA = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [0, 1, 0],
      labels: {
        test: 'C',
      },
    },
  ],
});
const frameB = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [1, 1, 1],
      labels: {
        test: 'A',
      },
    },
  ],
});
const frameC = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [100, 9999, 100],
      labels: {
        test: 'B',
      },
    },
  ],
});
const frameEmpty = toDataFrame({ fields: [] });

describe('sortSeries', () => {
  test('Sorts series by standard deviation, descending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameC, frameA, frameB];

    const result = sortSeries(series, ReducerID.stdDev, 'desc');
    expect(result).toEqual(sortedSeries);
  });
  test('Sorts series by standard deviation, ascending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameB, frameA, frameC];

    const result = sortSeries(series, ReducerID.stdDev, 'asc');
    expect(result).toEqual(sortedSeries);
  });
  test('Sorts series alphabetically, ascending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameB, frameC, frameA];

    const result = sortSeries(series, 'alphabetical', 'asc');
    expect(result).toEqual(sortedSeries);
  });
  test('Sorts series alphabetically, descending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameB, frameC, frameA];

    const result = sortSeries(series, 'alphabetical', 'desc');
    expect(result).toEqual(sortedSeries);
  });
  test('Does not throw on empty series', () => {
    const series = [frameEmpty];

    expect(() => sortSeries(series, 'alphabetical', 'asc')).not.toThrow();
  });
});
