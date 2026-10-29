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
        test: 'labelA',
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
        test: 'labelB',
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
        test: 'labelC',
      },
    },
  ],
});
const frameEmpty = toDataFrame({ fields: [] });

function makeFrame(label: string, values: number[]) {
  return toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: values.map((_, index) => index) },
      { name: 'Value', type: FieldType.number, values, labels: { test: label } },
    ],
  });
}

describe('sortSeries(series, sortBy)', () => {
  test('Sorts series by standard deviation, ascending', () => {
    const result = sortSeries([frameA, frameB, frameC], ReducerID.stdDev, 'asc');
    expect(result).toEqual([frameB, frameA, frameC]);
  });

  test('Sorts series by standard deviation, descending', () => {
    const result = sortSeries([frameA, frameB, frameC], ReducerID.stdDev, 'desc');
    expect(result).toEqual([frameC, frameA, frameB]);
  });

  test('Sorts series alphabetically, ascending', () => {
    const result = sortSeries([frameA, frameB, frameC], 'alphabetical');
    expect(result).toEqual([frameA, frameB, frameC]);
  });

  test('Sorts series alphabetically, descending', () => {
    const result = sortSeries([frameA, frameB, frameC], 'alphabetical-reversed');
    expect(result).toEqual([frameC, frameB, frameA]);
  });

  test('Does not reuse cached frames for a distinct dataset with the same shape', () => {
    const firstStable = makeFrame('stable', [1, 1, 1]);
    const firstVariable = makeFrame('variable', [0, 10, 0]);
    expect(sortSeries([firstStable, firstVariable], ReducerID.stdDev, 'asc')).toEqual([firstStable, firstVariable]);

    const secondStable = makeFrame('stable', [0, 10, 0]);
    const secondVariable = makeFrame('variable', [1, 1, 1]);
    const result = sortSeries([secondStable, secondVariable], ReducerID.stdDev, 'asc');

    expect(result).toEqual([secondVariable, secondStable]);
    expect(result).not.toContain(firstStable);
    expect(result).not.toContain(firstVariable);
  });

  test('Does not throw on empty series', () => {
    expect(() => sortSeries([frameEmpty], 'alphabetical')).not.toThrow();
  });
});
