import { CustomVariable, sceneGraph } from '@grafana/scenes';

import { MetricsVariableSortEngine } from '../../../metrics-variables/MetricsVariableSortEngine';
import { MetricsSorter, VAR_WINGMAN_SORT_BY } from '../../MetricsSorter/MetricsSorter';
import { JevSort } from '../JevSort';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return { ...actual, sceneGraph: { ...actual.sceneGraph, findByKeyAndType: jest.fn() } };
});

it('shares the single sort variable and restores the preceding ordinary sort', () => {
  localStorage.setItem('gmd.jev.enabled', '1');
  const sorter = new MetricsSorter({});
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue(sorter);
  const variable = sorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;
  variable.changeValueTo('alphabetical-reversed');
  const button = new JevSort();
  const deactivate = button.activate();
  button.toggle();
  expect(variable.getValue()).toBe('jev-relevance');
  expect(button.state.active).toBe(true);
  button.toggle();
  expect(variable.getValue()).toBe('alphabetical-reversed');
  expect(button.state.active).toBe(false);
  variable.changeValueTo('jev-relevance');
  expect(button.state.active).toBe(true);
  variable.changeValueTo('alphabetical');
  expect(button.state.active).toBe(false);
  deactivate();
  localStorage.removeItem('gmd.jev.enabled');
});

it('excludes the experimental value from the disabled dropdown', () => {
  localStorage.removeItem('gmd.jev.enabled');
  const sorter = new MetricsSorter({});
  expect(sorter.supportedSortByOptions.has('jev-relevance')).toBe(false);
  expect((sorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable).state.query).not.toContain(
    'jev-relevance'
  );
});

it('a late Jev or usage sort cannot overwrite a newer ordinary sort, even when it was already applied', async () => {
  const variable = new CustomVariable({
    name: 'metrics',
    options: ['a', 'b'].map((value) => ({ value, label: value })),
  });
  let finish!: (value: string[]) => void;
  const ranking = {
    rank: jest.fn(
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        })
    ),
    cancel: jest.fn(),
  };
  const sorter = { state: { ranking }, getUsageMetrics: jest.fn() };
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue(sorter as never);
  const engine = new MetricsVariableSortEngine(variable as never);
  await engine.sort('alphabetical');
  const pending = engine.sort('jev-relevance');
  await engine.sort('alphabetical'); // same already-applied mode must still invalidate pending work
  finish(['b', 'a']);
  await pending;
  expect(variable.state.options.map((o) => o.value)).toEqual(['a', 'b']);
  expect(ranking.cancel).toHaveBeenCalled();
  let finishUsage!: (value: Record<string, number>) => void;
  sorter.getUsageMetrics.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishUsage = resolve;
      })
  );
  const usage = engine.sort('dashboard-usage');
  await engine.sort('alphabetical-reversed');
  finishUsage({ a: 10 });
  await usage;
  expect(variable.state.options.map((o) => o.value)).toEqual(['b', 'a']);
});
