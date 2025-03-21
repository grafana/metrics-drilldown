import { type AdHocVariableFilter } from '@grafana/data';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { mockDataSource, MockDataSourceSrv } from './mocks/datasource';
import { MetricSelectedEvent, VAR_FILTERS } from './shared';
import { getTrailStore } from './TrailStore/TrailStore';
import { activateFullSceneTree } from './utils/utils.testing';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
}));

describe('DataTrail', () => {
  beforeEach(() => {
    localStorage.clear();
    setDataSourceSrv(new MockDataSourceSrv({ ds: mockDataSource }));
  });

  it('should initialize with default state', () => {
    const trail = new DataTrail({});
    expect(trail.state.metric).toBeUndefined();
    expect(trail.state.metricSearch).toBeUndefined();
  });

  it('should update metric state', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    expect(trail.state.metric).toBe('test_metric');
  });

  it('should update metric search state', () => {
    const trail = new DataTrail({});
    trail.setState({ metricSearch: 'test_search' });
    expect(trail.state.metricSearch).toBe('test_search');
  });

  it('should handle filters', () => {
    const trail = new DataTrail({});
    const filters: AdHocVariableFilter[] = [{ key: 'test_key', operator: '=', value: 'test_value' }];
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
    if (filtersVar instanceof AdHocFiltersVariable) {
      filtersVar.setState({ filters });
      expect(filtersVar.state.filters).toEqual(filters);
    }
  });

  it('should be added to recent trails when metric is selected', () => {
    const trail = new DataTrail({});
    activateFullSceneTree(trail);
    trail.publishEvent(new MetricSelectedEvent('test_metric'));
    const store = getTrailStore();
    expect(store.recent.length).toBe(1);
    expect(store.recent[0].resolve().state.metric).toBe('test_metric');
  });

  it('should handle bookmarks', () => {
    const trail = new DataTrail({});
    trail.setState({ metric: 'test_metric' });
    const store = getTrailStore();
    store.addBookmark(trail);
    expect(store.bookmarks.length).toBe(1);
    const bookmarkedTrail = store.getTrailForBookmarkIndex(0);
    expect(bookmarkedTrail.state.metric).toBe('test_metric');
  });

  describe('Given starting non-embedded trail with url sync and no url state', () => {
    let trail: DataTrail;
    const preTrailUrl = '/';

    beforeEach(() => {
      trail = new DataTrail({});
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
    });

    it('Should default to metric select scene', () => {
      expect(trail.state.topScene).toBeInstanceOf(MetricSelectScene);
    });

    describe('And metric is selected', () => {
      beforeEach(() => {
        trail.publishEvent(new MetricSelectedEvent('metric_bucket'));
      });

      it('should switch scene to MetricScene', () => {
        expect(trail.state.metric).toBe('metric_bucket');
        expect(trail.state.topScene).toBeInstanceOf(MetricScene);
      });

      it('should sync state with url', () => {
        expect(trail.getUrlState().metric).toBe('metric_bucket');
      });

      it('Should have time range `from` be default "now-6h"', () => {
        expect(trail.state.$timeRange?.state.from).toBe('now-6h');
      });

      describe('And browser back button is pressed', () => {
        beforeEach(() => {
          locationService.getHistory().goBack();
        });

        it('Should return to original URL', () => {
          const { pathname } = locationService.getLocation();
          expect(pathname).toEqual(preTrailUrl);
        });
      });

      describe('And when changing the time range `from` to "now-1h"', () => {
        beforeEach(() => {
          trail.state.$timeRange?.setState({ from: 'now-1h' });
        });

        it('Should have time range `from` be updated "now-1h"', () => {
          expect(trail.state.$timeRange?.state.from).toBe('now-1h');
        });
      });

      it('Should have default empty filter', () => {
        const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
        if (filtersVar instanceof AdHocFiltersVariable) {
          expect(filtersVar.state.filters.length).toBe(0);
        }
      });

      describe('And when changing the filter to zone=a', () => {
        beforeEach(() => {
          const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
          if (filtersVar instanceof AdHocFiltersVariable) {
            filtersVar.setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
          }
        });

        it('Should have filter be updated to "zone=a"', () => {
          const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
          if (filtersVar instanceof AdHocFiltersVariable) {
            expect(filtersVar.state.filters[0].key).toBe('zone');
            expect(filtersVar.state.filters[0].value).toBe('a');
          }
        });
      });
    });
  });
});
