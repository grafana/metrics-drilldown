import { orderByPriority, reducer, sortByActivity, type AttributeConfig, type AttributeState, type State } from './attributeDistributionState';

function attr(attribute: string): AttributeConfig {
  return { attribute, attribute_name: attribute };
}

function loaded(values: Array<{ count: number; impliedTotal?: number }>): AttributeState {
  return { error: false, expanded: false, loading: false, values: values as AttributeState['values'] };
}

function loading(): AttributeState {
  return { error: false, expanded: false, loading: true, values: [] };
}

function errored(): AttributeState {
  return { error: 'failed', expanded: false, loading: false, values: [] };
}

describe('sortByActivity', () => {
  it('leaves order unchanged when no attribute has data yet', () => {
    const attributes = [attr('route'), attr('status_code')];
    expect(sortByActivity(attributes, {})).toEqual(attributes);
  });

  it('sinks a fully-loaded, all-zero-count attribute below an active one', () => {
    const attributes = [attr('quiet'), attr('active')];
    const data = {
      quiet: loaded([{ count: 0 }, { count: 0 }]),
      active: loaded([{ count: 5 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual([attr('active'), attr('quiet')]);
  });

  it('treats an attribute with no detected values as quiet, same as one with all-zero values', () => {
    const attributes = [attr('empty'), attr('active')];
    const data = {
      empty: loaded([]),
      active: loaded([{ count: 5 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual([attr('active'), attr('empty')]);
  });

  it('does not move an attribute that is still loading, even if it was previously all zero', () => {
    const attributes = [attr('loading-now'), attr('active')];
    const data = {
      'loading-now': loading(),
      active: loaded([{ count: 5 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual(attributes);
  });

  it('does not move an attribute that errored', () => {
    const attributes = [attr('errored'), attr('active')];
    const data = {
      errored: errored(),
      active: loaded([{ count: 5 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual(attributes);
  });

  it('does not move an attribute missing from data entirely', () => {
    const attributes = [attr('unknown'), attr('active')];
    const data = { active: loaded([{ count: 5 }]) };
    expect(sortByActivity(attributes, data)).toEqual(attributes);
  });

  it('preserves relative order within both the active group and the quiet group', () => {
    const attributes = [attr('quiet-a'), attr('active-a'), attr('quiet-b'), attr('active-b')];
    const data = {
      'quiet-a': loaded([{ count: 0 }]),
      'active-a': loaded([{ count: 1 }]),
      'quiet-b': loaded([{ count: 0 }]),
      'active-b': loaded([{ count: 2 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual([attr('active-a'), attr('active-b'), attr('quiet-a'), attr('quiet-b')]);
  });

  it('does not mutate the input array', () => {
    const attributes = [attr('quiet'), attr('active')];
    const data = { quiet: loaded([{ count: 0 }]), active: loaded([{ count: 5 }]) };
    sortByActivity(attributes, data);
    expect(attributes).toEqual([attr('quiet'), attr('active')]);
  });

  it('does not sink an attribute whose value has real activity but none of it is in the current threshold range', () => {
    // count is the in-range share, impliedTotal is the value's real total. A value can be 0% of its
    // label's in-range population while still having genuine traffic outside the current threshold;
    // that's "nothing matched the filter", not "this label is dead", and must not be conflated with it.
    const attributes = [attr('out-of-range'), attr('active')];
    const data = {
      'out-of-range': loaded([{ count: 0, impliedTotal: 400 }]),
      active: loaded([{ count: 5, impliedTotal: 40 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual(attributes);
  });

  it('sinks a single-value attribute when that one value has genuinely zero total activity', () => {
    const attributes = [attr('dead'), attr('active')];
    const data = {
      dead: loaded([{ count: 0, impliedTotal: 0 }]),
      active: loaded([{ count: 5, impliedTotal: 40 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual([attr('active'), attr('dead')]);
  });

  it('sinks an attribute only when every one of its values has zero total activity, not just some', () => {
    const attributes = [attr('mixed'), attr('active')];
    const data = {
      mixed: loaded([{ count: 0, impliedTotal: 0 }, { count: 5, impliedTotal: 40 }]),
      active: loaded([{ count: 5, impliedTotal: 40 }]),
    };
    expect(sortByActivity(attributes, data)).toEqual(attributes);
  });
});

describe('orderByPriority', () => {
  it('returns detected attributes unchanged when there is no priority list', () => {
    const detected = [attr('route'), attr('status_code')];
    expect(orderByPriority(detected, [], {})).toEqual(detected);
  });

  it('sorts a detected priority field first and applies its canonical attributeLabels name', () => {
    // fetchAttributes assigns attribute_name as the raw label (e.g. "http_route"); a genuinely-present
    // priority field must still get the prettified canonical form, not just a fallback-only field.
    const detected = [attr('status_code'), { attribute: 'http_route', attribute_name: 'http_route' }];
    const result = orderByPriority(detected, ['http_route'], { http_route: 'http.route' });
    expect(result).toEqual([
      { attribute: 'http_route', attribute_name: 'http.route' },
      attr('status_code'),
    ]);
  });

  it('does not manufacture a placeholder section for a priority field absent from detected', () => {
    // A stale priority list (retained across a same-dataset refresh) can reference a field that isn't
    // in the freshly-detected set for this dataset/timeframe. It must be skipped, not injected as a
    // permanent, never-populated section.
    const detected = [attr('status_code')];
    const result = orderByPriority(detected, ['http_route', 'status_code'], { http_route: 'http.route' });
    expect(result).toEqual([attr('status_code')]);
  });

  it('keeps non-priority detected attributes after the priority ones, unaffected', () => {
    const detected = [attr('a'), attr('b'), attr('c')];
    const result = orderByPriority(detected, ['c'], {});
    expect(result).toEqual([attr('c'), attr('a'), attr('b')]);
  });
});

describe('reducer DETECTING', () => {
  function baseState(overrides: Partial<State> = {}): State {
    return {
      attributes: [],
      data: {},
      detecting: false,
      detectionError: false,
      selectedFilters: [],
      userPinnedAttributes: [],
      valueSnapshot: null,
      ...overrides,
    };
  }

  it('clears an existing value snapshot when the dataset genuinely changed', () => {
    const state = baseState({
      selectedFilters: [{ field: 'route', operator: '=', value: 'checkout' }],
      valueSnapshot: { route: [] },
    });
    const result = reducer(state, { type: 'DETECTING', isNewDataset: true });
    expect(result.valueSnapshot).toBeNull();
  });

  it('preserves an existing value snapshot when only refining the same dataset (filter or time-range change)', () => {
    // This is the exact bug: DETECTING re-runs on every context change, including a filter toggle
    // (which also rebuilds context.query since it embeds the current filters) or a time-range pan --
    // neither of which clears the filters, so the "retained until all filters are cleared" contract
    // must hold even though a re-detection cycle is happening.
    const snapshot = { route: [] };
    const state = baseState({
      selectedFilters: [{ field: 'route', operator: '=', value: 'checkout' }],
      valueSnapshot: snapshot,
    });
    const result = reducer(state, { type: 'DETECTING', isNewDataset: false });
    expect(result.valueSnapshot).toBe(snapshot);
  });

  it('leaves an already-null value snapshot null when refining the same dataset with no active filters', () => {
    const state = baseState({ selectedFilters: [], valueSnapshot: null });
    const result = reducer(state, { type: 'DETECTING', isNewDataset: false });
    expect(result.valueSnapshot).toBeNull();
  });
});
