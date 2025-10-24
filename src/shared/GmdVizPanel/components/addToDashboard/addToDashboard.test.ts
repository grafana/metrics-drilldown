import { sceneGraph } from '@grafana/scenes';

import { isSceneQueryRunner } from 'shared/utils/utils.queries';

import { getPanelData, type PanelDataRequestPayload } from './addToDashboard';
import { EventOpenAddToDashboard } from './EventOpenAddToDashboard';

jest.mock('@grafana/scenes');
jest.mock('shared/utils/utils.queries');

describe('getPanelData', () => {
  const mockTimeRange = {
    state: { value: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } } },
  };

  const mockQueryRunner = {
    state: {
      queries: [{ expr: 'test_metric', legendFormat: 'test', fromExploreMetrics: true }],
      datasource: { type: 'prometheus', uid: 'test-uid' },
      maxDataPoints: 1000,
    },
  };

  const mockVizPanel = {
    state: {
      pluginId: 'timeseries',
      title: 'Test Panel',
      options: { legend: { displayMode: 'list' } },
      fieldConfig: { defaults: {}, overrides: [] },
      description: 'Test description',
    },
  };

  beforeEach(() => {
    (sceneGraph.getData as jest.Mock).mockReturnValue({});
    (sceneGraph.findObject as jest.Mock).mockReturnValue(mockQueryRunner);
    (sceneGraph.getTimeRange as jest.Mock).mockReturnValue(mockTimeRange);
    (sceneGraph.interpolate as jest.Mock).mockImplementation((_, value) => value);
    (isSceneQueryRunner as unknown as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return panel and range', () => {
    const result = getPanelData(mockVizPanel as any);

    expect(result).toHaveProperty('panel');
    expect(result).toHaveProperty('range');
    expect(result.range).toBe(mockTimeRange.state.value);
  });

  it('should extract panel type and title', () => {
    const result = getPanelData(mockVizPanel as any);

    expect(result.panel.type).toBe('timeseries');
    expect(result.panel.title).toBe('Test Panel');
  });

  it('should remove fromExploreMetrics from queries', () => {
    const result = getPanelData(mockVizPanel as any);

    expect(result.panel.targets).toBeDefined();
    expect(result.panel.targets?.length).toBe(1);
    expect(result.panel.targets?.[0]?.fromExploreMetrics).toBe(false);
  });

  it('should include datasource info', () => {
    const result = getPanelData(mockVizPanel as any);

    expect(result.panel.datasource).toEqual({ type: 'prometheus', uid: 'test-uid' });
  });

  it('should include panel options and fieldConfig', () => {
    const result = getPanelData(mockVizPanel as any);

    expect(result.panel.options).toBe(mockVizPanel.state.options);
    expect(result.panel.fieldConfig).toBe(mockVizPanel.state.fieldConfig);
  });
});

describe('EventOpenAddToDashboard', () => {
  it('should create event with panel data payload', () => {
    const mockPanelData: PanelDataRequestPayload = {
      panel: {
        type: 'timeseries',
        title: 'Test Panel',
        targets: [],
        datasource: { type: 'prometheus', uid: 'test-uid' },
      },
      range: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } },
    } as any;

    const event = new EventOpenAddToDashboard({ panelData: mockPanelData });

    expect(event.payload.panelData).toBe(mockPanelData);
    expect(EventOpenAddToDashboard.type).toBe('open-add-to-dashboard');
  });
});
