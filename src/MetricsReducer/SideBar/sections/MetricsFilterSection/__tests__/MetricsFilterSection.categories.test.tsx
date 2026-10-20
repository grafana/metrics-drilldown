import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { computeMetricCategoryGroups } from 'MetricsReducer/metrics-variables/computeMetricCategoryGroups';
import { MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { trailDS, VAR_DATASOURCE_EXPR } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { MetricsFilterSection } from '../MetricsFilterSection';

jest.mock('shared/tracking/interactions', () => ({ reportExploreMetrics: jest.fn() }));

const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;

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

const select = (section: MetricsFilterSection, values: string[]) => {
  // @ts-expect-error - accessing private method for testing
  section.onSelectionChange(values.map((value) => ({ label: value, value })));
};

describe('MetricsFilterSection - category filter tracking', () => {
  beforeEach(() => {
    mockReportExploreMetrics.mockClear();
  });

  it('reports the category that was selected', () => {
    const { section } = setup('metricCategories');

    select(section, ['kubernetes']);

    expect(mockReportExploreMetrics).toHaveBeenCalledTimes(1);
    expect(mockReportExploreMetrics).toHaveBeenCalledWith('sidebar_category_filter_changed', {
      action: 'added',
      category: 'kubernetes',
    });
  });

  it('reports only the category that was just selected', () => {
    const { section } = setup('metricCategories');

    select(section, ['kubernetes']);
    mockReportExploreMetrics.mockClear();
    select(section, ['kubernetes', 'http']);

    expect(mockReportExploreMetrics).toHaveBeenCalledTimes(1);
    expect(mockReportExploreMetrics).toHaveBeenCalledWith('sidebar_category_filter_changed', {
      action: 'added',
      category: 'http',
    });
  });

  it('reports nothing when a category is deselected or the selection is cleared', () => {
    const { section } = setup('metricCategories');

    select(section, ['kubernetes', 'http']);
    mockReportExploreMetrics.mockClear();

    select(section, ['kubernetes']);
    select(section, []);

    expect(mockReportExploreMetrics).not.toHaveBeenCalled();
  });

  it('reports nothing for the other filters', () => {
    const { section } = setup('prefixes');

    select(section, ['http']);

    expect(mockReportExploreMetrics).not.toHaveBeenCalled();
  });
});
