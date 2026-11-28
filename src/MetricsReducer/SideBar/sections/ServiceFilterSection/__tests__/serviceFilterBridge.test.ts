import { urlUtil } from '@grafana/data';
import { AdHocFiltersVariable, sceneUtils, SceneVariableSet, type AdHocFilterWithLabels } from '@grafana/scenes';

import {
  adoptServiceFilter,
  getFiltersWithoutManagedFilter,
  getManagedServiceFilter,
  isServiceSelectionApplied,
  releaseManagedServiceFilter,
  removeManagedServiceFilter,
  SERVICE_FILTER_SOURCE,
  setManagedServiceFilter,
} from '../serviceFilterBridge';
import { JOB_LABEL } from '../serviceMatchers';

function createVariable(filters: AdHocFilterWithLabels[] = []) {
  return new AdHocFiltersVariable({
    name: 'filters',
    datasource: null,
    applyMode: 'manual',
    allowCustomValue: true,
    filters,
  });
}

const userFilter: AdHocFilterWithLabels = { key: 'instance', operator: '=', value: 'host-1' };

describe('setManagedServiceFilter', () => {
  test('adds a managed filter after the existing filters', () => {
    const variable = createVariable([userFilter]);

    setManagedServiceFilter(variable, JOB_LABEL, ['cart', 'checkout']);

    expect(variable.state.filters).toEqual([
      userFilter,
      {
        key: 'job',
        operator: '=~',
        value: 'cart|checkout',
        meta: { source: SERVICE_FILTER_SOURCE },
      },
    ]);
  });

  test('replaces the managed filter in place when the selection changes', () => {
    const variable = createVariable([userFilter]);
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);
    variable.setState({ filters: [...variable.state.filters, { key: 'pod', operator: '=', value: 'p1' }] });

    setManagedServiceFilter(variable, JOB_LABEL, ['cart', 'checkout']);

    expect(variable.state.filters.map((f) => [f.key, f.value])).toEqual([
      ['instance', 'host-1'],
      ['job', 'cart|checkout'],
      ['pod', 'p1'],
    ]);
  });

  test('leaves the variable untouched when the filter does not change', () => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);
    const filtersBefore = variable.state.filters;

    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    expect(variable.state.filters).toBe(filtersBefore);
  });

  test('removes the managed filter when the selection is empty', () => {
    const variable = createVariable([userFilter]);
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    setManagedServiceFilter(variable, JOB_LABEL, []);

    expect(variable.state.filters).toEqual([userFilter]);
  });

  test('does nothing when the selection is empty and there is no managed filter', () => {
    const variable = createVariable([userFilter]);
    const filtersBefore = variable.state.filters;

    removeManagedServiceFilter(variable, JOB_LABEL);

    expect(variable.state.filters).toBe(filtersBefore);
  });

  test('keeps a filter that the user typed for the same label next to the managed one', () => {
    const typedByUser: AdHocFilterWithLabels = { key: 'job', operator: '=', value: 'cart' };
    const variable = createVariable([typedByUser]);

    setManagedServiceFilter(variable, JOB_LABEL, ['checkout']);
    expect(variable.state.filters).toHaveLength(2);
    expect(variable.state.filters[0]).toBe(typedByUser);

    setManagedServiceFilter(variable, JOB_LABEL, []);
    expect(variable.state.filters).toEqual([typedByUser]);
  });

  test('keeps the managed filters of two labels apart', () => {
    const variable = createVariable();

    setManagedServiceFilter(variable, 'namespace', ['shop']);
    setManagedServiceFilter(variable, JOB_LABEL, ['shop/cart']);
    setManagedServiceFilter(variable, 'namespace', []);

    expect(variable.state.filters.map((f) => [f.key, f.value])).toEqual([['job', 'shop/cart']]);
  });
});

describe('the data source of the managed filter', () => {
  test('is kept on the filter, and the filter is written again when it changes', () => {
    const variable = createVariable();

    setManagedServiceFilter(variable, JOB_LABEL, ['cart'], 'ds1');
    expect(variable.state.filters[0].meta).toEqual({ source: SERVICE_FILTER_SOURCE, dataSource: 'ds1' });
    expect(getManagedServiceFilter(variable, JOB_LABEL)?.dataSource).toBe('ds1');

    setManagedServiceFilter(variable, JOB_LABEL, ['cart'], 'ds2');
    expect(getManagedServiceFilter(variable, JOB_LABEL)?.dataSource).toBe('ds2');
  });

  test('is kept on an adopted filter', () => {
    const variable = createVariable([{ key: 'job', operator: '=~', value: 'cart' }]);

    adoptServiceFilter(variable, JOB_LABEL, ['cart'], 'ds1');

    expect(getManagedServiceFilter(variable, JOB_LABEL)?.dataSource).toBe('ds1');
  });

  test('getManagedServiceFilter finds no filter that the user typed', () => {
    const variable = createVariable([{ key: 'job', operator: '=~', value: 'cart' }]);

    expect(getManagedServiceFilter(variable, JOB_LABEL)).toBeUndefined();
  });
});

describe('releaseManagedServiceFilter', () => {
  const edited: AdHocFilterWithLabels = {
    key: 'job',
    operator: '=~',
    value: 'payments',
    meta: { source: SERVICE_FILTER_SOURCE },
  };

  test('removes the marker and keeps the filter with its key, operator and value', () => {
    const variable = createVariable([userFilter, edited]);

    releaseManagedServiceFilter(variable, JOB_LABEL);

    expect(variable.state.filters).toEqual([userFilter, { key: 'job', operator: '=~', value: 'payments' }]);
    expect('meta' in variable.state.filters[1]).toBe(false);
  });

  test('keeps the filter of another label managed', () => {
    const namespaceFilter: AdHocFilterWithLabels = {
      key: 'namespace',
      operator: '=~',
      value: 'shop',
      meta: { source: SERVICE_FILTER_SOURCE },
    };
    const variable = createVariable([edited, namespaceFilter]);

    releaseManagedServiceFilter(variable, JOB_LABEL);

    expect(variable.state.filters[1]).toBe(namespaceFilter);
  });

  test('keeps the filter that the user typed for the same key, which has no marker', () => {
    const typed: AdHocFilterWithLabels = { key: 'job', operator: '=', value: 'cart' };
    const variable = createVariable([typed, edited]);

    releaseManagedServiceFilter(variable, JOB_LABEL);

    expect(variable.state.filters[0]).toBe(typed);
  });

  test('leaves the variable untouched when no filter is managed', () => {
    const variable = createVariable([userFilter]);
    const filtersBefore = variable.state.filters;

    releaseManagedServiceFilter(variable, JOB_LABEL);

    expect(variable.state.filters).toBe(filtersBefore);
  });

  test('lets the sidebar write a new managed filter next to the released one', () => {
    const variable = createVariable([edited]);
    releaseManagedServiceFilter(variable, JOB_LABEL);

    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    expect(variable.state.filters).toEqual([
      { key: 'job', operator: '=~', value: 'payments' },
      { key: 'job', operator: '=~', value: 'cart', meta: { source: SERVICE_FILTER_SOURCE } },
    ]);
  });
});

describe('getFiltersWithoutManagedFilter', () => {
  test('drops the managed filter of the key and keeps every other filter', () => {
    const typedByUser: AdHocFilterWithLabels = { key: 'job', operator: '=', value: 'cart' };
    const variable = createVariable([userFilter, typedByUser]);
    setManagedServiceFilter(variable, JOB_LABEL, ['shop/checkout']);
    setManagedServiceFilter(variable, 'namespace', ['shop']);

    const filters = getFiltersWithoutManagedFilter(variable.state.filters, JOB_LABEL);

    expect(filters.map((f) => [f.key, f.value])).toEqual([
      ['instance', 'host-1'],
      ['job', 'cart'],
      ['namespace', 'shop'],
    ]);
  });
});

describe('isServiceSelectionApplied', () => {
  test('is true while the managed filter holds the selection', () => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, ['cart', 'checkout']);

    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart', 'checkout'])).toBe(true);
  });

  test('is false for an empty selection', () => {
    expect(isServiceSelectionApplied(createVariable(), JOB_LABEL, [])).toBe(false);
  });

  test('is false after the user deletes the managed filter', () => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    variable.setState({ filters: [] });

    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart'])).toBe(false);
  });

  test('is false after the user edits the value of the managed filter', () => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    variable.setState({ filters: variable.state.filters.map((f) => ({ ...f, value: 'other' })) });

    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart'])).toBe(false);
  });

  test('is false when all the filters were cleared, as for a binary query', () => {
    const variable = createVariable([userFilter]);
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);

    variable.setState({ filters: [], baseFilters: [] });

    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart'])).toBe(false);
  });

  test('is false when only a filter typed by the user matches the selection', () => {
    const variable = createVariable([{ key: 'job', operator: '=~', value: 'cart' }]);

    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart'])).toBe(false);
  });
});

describe('adoptServiceFilter', () => {
  test('marks the filter that equals the saved selection as managed', () => {
    const variable = createVariable([userFilter, { key: 'job', operator: '=~', value: 'cart|checkout' }]);

    expect(adoptServiceFilter(variable, JOB_LABEL, ['cart', 'checkout'])).toBe(true);
    expect(isServiceSelectionApplied(variable, JOB_LABEL, ['cart', 'checkout'])).toBe(true);
    expect(variable.state.filters[0]).toBe(userFilter);
  });

  test('returns true without changing anything when the filter is already managed', () => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, ['cart']);
    const filtersBefore = variable.state.filters;

    expect(adoptServiceFilter(variable, JOB_LABEL, ['cart'])).toBe(true);
    expect(variable.state.filters).toBe(filtersBefore);
  });

  test('returns false when no filter equals the saved selection', () => {
    const variable = createVariable([{ key: 'job', operator: '=~', value: 'other' }]);

    expect(adoptServiceFilter(variable, JOB_LABEL, ['cart'])).toBe(false);
    expect(variable.state.filters[0].meta).toBeUndefined();
  });

  test('returns false for an empty selection', () => {
    const variable = createVariable([{ key: 'job', operator: '=~', value: 'cart' }]);

    expect(adoptServiceFilter(variable, JOB_LABEL, [])).toBe(false);
  });

  test('does not adopt a filter of another label with the same value', () => {
    const variable = createVariable([{ key: 'namespace', operator: '=~', value: 'cart' }]);

    expect(adoptServiceFilter(variable, JOB_LABEL, ['cart'])).toBe(false);
  });
});

describe('URL round trip', () => {
  function roundTrip(variable: AdHocFiltersVariable) {
    const source = new SceneVariableSet({ variables: [variable] });
    const target = createVariable();
    const targetRoot = new SceneVariableSet({ variables: [target] });

    const urlState = urlUtil.renderUrl('', sceneUtils.getUrlState(source));
    sceneUtils.syncStateFromSearchParams(targetRoot, new URLSearchParams(urlState));

    return target;
  }

  test.each([
    ['plain values', ['cart', 'checkout']],
    ['regex metacharacters', ['a.b', 'c+d', '(e)']],
    ['a comma and a pipe', ['d,e', 'f|g']],
    ['job values with a slash', ['prod/checkout', 'checkout']],
    ['a job of only quotes and a quote inside', ['""', 'a"b']],
  ])('lets the sidebar claim the filter again after a reload with %s', (_, values) => {
    const variable = createVariable();
    setManagedServiceFilter(variable, JOB_LABEL, values);

    const reloaded = roundTrip(variable);

    expect(reloaded.state.filters).toHaveLength(1);
    expect(reloaded.state.filters[0]).toMatchObject({
      key: variable.state.filters[0].key,
      operator: '=~',
      value: variable.state.filters[0].value,
    });
    expect(adoptServiceFilter(reloaded, JOB_LABEL, values)).toBe(true);
    expect(isServiceSelectionApplied(reloaded, JOB_LABEL, values)).toBe(true);
  });
});
