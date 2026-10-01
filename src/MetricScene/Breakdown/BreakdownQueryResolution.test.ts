import {
  sceneGraph,
  type SceneCSSGridItem,
  type SceneDataTransformer,
  type SceneQueryRunner,
  type VizPanel,
} from '@grafana/scenes';

import { type LabelValuesVariable } from 'MetricsReducer/labels/LabelValuesVariable';

import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { BREAKDOWN_QUICK_SEARCH_KEY, MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';

describe('breakdown query resolution', () => {
  it('keeps the secondary selected-label range query at 250 max data points', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'test_metric', type: 'gauge' },
      label: 'instance',
    });

    const transformer = list.state.$data as SceneDataTransformer;
    const runner = transformer.state.$data as SceneQueryRunner;

    expect(runner.state.maxDataPoints).toBe(250);
  });

  it('configures metric-scoped label-value enumeration without the internal usage label', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'test_metric', type: 'gauge' },
      label: 'instance',
    });
    const variable = list.state.$variables?.state.variables[0] as LabelValuesVariable;

    expect(variable.state.query).toBe('labelValues:instance\ntest_metric{${filters:raw}}');
  });

  it('does not add metric-scoped enumeration for binary expressions', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'left_metric', type: 'gauge' },
      label: 'instance',
      binaryQuery: '(left_metric{}) / (right_metric{})',
    });

    expect(list.state.$variables).toBeUndefined();
  });

  it('does not add metric-scoped enumeration for a transient empty label', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'test_metric', type: 'gauge' },
      label: '',
    });

    expect(list.state.$variables).toBeUndefined();
  });

  it('uses a breakdown-specific quick-search key for label-value repetition', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'test_metric', type: 'gauge' },
      label: 'instance',
    });
    const repeater = (list as any).buildByFrameRepeater();

    expect(list.state.quickSearch.state.key).toBe(BREAKDOWN_QUICK_SEARCH_KEY);
    expect(repeater.state.quickSearchKey).toBe(BREAKDOWN_QUICK_SEARCH_KEY);
  });

  it('uses 500 max data points for panels in the all-labels breakdown', () => {
    const list = new MetricLabelsList({ metric: { name: 'test_metric', type: 'gauge' } });
    const item = list.state.body.state.getLayoutChild({ value: 'instance', label: 'instance' }, 0, []);
    const panel = (item as SceneCSSGridItem).state.body as VizPanel;
    const transformer = sceneGraph.getData(panel) as SceneDataTransformer;
    const runner = transformer.state.$data as SceneQueryRunner;

    expect(runner.state.maxDataPoints).toBe(500);
  });
});
