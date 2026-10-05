import { FieldType, LoadingState, type DataFrame } from '@grafana/data';
import { SceneCSSGridLayout, SceneReactObject } from '@grafana/scenes';

import {
  buildLabelValueItems,
  filterAndSortLabelValueItems,
  SceneByFrameRepeater,
  type LabelValueItem,
} from './SceneByFrameRepeater';

function makeFrame(labelValue: string, values = [1, 2]): DataFrame {
  return {
    name: labelValue,
    length: values.length,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: values.map((_, index) => index) },
      { name: 'Value', type: FieldType.number, config: {}, values, labels: { instance: labelValue } },
    ],
  };
}

describe('label-value repetition', () => {
  it('keeps authoritative values that are missing from sampled range frames', () => {
    const sampled = makeFrame('sampled');
    const items = buildLabelValueItems(['sampled', 'missing'], [sampled]);

    expect(items).toEqual([
      { value: 'sampled', displayValue: 'sampled', frame: sampled },
      { value: 'missing', displayValue: 'missing', frame: undefined },
    ]);
  });

  it('keeps the <unspecified> range frame even though Prometheus label values never include an empty value', () => {
    const sampled = makeFrame('sampled');
    const unspecified = makeFrame('<unspecified>');
    const items = buildLabelValueItems(['sampled', 'missing'], [sampled, unspecified]);

    expect(items).toEqual([
      { value: 'sampled', displayValue: 'sampled', frame: sampled },
      { value: 'missing', displayValue: 'missing', frame: undefined },
      { value: '', displayValue: '<unspecified>', frame: unspecified },
    ]);
  });

  it('falls back to range frames when the label-values list is empty (e.g. the request failed)', () => {
    const first = makeFrame('first');
    const second = makeFrame('second');
    const unspecified = makeFrame('<unspecified>');

    expect(buildLabelValueItems([], [first, second, unspecified])).toEqual([
      { value: 'first', displayValue: 'first', frame: first },
      { value: 'second', displayValue: 'second', frame: second },
      { value: '', displayValue: '<unspecified>', frame: unspecified },
    ]);
  });

  it('continues to enumerate binary-query values from range frames when no authoritative list is supplied', () => {
    const first = makeFrame('first');
    const second = makeFrame('second');

    expect(buildLabelValueItems(undefined, [first, second])).toEqual([
      { value: 'first', displayValue: 'first', frame: first },
      { value: 'second', displayValue: 'second', frame: second },
    ]);
  });

  it('filters comma-separated regexes and ignores invalid patterns', () => {
    const items = buildLabelValueItems(['api-1', 'db-1', 'cache'], []);

    expect(
      filterAndSortLabelValueItems(items, '[invalid, ^api, ^db', 'alphabetical').map((item) => item.value)
    ).toEqual(['api-1', 'db-1']);
  });

  it('sorts every authoritative value alphabetically in either direction', () => {
    const items = buildLabelValueItems(['b', 'a'], [makeFrame('<unspecified>')]);

    expect(filterAndSortLabelValueItems(items, '', 'alphabetical').map((item) => item.displayValue)).toEqual([
      '<unspecified>',
      'a',
      'b',
    ]);
    expect(filterAndSortLabelValueItems(items, '', 'alphabetical-reversed').map((item) => item.displayValue)).toEqual([
      'b',
      'a',
      '<unspecified>',
    ]);
  });

  it('appends values without sampled frames alphabetically after outlier-ranked values', () => {
    const sampled: LabelValueItem = { value: 'sampled', displayValue: 'sampled', frame: makeFrame('sampled') };
    const missingB: LabelValueItem = { value: 'b', displayValue: 'b' };
    const missingA: LabelValueItem = { value: 'a', displayValue: 'a' };

    expect(filterAndSortLabelValueItems([missingB, sampled, missingA], '', 'outliers')).toEqual([
      sampled,
      missingA,
      missingB,
    ]);
  });

  it('uses absolute indices for later pages so colors stay stable across Show more', () => {
    const getLayoutChild = jest.fn(() => new SceneReactObject({ reactNode: null }));
    const repeater = new SceneByFrameRepeater({
      $behaviors: [],
      body: new SceneCSSGridLayout({ children: [] }),
      getLayoutChild,
    });
    const data = { state: LoadingState.Done, series: [] } as any;
    const items = buildLabelValueItems(['later-a', 'later-b'], []);

    (repeater as any).buildChildren(data, items, 120);

    expect(getLayoutChild).toHaveBeenNthCalledWith(1, data, undefined, 120, 'later-a');
    expect(getLayoutChild).toHaveBeenNthCalledWith(2, data, undefined, 121, 'later-b');
  });
});
