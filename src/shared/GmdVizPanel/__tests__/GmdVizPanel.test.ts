import { DataFrameType, LoadingState } from '@grafana/data';

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


function createPanel() {
  return new GmdVizPanel({ metric: 'go_goroutines' });
}

function createMockDataProvider() {
  let capturedCallback: ((state: any) => void) | undefined;
  const subscription = { unsubscribe: jest.fn() };
  const provider = {
    subscribeToState: jest.fn().mockImplementation((cb: (state: any) => void) => {
      capturedCallback = cb;
      return subscription;
    }),
  };
  const fire = (state: any) => capturedCallback?.(state);
  return { provider, subscription, fire };
}

describe('GmdVizPanel', () => {
  beforeEach(() => {
    jest.mocked(getMetricType).mockResolvedValue('gauge');
    jest.mocked(getMetricTypeSync).mockReturnValue('gauge');
    jest.mocked(getPanelTypeForMetricSync).mockReturnValue('timeseries');
    jest.mocked(getPreferredConfigForMetric).mockReturnValue(undefined);
    jest.mocked(getTrailFor).mockReturnValue({} as any);
    jest.mocked(panelBuilder.buildVizPanel).mockReturnValue({ state: {} } as any);
  });

  describe('checkMetricMetadata', () => {
    test('returns early without state update when metricType already matches metadata', async () => {
      jest.mocked(getMetricType).mockResolvedValue('gauge');
      const panel = createPanel();
      const initialPanelConfig = panel.state.panelConfig;

      await (panel as any).checkMetricMetadata(false);

      expect(panel.state.panelConfig).toBe(initialPanelConfig);
    });

    test('updates metricType and panelConfig.type to heatmap when metadata returns native-histogram', async () => {
      jest.mocked(getMetricType).mockResolvedValue('native-histogram');
      const panel = createPanel();

      await (panel as any).checkMetricMetadata(false);

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('heatmap');
    });

    test('updates metricType but skips panelConfig.type when discardPanelTypeUpdates=true', async () => {
      jest.mocked(getMetricType).mockResolvedValue('native-histogram');
      const panel = createPanel();

      await (panel as any).checkMetricMetadata(true);

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('timeseries');
    });

    test('guard: skips panelConfig.type update when already heatmap (Path B already ran)', async () => {
      jest.mocked(getMetricType).mockResolvedValue('native-histogram');
      const panel = createPanel();

      // Simulate Path B (subscribeToStateChanges) having already set type to heatmap
      panel.setState({ panelConfig: { ...panel.state.panelConfig, type: 'heatmap' } });

      await (panel as any).checkMetricMetadata(false);

      // metricType is updated but type is NOT changed (guard prevents redundant rebuild)
      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('heatmap');
    });

    test('updates metricType from counter to gauge when metadata disagrees', async () => {
      jest.mocked(getMetricTypeSync).mockReturnValue('counter' as any);
      jest.mocked(getMetricType).mockResolvedValue('gauge');
      const panel = createPanel();

      await (panel as any).checkMetricMetadata(false);

      expect(panel.state.metricType).toBe('gauge');
      expect(panel.state.panelConfig.type).toBe('timeseries');
    });
  });

  describe('subscribeToStateChanges', () => {
    test('sets metricType and panelConfig.type to heatmap when data frame is HeatmapCells', () => {
      const { provider, fire } = createMockDataProvider();
      const panel = createPanel();
      panel.setState({ body: { state: { $data: provider } } as any });

      (panel as any).subscribeToStateChanges(false);

      fire({
        data: {
          state: LoadingState.Done,
          series: [{ meta: { type: DataFrameType.HeatmapCells } }],
        },
      });

      expect(panel.state.metricType).toBe('native-histogram');
      expect(panel.state.panelConfig.type).toBe('heatmap');
    });

    test('guard: returns early when panelConfig.type is already heatmap (Path A already ran)', () => {
      const { provider, fire } = createMockDataProvider();
      const panel = createPanel();

      // Simulate Path A (checkMetricMetadata) having already set type to heatmap
      panel.setState({ panelConfig: { ...panel.state.panelConfig, type: 'heatmap' } });
      panel.setState({ body: { state: { $data: provider } } as any });

      (panel as any).subscribeToStateChanges(false);

      const setStateSpy = jest.spyOn(panel, 'setState');
      fire({
        data: {
          state: LoadingState.Done,
          series: [{ meta: { type: DataFrameType.HeatmapCells } }],
        },
      });

      expect(setStateSpy).not.toHaveBeenCalled();
    });

    test('unsubscribes after first Done event', () => {
      const { provider, subscription, fire } = createMockDataProvider();
      const panel = createPanel();
      panel.setState({ body: { state: { $data: provider } } as any });

      (panel as any).subscribeToStateChanges(false);

      fire({
        data: {
          state: LoadingState.Done,
          series: [{ meta: { type: 'some-non-heatmap-type' } }],
        },
      });

      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('does not subscribe when discardPanelTypeUpdates=true', () => {
      const { provider } = createMockDataProvider();
      const panel = createPanel();
      panel.setState({ body: { state: { $data: provider } } as any });

      (panel as any).subscribeToStateChanges(true);

      expect(provider.subscribeToState).not.toHaveBeenCalled();
    });

    test('does not subscribe when metricType is already native-histogram', () => {
      jest.mocked(getMetricTypeSync).mockReturnValue('native-histogram' as any);
      const panel = createPanel();
      const { provider } = createMockDataProvider();
      panel.setState({ body: { state: { $data: provider } } as any });

      (panel as any).subscribeToStateChanges(false);

      expect(provider.subscribeToState).not.toHaveBeenCalled();
    });
  });
});
