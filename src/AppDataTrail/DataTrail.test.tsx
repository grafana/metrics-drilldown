import { dateTime, LoadingState } from '@grafana/data';
import { locationService, setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { of } from 'rxjs';

import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import { type PanelDataRequestPayload } from 'shared/GmdVizPanel/components/addToDashboard/addToDashboard';

import { DataTrail } from './DataTrail';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricSelectedEvent, VAR_FILTERS } from '../shared/shared';
import { activateFullSceneTree } from '../shared/utils/utils.testing';
import { isAdHocFiltersVariable } from '../shared/utils/utils.variables';
import { DataSourceType, MockDataSourceSrv } from '../test/mocks/datasource';

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

describe('DataTrail - URL serialization of KG overrides', () => {
  let trail: DataTrail;

  beforeEach(() => {
    trail = new DataTrail({});
  });

  describe('getUrlState', () => {
    it('emits metricType as an array of type-metric pairs', () => {
      trail.setState({
        metric: 'my_recording_rule',
        sourceMetrics: [{ metricName: 'my_recording_rule', labels: [], metricType: 'counter' }],
      });

      const urlState = trail.getUrlState();

      expect(urlState.metricType).toEqual(['counter-my_recording_rule']);
    });

    it('emits metricType for all source metrics with overrides, not just the active one', () => {
      trail.setState({
        metric: 'metric_a',
        sourceMetrics: [
          { metricName: 'metric_a', labels: [], metricType: 'counter' },
          { metricName: 'metric_b', labels: [], metricType: 'gauge' },
          { metricName: 'metric_c', labels: [] },
        ],
      });

      const urlState = trail.getUrlState();

      expect(urlState.metricType).toEqual(['counter-metric_a', 'gauge-metric_b']);
    });

    it('omits metricType when no entries have metricType', () => {
      trail.setState({
        metric: 'my_metric',
        sourceMetrics: [{ metricName: 'my_metric', labels: [] }],
      });

      const urlState = trail.getUrlState();

      expect(urlState.metricType).toBeUndefined();
    });
  });

  describe('updateFromUrl', () => {
    it('parses a single metricType and creates sourceMetrics override', () => {
      trail.updateFromUrl({ metric: 'my_rule', metricType: 'counter-my_rule' });

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'my_rule', labels: [], metricType: 'counter' },
      ]);
    });

    it('parses multiple metricType entries', () => {
      trail.updateFromUrl({
        metric: 'metric_a',
        metricType: ['counter-metric_a', 'gauge-metric_b'],
      });

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], metricType: 'counter' },
        { metricName: 'metric_b', labels: [], metricType: 'gauge' },
      ]);
    });

    it('creates sourceMetrics with both metricType and customRateInterval', () => {
      trail.updateFromUrl({
        metric: 'my_rule',
        metricType: 'counter-my_rule',
        customRateInterval: '5m',
      });

      expect(trail.state.sourceMetrics?.[0]?.metricType).toBe('counter');
      expect(trail.state.sourceMetrics?.[0]?.customRateInterval).toBe('5m');
    });

    it('merges metricType with customFunction on different metrics', () => {
      trail.updateFromUrl({
        metric: 'metric_a',
        metricType: 'counter-metric_a',
        customFunction: 'max_over_time-metric_b',
      });

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], metricType: 'counter' },
        { metricName: 'metric_b', labels: [], customFunction: 'max_over_time' },
      ]);
    });

    it('ignores invalid metricType values', () => {
      trail.updateFromUrl({ metric: 'my_rule', metricType: 'invalid-my_rule' });

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'my_rule', labels: [] },
      ]);
    });

    it('skips URL values in embedded mode', () => {
      trail.setState({ embedded: true });

      trail.updateFromUrl({ metric: 'my_rule', metricType: 'counter-my_rule' });

      expect(trail.state.metric).toBeUndefined();
    });
  });
});

describe('DataTrail - Add to Dashboard', () => {
  let dataTrail: DataTrail;

  beforeEach(() => {
    dataTrail = new DataTrail({});
  });

  it('should initialize with modal closed and component unavailable', () => {
    expect(dataTrail.state.isAddToDashboardModalOpen).toBe(false);
    expect(dataTrail.state.isAddToDashboardAvailable).toBe(false);
    expect(dataTrail.state.addToDashboardPanelData).toBeUndefined();
  });

  it('should open modal with panel data', () => {
    const mockPanelData: PanelDataRequestPayload = {
      panel: {
        type: 'timeseries',
        title: 'Test',
        targets: [],
        datasource: { type: 'prometheus', uid: 'test' },
      },
      range: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } },
    } as any;

    dataTrail.openAddToDashboardModal(mockPanelData);

    expect(dataTrail.state.isAddToDashboardModalOpen).toBe(true);
    expect(dataTrail.state.addToDashboardPanelData).toBe(mockPanelData);
  });

  it('should close modal and clear panel data', () => {
    const mockPanelData: PanelDataRequestPayload = {
      panel: { type: 'timeseries', title: 'Test', targets: [], datasource: null },
      range: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } },
    } as any;

    dataTrail.openAddToDashboardModal(mockPanelData);
    dataTrail.closeAddToDashboardModal();

    expect(dataTrail.state.isAddToDashboardModalOpen).toBe(false);
    expect(dataTrail.state.addToDashboardPanelData).toBeUndefined();
  });
});
