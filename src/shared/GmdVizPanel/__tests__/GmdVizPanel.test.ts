import { DataFrameType, LoadingState } from '@grafana/data';
import { SceneQueryRunner } from '@grafana/scenes';

import { getPreferredConfigForMetric } from 'shared/GmdVizPanel/config/getPreferredConfigForMetric';
import { getMetricType, getMetricTypeSync } from 'shared/GmdVizPanel/matchers/getMetricType';
import { getPanelTypeForMetricSync } from 'shared/GmdVizPanel/matchers/getPanelTypeForMetric';
import { panelBuilder } from 'shared/GmdVizPanel/types/panelBuilder';
import { getTrailFor } from 'shared/utils/utils';

import { GmdVizPanel } from '../GmdVizPanel';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return { ...actual, SceneQueryRunner: jest.fn() };
});

jest.mock('shared/GmdVizPanel/matchers/getMetricType', () => ({
  getMetricType: jest.fn(),
  getMetricTypeSync: jest.fn(),
}));

jest.mock('shared/GmdVizPanel/matchers/getPanelTypeForMetric', () => ({
  getPanelTypeForMetricSync: jest.fn(),
}));

jest.mock('shared/utils/utils', () => ({
  getTrailFor: jest.fn(),
}));

jest.mock('shared/GmdVizPanel/config/getPreferredConfigForMetric', () => ({
  getPreferredConfigForMetric: jest.fn(),
}));

jest.mock('shared/GmdVizPanel/types/panelBuilder', () => ({
  panelBuilder: {
    buildVizPanel: jest.fn(),
    getQueryRunnerParams: jest.fn(),
  },
}));

function createPanel(metric = 'go_goroutines') {
  return new GmdVizPanel({ metric });
}

function createTrailMock(metadata: unknown) {
  const nativeHistogramCache = new Map<string, boolean>();
  return {
    getMetadataForMetric: jest.fn().mockResolvedValue(metadata),
    getCachedNativeHistogram: (metric: string) => nativeHistogramCache.get(metric),
    setCachedNativeHistogram: (metric: string, isNativeHistogram: boolean) =>
      nativeHistogramCache.set(metric, isNativeHistogram),
  };
}

function createProbeRunner() {
  let capturedCallback: ((state: any) => void) | undefined;
  const subscription = { unsubscribe: jest.fn() };
  const runner = {
    subscribeToState: jest.fn().mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return subscription;
    }),
  };
  const fireDone = (series: any[]) => capturedCallback?.({ data: { state: LoadingState.Done, series } });
  const fire = (state: any) => capturedCallback?.(state);
  return { runner, subscription, fireDone, fire };
}

describe('GmdVizPanel', () => {
  beforeEach(() => {
    jest.mocked(getMetricType).mockResolvedValue('gauge');
    jest.mocked(getMetricTypeSync).mockReturnValue('gauge');
    jest.mocked(getPanelTypeForMetricSync).mockReturnValue('timeseries');
    jest.mocked(getPreferredConfigForMetric).mockReturnValue(undefined);
    // metadata present by default so the native-histogram probe does not run
    jest.mocked(getTrailFor).mockReturnValue(createTrailMock({ type: 'gauge' }) as any);
    jest.mocked(panelBuilder.buildVizPanel).mockReturnValue({ state: {} } as any);
    jest.mocked(SceneQueryRunner).mockReset();
  });

  describe('checkMetricMetadata', () => {
    test('updates metricType and switches to heatmap when metadata resolves the metric as a native histogram', async () => {
      jest.mocked(getMetricType).mockResolvedValue('native-histogram');
      const panel = createPanel();

      await (panel as any).checkMetricMetadata();

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('heatmap');
    });

    test('updates metricType from counter to gauge when metadata disagrees', async () => {
      jest.mocked(getMetricTypeSync).mockReturnValue('counter' as any);
      jest.mocked(getMetricType).mockResolvedValue('gauge');
      const panel = createPanel();

      await (panel as any).checkMetricMetadata();

      expect(panel.state.metricType).toBe('gauge');
      expect(panel.state.panelConfig.type).toBe('timeseries');
    });
  });

  describe('detectNativeHistogram', () => {
    function mockNoMetadata() {
      jest.mocked(getTrailFor).mockReturnValue(createTrailMock(undefined) as any);
    }

    test('probes when metadata is undefined and the metric looks like a gauge', async () => {
      mockNoMetadata();
      const { runner } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_probe_runs');

      await (panel as any).checkMetricMetadata();

      expect(SceneQueryRunner).toHaveBeenCalledTimes(1);
      expect(panel.state.$data).toBe(runner);
    });

    test('does not probe when metadata exists', async () => {
      // default beforeEach mock already returns metadata
      const panel = createPanel('nh_has_metadata');

      await (panel as any).checkMetricMetadata();

      expect(SceneQueryRunner).not.toHaveBeenCalled();
    });

    test('does not probe when the metadata-derived type is not a gauge', async () => {
      mockNoMetadata();
      jest.mocked(getMetricType).mockResolvedValue('counter');
      const panel = createPanel('nh_not_gauge');

      await (panel as any).checkMetricMetadata();

      expect(SceneQueryRunner).not.toHaveBeenCalled();
    });

    test('switches to a heatmap when the probe returns a HeatmapCells frame with rows', async () => {
      mockNoMetadata();
      const { runner, fireDone } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_positive');

      await (panel as any).checkMetricMetadata(false);
      fireDone([{ length: 1, meta: { type: DataFrameType.HeatmapCells } }]);

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('heatmap');
      expect(panel.state.$data).toBeUndefined();
    });

    test('sets metricType only and keeps the pinned panel type when discardPanelTypeUpdates is true', async () => {
      mockNoMetadata();
      const { runner, fireDone } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_pinned');
      const originalPanelType = panel.state.panelConfig.type;

      await (panel as any).checkMetricMetadata(true);
      fireDone([{ length: 1, meta: { type: DataFrameType.HeatmapCells } }]);

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe(originalPanelType);
    });

    test('does not switch when the probe returns an empty result', async () => {
      mockNoMetadata();
      const { runner, fireDone } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_empty');

      await (panel as any).checkMetricMetadata();
      fireDone([]);

      expect(panel.state.metricType).toBe('gauge');
      expect(panel.state.panelConfig.type).toBe('timeseries');
      expect(panel.state.$data).toBeUndefined();
    });

    test('clears $data and does not switch or cache when the probe errors', async () => {
      mockNoMetadata();
      const { runner, subscription, fire } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_error');

      await (panel as any).checkMetricMetadata(false);
      fire({ data: { state: LoadingState.Error, series: [] } });

      expect(panel.state.metricType).toBe('gauge');
      expect(panel.state.panelConfig.type).toBe('timeseries');
      expect(panel.state.$data).toBeUndefined();
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('does not switch when the probe returns a non-heatmap frame', async () => {
      mockNoMetadata();
      const { runner, fireDone } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);
      const panel = createPanel('nh_timeseries');

      await (panel as any).checkMetricMetadata();
      fireDone([{ length: 1, meta: { type: 'timeseries' } }]);

      expect(panel.state.metricType).toBe('gauge');
      expect(panel.state.panelConfig.type).toBe('timeseries');
      expect(panel.state.$data).toBeUndefined();
    });

    test('uses the cached result on a second panel without probing again', async () => {
      mockNoMetadata();
      const { runner, fireDone } = createProbeRunner();
      jest.mocked(SceneQueryRunner).mockImplementation(() => runner as any);

      const firstPanel = createPanel('nh_cached');
      await (firstPanel as any).checkMetricMetadata();
      fireDone([{ length: 1, meta: { type: DataFrameType.HeatmapCells } }]);
      expect(SceneQueryRunner).toHaveBeenCalledTimes(1);

      const secondPanel = createPanel('nh_cached');
      await (secondPanel as any).checkMetricMetadata();

      expect(SceneQueryRunner).toHaveBeenCalledTimes(1); // no new probe
      expect(secondPanel.state.metricType).toBe('native-histogram');
      expect(secondPanel.state.panelConfig.type).toBe('heatmap');
    });
  });

  // subscribeToStateChanges no longer does its own native-histogram detection (removed: a query with no
  // rate() returns no data for a native histogram, so watching the panel's own default-shaped query could
  // never observe a HeatmapCells frame for exactly the metrics this app cares about). Detection is metadata
  // plus the rated probe only; see the checkMetricMetadata/detectNativeHistogram tests above.
  test('subscribeToStateChanges no longer subscribes to the panel body data provider', () => {
    const panel = createPanel();
    const provider = { subscribeToState: jest.fn() };
    panel.setState({ body: { state: { $data: provider } } as any });

    (panel as any).subscribeToStateChanges();

    expect(provider.subscribeToState).not.toHaveBeenCalled();
  });
});
