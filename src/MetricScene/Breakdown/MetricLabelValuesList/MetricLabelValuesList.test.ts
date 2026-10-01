import { FieldType, LoadingState, type DataFrame, type PanelData } from '@grafana/data';
import { SceneDataTransformer, sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { getTrailFor } from 'shared/utils/utils';

import { MetricLabelValuesList } from './MetricLabelValuesList';

jest.mock('shared/utils/utils.trail', () => ({
  embeddedTrailNamespace: 'test',
  getTrailFor: jest.fn(),
  getUrlForTrail: jest.fn(),
  limitAdhocProviders: jest.fn(),
  newMetricsTrail: jest.fn(),
}));

const panelData = { state: LoadingState.Done, series: [] } as unknown as PanelData;

function makeFrame(labelValue: string): DataFrame {
  return {
    name: labelValue,
    length: 2,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: [1, 2] },
      { name: 'Value', type: FieldType.number, config: {}, values: [1, 2], labels: { instance: labelValue } },
    ],
  };
}

describe('MetricLabelValuesList value panels', () => {
  beforeEach(() => {
    jest.mocked(getTrailFor).mockReturnValue({
      state: {
        sourceMetrics: [
          {
            metricName: 'test_metric',
            customRateInterval: '10m',
            customFunction: 'max_over_time',
            metricType: 'gauge',
          },
        ],
      },
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds an independently scoped normal metric panel with source-metric overrides', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'test_metric', type: 'gauge' },
      label: 'instance',
    });

    const panel = (list as any).buildValuePanel(panelData, undefined, 4, 'api-1') as GmdVizPanel;

    expect(panel).toBeInstanceOf(GmdVizPanel);
    expect(panel.state.panelConfig.title).toBe('api-1');
    expect(panel.state.panelConfig.fixedColorIndex).toBe(4);
    expect(panel.state.queryConfig).toMatchObject({
      labelMatchers: [{ key: 'instance', operator: '=', value: 'api-1' }],
      customRateInterval: '10m',
      customFunction: 'max_over_time',
      kgMetricType: 'gauge',
    });
  });

  it('builds a scoped native-histogram percentile query when no sampled frame exists', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'request_duration', type: 'native-histogram' },
      label: 'instance',
      histogramBreakdownFn: 'p95',
    });

    const panel = (list as any).buildValuePanel(panelData, undefined, 2, 'api-2') as VizPanel;
    const transformer = sceneGraph.getData(panel) as SceneDataTransformer;
    const runner = transformer.state.$data as SceneQueryRunner;

    expect(runner.state.maxDataPoints).toBe(250);
    expect(runner.state.queries[0].expr).toBe(
      'histogram_quantile(0.95,sum by (instance) (rate(request_duration{instance="api-2", __ignore_usage__="", ${filters:raw}}[$__rate_interval])))'
    );
  });

  it('keeps using an already-fetched frame for histogram values present in range data', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'request_duration', type: 'native-histogram' },
      label: 'instance',
      histogramBreakdownFn: 'sum',
    });
    const frame = makeFrame('api-3');

    const panel = (list as any).buildValuePanel(panelData, frame, 1, 'api-3') as VizPanel;

    expect(sceneGraph.getData(panel)).not.toBeInstanceOf(SceneDataTransformer);
    expect(sceneGraph.getData(panel).state.data?.series).toEqual([frame]);
  });

  it('preserves binary-expression scoping for the range-frame fallback', () => {
    const list = new MetricLabelValuesList({
      metric: { name: 'left_metric', type: 'gauge' },
      label: 'instance',
      binaryQuery: '(left_metric{}) / (right_metric{})',
    });

    const panel = (list as any).buildValuePanel(panelData, makeFrame('api-4'), 0, 'api-4') as GmdVizPanel;

    expect(panel.state.queryConfig.binaryExpr).toContain('instance="api-4"');
    expect(panel.state.queryConfig.binaryLegend).toBe('api-4');
    expect(list.state.$variables).toBeUndefined();
  });
});
