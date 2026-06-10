import { removeIgnoreUsageLabel } from 'shared/utils/utils.queries';

import { transformExploreQuery } from './ExploreAction';

jest.mock('@grafana/i18n', () => ({
  t: (_key: string, fallback: string) => fallback,
}));

jest.mock('@grafana/runtime', () => ({
  config: { appSubUrl: '' },
}));

jest.mock('@grafana/scenes', () => ({
  getExploreURL: jest.fn(),
  sceneGraph: {},
  VizPanel: jest.fn(),
}));

jest.mock('shared/utils/utils.queries', () => ({
  removeIgnoreUsageLabel: jest.fn(),
}));

const query = (value: Record<string, unknown>): Parameters<typeof transformExploreQuery>[0] =>
  value as unknown as Parameters<typeof transformExploreQuery>[0];

describe('transformExploreQuery', () => {
  beforeEach(() => {
    jest.mocked(removeIgnoreUsageLabel).mockImplementation((expr: string) => `cleaned:${expr}`);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('removes the Drilldown legend format from Explore queries', () => {
    expect(transformExploreQuery(query({ expr: 'avg(metric)', legendFormat: 'avg', refId: 'A', fromExploreMetrics: true }))).toEqual({
      expr: 'cleaned:avg(metric)',
      refId: 'A',
      fromExploreMetrics: true,
    });
    expect(removeIgnoreUsageLabel).toHaveBeenCalledWith('avg(metric)');
  });

  it('removes Drilldown legendFormat even when the query has no expr', () => {
    expect(transformExploreQuery(query({ legendFormat: 'status', refId: 'B', fromExploreMetrics: true }))).toEqual({
      refId: 'B',
      fromExploreMetrics: true,
    });
    expect(removeIgnoreUsageLabel).not.toHaveBeenCalled();
  });

  it('keeps legendFormat for queries not marked as Drilldown queries', () => {
    expect(transformExploreQuery(query({ expr: 'avg(metric)', legendFormat: 'custom', refId: 'A' }))).toEqual({
      expr: 'cleaned:avg(metric)',
      legendFormat: 'custom',
      refId: 'A',
    });
  });
});
