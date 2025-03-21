import { type AdHocVariableFilter } from '@grafana/data';
import { setDataSourceSrv, type DataSourceWithBackend } from '@grafana/runtime';
import { AdHocFiltersVariable, SceneCSSGridLayout, sceneGraph } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DataTrail } from '../DataTrail';
import { getTrailStore, TrailStore } from './TrailStore';
import { MetricSelectScene } from '../MetricSelect/MetricSelectScene';
import { DataSourceType, mockDataSource, MockDataSourceSrv } from '../mocks/datasource';
import { MetricSelectedEvent, VAR_FILTERS } from '../shared';
import { activateFullSceneTree } from '../utils/utils.testing';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
  getDataSourceSrv: jest.fn(() => {
    return {
      get: (ds: DataSourceWithBackend) => Promise.resolve(ds),
      getList: () => [mockDataSource],
      getInstanceSettings: (ref: DataSourceRef) => ({
        id: 1,
        uid: 'ds',
        type: DataSourceType.Prometheus,
        name: 'Prometheus',
        jsonData: {},
        access: 'proxy',
        readOnly: false,
      }),
    };
  }),

  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn().mockReturnValue([{ key: 'origKey', operator: '=', value: '' }]),
  }),
}));

describe('TrailStore', () => {
  let store: TrailStore;

  beforeEach(() => {
    localStorage.clear();
    store = new TrailStore();
  });

  it('should store and retrieve recent trails', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    store.setRecentTrail(trail);
    expect(store.recent.length).toBe(1);
    expect(store.recent[0].resolve().state.metric).toBe('test_metric');
  });

  it('should store and retrieve bookmarks', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    store.addBookmark(trail);
    expect(store.bookmarks.length).toBe(1);
    const bookmarkedTrail = store.getTrailForBookmarkIndex(0);
    expect(bookmarkedTrail.state.metric).toBe('test_metric');
  });

  it('should remove bookmarks', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    store.addBookmark(trail);
    expect(store.bookmarks.length).toBe(1);
    store.removeBookmark(0);
    expect(store.bookmarks.length).toBe(0);
  });

  it('should get bookmark index', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    store.addBookmark(trail);
    expect(store.getBookmarkIndex(trail)).toBe(0);
  });

  it('should handle filters in trails', () => {
    const trail = new DataTrail({});
    const filters: AdHocVariableFilter[] = [{ key: 'test_key', operator: '=', value: 'test_value' }];
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
    if (filtersVar instanceof AdHocFiltersVariable) {
      filtersVar.setState({ filters });
    }
    store.addBookmark(trail);
    const bookmarkedTrail = store.getTrailForBookmarkIndex(0);
    const bookmarkedFiltersVar = sceneGraph.lookupVariable(VAR_FILTERS, bookmarkedTrail);
    if (bookmarkedFiltersVar instanceof AdHocFiltersVariable) {
      expect(bookmarkedFiltersVar.state.filters[0]).toMatchObject(filters[0]);
    }
  });

  it('should handle time range in recent trails', () => {
    const trail = new DataTrail({});
    trail.state.$timeRange?.setState({ from: 'now-1h', to: 'now' });
    store.setRecentTrail(trail);
    const recentTrail = store.recent[0].resolve();
    expect(recentTrail.state.$timeRange?.state.from).toBe('now-1h');
    expect(recentTrail.state.$timeRange?.state.to).toBe('now');
  });

  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());

    let localStore: Record<string, string> = {};

    const localStorageMock = {
      getItem: jest.fn((key) => (key in localStore ? localStore[key] : null)),
      setItem: jest.fn(jest.fn((key, value) => (localStore[key] = value + ''))),
      clear: jest.fn(() => (localStore = {})),
    };
    global.localStorage = localStorageMock as unknown as Storage;

    jest.useFakeTimers();

    // Having the mock service set up is required for activating the loaded trails
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: {
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
          uid: 'ds',
        },
      })
    );
  });

  describe('Empty store', () => {
    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should have no bookmarked trails', () => {
      expect(store.bookmarks.length).toBe(0);
    });
  });

  it('should add a new recent trail with equivalent state', () => {
    const trail = new DataTrail({});
    const ds = new MockDataSourceSrv({ ds: mockDataSource });
    setDataSourceSrv(ds);

    // Initialize trail with required state
    trail.setState({
      metric: 'initial_metric',
      topScene: new MetricSelectScene({
        $variables: trail.state.$variables,
        body: new SceneCSSGridLayout({
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: '175px',
          children: [],
          isLazy: true,
        }),
      }),
    });

    // Activate scene tree to ensure all components are ready
    activateFullSceneTree(trail);

    // Trigger metric selection event
    trail.publishEvent(new MetricSelectedEvent('test_metric'));

    // Verify recent trails
    const store = getTrailStore();
    expect(store.recent.length).toBe(1);
    const recentTrail = store.recent[0].resolve();
    expect(recentTrail.state.metric).toBe('test_metric');
  });
});
