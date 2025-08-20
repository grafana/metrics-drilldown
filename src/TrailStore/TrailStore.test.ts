import { setDataSourceSrv, type DataSourceWithBackend } from '@grafana/runtime';

import { RECENT_TRAILS_KEY, TrailStore } from './TrailStore';
import { DataSourceType, MockDataSourceSrv } from '../mocks/datasource';
import { dataSourceStub } from '../stubs/dataSourceStub';
import { PREF_KEYS } from '../UserPreferences/pref-keys';
import { userPreferences } from '../UserPreferences/userPreferences';

const getDataSourceSrvSpy = jest.fn();

jest.doMock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: getDataSourceSrvSpy,
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn().mockReturnValue([{ key: 'origKey', operator: '=', value: '' }]),
  }),
}));

const URL_VALUES_BOOKMARK = {
  metric: 'bookmarked_metric',
  nativeHistogramMetric: '',
  from: 'now-1h',
  to: 'now',
  timezone: 'browser',
  // 'var-ds': 'edwxqcebl0cg0c',
  'var-filters': [],
  // 'var-variant': 'onboard-filters-sidebar',
  // 'var-labelsWingman': '',
  'var-groupby': '$__all',
};

describe('TrailStore', () => {
  let store: TrailStore;

  beforeEach(() => {
    store = new TrailStore();

    getDataSourceSrvSpy.mockImplementation(() => {
      return {
        get: (ds: DataSourceWithBackend) => Promise.resolve(ds),
        getList: () => [dataSourceStub],
        getInstanceSettings: () => ({
          id: 1,
          uid: 'ds',
          type: DataSourceType.Prometheus,
          name: 'Prometheus',
          jsonData: {},
          access: 'proxy',
          readOnly: false,
        }),
      };
    });

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

  describe('Initialize store with one recent trail with final current step', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const urlSerializedTrails = [
      {
        // this has no metric nor labels so it will be ignored
        urlValues: {
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
          'var-filters': [],
          refresh: '',
          nativeHistogramMetric: '',
        },
      },
      {
        urlValues: {
          metric: 'access_permissions_duration_count',
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
          'var-filters': [],
          refresh: '',
          nativeHistogramMetric: '',
        },
      },
    ];

    beforeEach(() => {
      userPreferences.clear();
      userPreferences.setItem(RECENT_TRAILS_KEY, [{ urlSerializedTrails }]);
      store.load();
    });

    it('should accurately load recent trails', () => {
      expect(store.recent.length).toBe(1);
    });

    it('should have no bookmarked trails', () => {
      expect(store.bookmarks.length).toBe(0);
    });
  });

  describe('Initialize store with one bookmark trail but no recent trails', () => {
    beforeEach(() => {
      userPreferences.clear();
      userPreferences.setItem(PREF_KEYS.BOOKMARKS, [
        {
          urlValues: URL_VALUES_BOOKMARK,
        },
      ]);
      store.load();
    });

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load bookmarked trails xx', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('bookmarked_metric');
    });

    it('should save a new recent trail based on the bookmark', () => {
      expect(store.recent.length).toBe(0);
      const trail = store.getTrailForBookmarkIndex(0);
      // Trail must be activated first
      trail.activate();
      store.setRecentTrail(trail);
      expect(store.recent.length).toBe(1);
    });

    it('should be able to obtain index of bookmark', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('index should be undefined for removed bookmarks', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      store.removeBookmark(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('index should be undefined for a trail that has changed since it was bookmarked', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('should be able to obtain index of a bookmark for a trail that changed back to bookmarked state', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const bookmarkedMetric = trail.state.metric;
      trail.setState({ metric: 'something_completely_different' });
      trail.setState({ metric: bookmarkedMetric });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('should remove a bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      store.removeBookmark(0);
      expect(store.bookmarks.length).toBe(0);

      jest.advanceTimersByTime(2000);
      expect(userPreferences.getItem(PREF_KEYS.BOOKMARKS)).toStrictEqual([]);
    });
  });

  describe('Initialize store with one legacy bookmark trail', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    beforeEach(() => {
      userPreferences.clear();
      userPreferences.setItem(PREF_KEYS.BOOKMARKS, [
        {
          history: [
            {
              urlValues: {
                from: 'now-1h',
                to: 'now',
                timezone,
                'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
                'var-filters': [],
                refresh: '',
                nativeHistogramMetric: '',
              },
              type: 'start',
              description: 'Test',
            },
            {
              urlValues: {
                metric: 'access_permissions_duration_count',
                from: 'now-1h',
                to: 'now',
                timezone,
                'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
                'var-filters': [],
                refresh: '',
                nativeHistogramMetric: '',
              },
              type: 'time',
              description: 'Test',
            },
          ],
        },
      ]);
      store.load();
    });

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load legacy bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('access_permissions_duration_count');
    });
  });

  describe('Initialize store with one legacy bookmark trail not bookmarked on final step', () => {
    beforeEach(() => {
      userPreferences.clear();
      userPreferences.setItem(PREF_KEYS.BOOKMARKS, [
        {
          history: [
            {
              urlValues: {
                from: 'now-1h',
                to: 'now',
                'var-ds': 'prom-mock',
                'var-filters': [],
                refresh: '',
                nativeHistogramMetric: '',
              },
              type: 'start',
            },
            {
              urlValues: {
                metric: 'bookmarked_metric',
                from: 'now-1h',
                to: 'now',
                'var-ds': 'prom-mock',
                'var-filters': [],
                refresh: '',
                nativeHistogramMetric: '',
              },
              type: 'time',
            },
            {
              urlValues: {
                metric: 'some_other_metric',
                from: 'now-1h',
                to: 'now',
                'var-ds': 'prom-mock',
                'var-filters': [],
                refresh: '',
                nativeHistogramMetric: '',
              },
              type: 'metric',
            },
          ],
          currentStep: 1,
        },
      ]);
      store.load();
    });

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load legacy bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('bookmarked_metric');
    });
  });

  describe('Initialize store with one bookmark matching recent trail not on final step', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    beforeEach(() => {
      userPreferences.clear();
      userPreferences.setItem(RECENT_TRAILS_KEY, [
        {
          urlValues: {
            metric: 'other_metric',
            nativeHistogramMetric: '',
            from: 'now-1h',
            to: 'now',
            timezone,
            'var-ds': 'prom-mock',
            'var-filters': [],
            refresh: '',
          },
        },
      ]);
      userPreferences.setItem(PREF_KEYS.BOOKMARKS, [
        {
          urlValues: URL_VALUES_BOOKMARK,
        },
      ]);
      store.load();
    });

    it('should have 1 recent trail', () => {
      expect(store.recent.length).toBe(1);
    });

    it('should accurately load bookmarked trail from matching recent', () => {
      expect(store.bookmarks.length).toBe(1);
      expect(store.recent.length).toBe(1);
    });

    it('should save a new recent trail based on the bookmark', () => {
      expect(store.recent.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      store.setRecentTrail(trail);
      expect(store.recent.length).toBe(1);
    });

    it('should be able to obtain index of bookmark', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('index should be undefined for removed bookmarks', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      store.removeBookmark(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('index should be undefined for a trail that has changed since it was bookmarked', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('should be able to obtain index of a bookmark for a trail that changed back to bookmarked state', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      expect(store.getBookmarkIndex(trail)).toBe(undefined);
      trail.setState({ metric: 'bookmarked_metric' });
      expect(store.getBookmarkIndex(trail)).toBe(0);
    });

    it('should remove a bookmark', async () => {
      expect(store.bookmarks.length).toBe(1);
      store.removeBookmark(0);
      expect(store.bookmarks.length).toBe(0);

      jest.advanceTimersByTime(2000);
      expect(userPreferences.getItem(PREF_KEYS.BOOKMARKS)).toStrictEqual([]);
    });
  });
});
