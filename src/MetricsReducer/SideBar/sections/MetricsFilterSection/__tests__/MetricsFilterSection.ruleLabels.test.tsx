import { EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneQueryRunner, SceneVariableSet } from '@grafana/scenes';

import { MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { trailDS, VAR_DATASOURCE_EXPR } from 'shared/shared';

import { MetricsFilterSection } from '../MetricsFilterSection';
import { RULE_GROUP_LABELS, type RuleGroupLabel } from '../rule-group-labels';

const setup = (filterValues: string[] = []) => {
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
            key: 'filters-rule',
            type: 'categories',
            title: 'Rules filters',
            description: 'Filter metrics and recording rules',
            icon: 'rules',
            computeGroups: () => [
              { value: '^(?!.*:.*)', label: RULE_GROUP_LABELS.metrics, count: 10 },
              { value: ':', label: RULE_GROUP_LABELS.rules, count: 5 },
            ],
            showHideEmpty: false,
            showSearch: false,
          }),
        }),
      ],
    }),
  });

  const body = scene.state.body as SceneFlexLayout;
  const firstChild = body.state.children[0] as SceneFlexItem;
  const metricsFilterSection = firstChild.state.body as MetricsFilterSection;

  // Simulate loading filter values from URL
  if (filterValues.length > 0) {
    const parsedGroups = filterValues.map((value) => ({
      // @ts-expect-error - accessing private method for testing
      label: metricsFilterSection.parseLabel(value) as RuleGroupLabel,
      value,
    }));
    metricsFilterSection.setState({ selectedGroups: parsedGroups });
  }

  scene.activate();

  return { scene, metricsFilterSection };
};

describe('MetricsFilterSection - Rule Label Parsing', () => {
  describe('parseLabel method', () => {
    it('should map non-rules metrics regex to human-readable label', () => {
      const { metricsFilterSection } = setup(['^(?!.*:.*)']);

      const selectedGroups = metricsFilterSection.state.selectedGroups;
      expect(selectedGroups).toHaveLength(1);
      expect(selectedGroups[0].label).toBe('Non-rules metrics');
      expect(selectedGroups[0].value).toBe('^(?!.*:.*)');
    });

    it('should map recording rules regex to human-readable label', () => {
      const { metricsFilterSection } = setup([':']);

      const selectedGroups = metricsFilterSection.state.selectedGroups;
      expect(selectedGroups).toHaveLength(1);
      expect(selectedGroups[0].label).toBe('Recording rules');
      expect(selectedGroups[0].value).toBe(':');
    });

    it('should handle multiple rule filter selections', () => {
      const { metricsFilterSection } = setup(['^(?!.*:.*)', ':']);

      const selectedGroups = metricsFilterSection.state.selectedGroups;
      expect(selectedGroups).toHaveLength(2);
      expect(selectedGroups[0].label).toBe('Non-rules metrics');
      expect(selectedGroups[1].label).toBe('Recording rules');
    });

    it('should preserve hierarchical prefix labels', () => {
      const { metricsFilterSection } = setup(['grafana:alert']);

      const selectedGroups = metricsFilterSection.state.selectedGroups;
      expect(selectedGroups).toHaveLength(1);
      // Hierarchical separator ":" should be converted to " > "
      expect(selectedGroups[0].label).toBe('grafana > alert');
    });

    it('should preserve regular label values unchanged', () => {
      const { metricsFilterSection } = setup(['prometheus']);

      const selectedGroups = metricsFilterSection.state.selectedGroups;
      expect(selectedGroups).toHaveLength(1);
      expect(selectedGroups[0].label).toBe('prometheus');
    });
  });
});
