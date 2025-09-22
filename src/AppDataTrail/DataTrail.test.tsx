/* eslint-disable sonarjs/no-nested-functions */
import { dateTime, LoadingState } from '@grafana/data';
import { locationService, setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { of } from 'rxjs';

import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';

import { DataTrail } from './DataTrail';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricSelectedEvent, VAR_FILTERS } from '../shared';
import { DataSourceType, MockDataSourceSrv } from '../test/mocks/datasource';
import { activateFullSceneTree } from '../utils/utils.testing';
import { isAdHocFiltersVariable } from '../utils/utils.variables';

function getFilterVar(trail: DataTrail) {
  const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  if (isAdHocFiltersVariable(variable)) {
    return variable;
  }
  throw new Error('getFilterVar failed');
}

describe('DataTrail', () => {
  beforeAll(async () => {
    const dataSourceSrv = new MockDataSourceSrv({
      prom: {
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
        uid: 'ds',
      },
    });
    setDataSourceSrv(dataSourceSrv);
    setRunRequest(() =>
      of({
        state: LoadingState.Done,
        series: [],
        timeRange: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: '', to: '' },
        },
      })
    );
  });

  describe('Given starting non-embedded trail with url sync and no url state', () => {
    let trail: DataTrail;
    const preTrailUrl = '/';

    beforeEach(() => {
      trail = new DataTrail({});
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
    });

    it('Should default to metric reducer scene', () => {
      expect(trail.state.topScene).toBeInstanceOf(MetricsReducer);
    });

    describe('And metric is selected', () => {
      beforeEach(() => {
        // ensure metric_bucket is cached as a classic histogram by MetricDatasourceHelper
        const metricsVariable = sceneGraph.findByKeyAndType(trail, VAR_METRICS_VARIABLE, MetricsVariable);
        metricsVariable.setState({ options: [{ value: 'metric_bucket', label: 'metric_bucket' }] });

        trail.publishEvent(new MetricSelectedEvent({ metric: 'metric_bucket' }));
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

      describe('And when changing the time range `from` to "now-1h"', () => {
        beforeEach(() => {
          trail.state.$timeRange?.setState({ from: 'now-1h' });
        });

        it('Should have time range `from` be updated "now-1h"', () => {
          expect(trail.state.$timeRange?.state.from).toBe('now-1h');
        });
      });

      it('Should have default empty filter', () => {
        expect(getFilterVar(trail).state.filters.length).toBe(0);
      });

      describe('And when changing the filter to zone=a', () => {
        beforeEach(() => {
          getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
        });

        it('Should have filter be updated to "zone=a"', () => {
          expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
          expect(getFilterVar(trail).state.filters[0].value).toBe('a');
        });
      });
    });

    describe('And filter is added zone=a', () => {
      beforeEach(() => {
        getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
      });

      it('Filter of trail should be zone=a', () => {
        expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
        expect(getFilterVar(trail).state.filters[0].value).toBe('a');
      });
    });

    describe('And time range is changed to now-15m to now', () => {
      beforeEach(() => {
        trail.state.$timeRange?.setState({ from: 'now-15m' });
      });

      it('Time range `from` should be now-15m', () => {
        expect(trail.state.$timeRange?.state.from).toBe('now-15m');
      });
    });
  });

  describe('Label filters', () => {
    let trail: DataTrail;

    beforeEach(() => {
      trail = new DataTrail({});
    });

    it('should not escape regex metacharacters in label values', () => {
      const filterVar = getFilterVar(trail);
      filterVar.setState({ filters: [{ key: 'app', operator: '=~', value: '.*end' }] }); // matches app=frontend, app=backend, etc.
      expect(filterVar.getValue()).toBe('app=~".*end"');
    });

    it('should escape any equal sign (=) present in label values', () => {
      const filterVar = getFilterVar(trail);
      filterVar.setState({ filters: [{ key: 'app', operator: '=~', value: 'start=4,end=2' }] });
      expect(filterVar.getValue()).toBe(`app=~"start\=4,end\=2"`);
    });
  });
});
