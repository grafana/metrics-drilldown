import { type SceneCSSGridItem, type SceneObject } from '@grafana/scenes';

import { SloTrackedBadge } from 'shared/GmdVizPanel/components/SloTrackedBadge';

import { MetricsGroupByRow } from './MetricsGroupByList/MetricsGroupByRow';
import { MetricsList } from './MetricsList/MetricsList';

import type { WithUsageDataPreviewPanel } from './MetricsList/WithUsageDataPreviewPanel';

jest.mock('shared/utils/utils', () => ({
  getObjectKeys: Object.keys,
  getTrailFor: () => ({ state: { sourceMetrics: [] } }),
}));

jest.mock('MetricsReducer/MetricsReducer', () => ({ MetricsReducer: class MetricsReducer {} }));

function getHeaderActions(item: SceneCSSGridItem) {
  const wrapper = item.state.body as WithUsageDataPreviewPanel;
  const panel = wrapper.state.vizPanelInGridItem;
  return panel.state.panelConfig.headerActions({ metric: { name: 'http_requests_total' } } as never) as SceneObject[];
}

describe('SLO-tracked card action integration', () => {
  it('includes the badge in ungrouped metric cards', () => {
    const list = new MetricsList({ variableName: 'metrics' });
    const item = list.state.body.state.getLayoutChild(
      { label: 'http_requests_total', value: 'http_requests_total' },
      0,
      []
    ) as SceneCSSGridItem;

    const actions = getHeaderActions(item);

    expect(actions.some((action) => action instanceof SloTrackedBadge)).toBe(true);
    expect(actions).toHaveLength(3);
  });

  it('includes the badge in grouped metric cards without replacing existing actions', () => {
    const row = new MetricsGroupByRow({
      index: 0,
      labelName: 'job',
      labelValue: 'api',
      labelCardinality: 1,
    });
    const item = row.state.body.state.getLayoutChild(
      { label: 'http_requests_total', value: 'http_requests_total' },
      0,
      []
    ) as SceneCSSGridItem;
    const actions = getHeaderActions(item);

    expect(actions.some((action) => action instanceof SloTrackedBadge)).toBe(true);
    expect(actions).toHaveLength(4);
  });
});
