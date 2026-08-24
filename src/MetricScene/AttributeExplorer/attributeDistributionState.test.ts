import { sortByActivity, type AttributeConfig, type AttributeState } from './attributeDistributionState';

function attr(attribute: string): AttributeConfig {
  return { attribute, attribute_name: attribute };
}

function loaded(values: Array<{ count: number }>): AttributeState {
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
});
