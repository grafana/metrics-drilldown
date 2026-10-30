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

it('projects the shared catalog order without adding or dropping row metrics', async () => {
  const variable = new CustomVariable({
    name: 'row',
    options: ['a', 'b', 'not_yet_in_catalog'].map((value) => ({ value, label: value })),
  });
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue({ state: { ranking: { cancel: jest.fn() } } } as never);
  await new MetricsVariableSortEngine(variable as never).sort('jev-relevance', {
    rankedMetrics: ['another_row_metric', 'b', 'a'],
  });
  expect(variable.state.options.map((o) => o.value)).toEqual(['b', 'a', 'not_yet_in_catalog']);
});

it('a late usage sort cannot overwrite a newer ordinary sort', async () => {
  const variable = new CustomVariable({
    name: 'metrics',
    options: ['a', 'b'].map((value) => ({ value, label: value })),
  });
  const ranking = { cancel: jest.fn() };
  const sorter = { state: { ranking }, getUsageMetrics: jest.fn() };
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue(sorter as never);
  const engine = new MetricsVariableSortEngine(variable as never);
  await engine.sort('alphabetical');
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
