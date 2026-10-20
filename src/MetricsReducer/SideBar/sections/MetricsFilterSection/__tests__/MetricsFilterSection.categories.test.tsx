import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { computeMetricCategoryGroups } from 'MetricsReducer/metrics-variables/computeMetricCategoryGroups';
import { MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { trailDS, VAR_DATASOURCE_EXPR } from 'shared/shared';

import { MetricsFilterSection } from '../MetricsFilterSection';

const setup = (type: 'metricCategories' | 'prefixes') => {
  const scene = new EmbeddedScene({
    $variables: new SceneVariableSet({
      variables: [new MetricsVariable({})],
    }),
    $data: new SceneQueryRunner({
      datasource: trailDS,
      queries: [{ refId: 'A', expr: VAR_DATASOURCE_EXPR }],
    }),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new MetricsFilterSection({
            key: type === 'metricCategories' ? 'filters-category' : 'filters-prefix',
            type,
            title: 'Filter',
            description: 'Filter metrics',
            icon: 'layer-group',
            computeGroups: computeMetricCategoryGroups,
          }),
        }),
      ],
    }),
  });

  const body = scene.state.body as SceneFlexLayout;
  const firstChild = body.state.children[0] as SceneFlexItem;
  const section = firstChild.state.body as MetricsFilterSection;

  scene.activate();

  return { section };
};

describe('MetricsFilterSection - category filter labels', () => {
  it('translates a category id to its label', () => {
    const { section } = setup('metricCategories');

    // @ts-expect-error - accessing private method for testing
    expect(section.parseLabel('host-os')).toBe('Host / OS');
  });

  it('does not translate the values of the other filters', () => {
    const { section } = setup('prefixes');

    // @ts-expect-error - accessing private method for testing
    expect(section.parseLabel('http')).toBe('http');
  });

  it('shows the label of a category id loaded from the URL', () => {
    const { section } = setup('metricCategories');

    section.updateFromUrl({ 'filters-category': 'kubernetes,http' });

    expect(section.state.selectedGroups).toEqual([
      { label: 'Kubernetes', value: 'kubernetes' },
      { label: 'HTTP', value: 'http' },
    ]);
  });
});
