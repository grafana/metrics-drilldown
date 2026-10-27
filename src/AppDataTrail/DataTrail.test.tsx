import { dateTime, LoadingState, urlUtil } from '@grafana/data';
import { locationService, LocationServiceProvider, setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import { sceneGraph, sceneUtils, UrlSyncContextProvider } from '@grafana/scenes';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';
import { of } from 'rxjs';

import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import { type PanelDataRequestPayload } from 'shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { EventOpenCreateAlert } from 'shared/GmdVizPanel/components/createAlert/EventOpenCreateAlert';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

import { DataTrail } from './DataTrail';
import { MetricsDrilldownDataSourceVariable } from './MetricsDrilldownDataSourceVariable';
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
      labels: {
        uid: LabelsDataSource.uid,
      },
    });
    const labelsDataSource = await dataSourceSrv.get(LabelsDataSource.uid);
    labelsDataSource.metricFindQuery = async () => [];
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
        expect(getFilterVar(trail).state.filters).toHaveLength(0);
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

  beforeAll(() => {
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: { name: 'Prometheus', type: DataSourceType.Prometheus, uid: 'ds' },
      })
    );
  });

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

    it('returns empty array for metricType when no entries have metricType', () => {
      trail.setState({
        metric: 'my_metric',
        sourceMetrics: [{ metricName: 'my_metric', labels: [] }],
      });

      const urlState = trail.getUrlState();

      expect(urlState.metricType).toEqual([]);
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

  describe('binaryQuery (ratio) URL sync', () => {
    const BINARY = 'sum(rate(errors_total{status=~"5.."}[5m])) / sum(rate(requests_total[5m]))';

    it('emits binaryQuery in getUrlState when set', () => {
      trail.setState({ binaryQuery: BINARY });

      expect(trail.getUrlState().binaryQuery).toBe(BINARY);
    });

    it('omits binaryQuery when not set', () => {
      expect(trail.getUrlState().binaryQuery).toBeUndefined();
    });

    it('accepts a valid binary query from the URL', () => {
      trail.updateFromUrl({ binaryQuery: BINARY });

      expect(trail.state.binaryQuery).toBe(BINARY);
    });

    it('rejects a malformed binaryQuery and stays in non-binary mode', () => {
      trail.updateFromUrl({ binaryQuery: 'errors_total{' });

      expect(trail.state.binaryQuery).toBeUndefined();
      expect(trail.state.topScene).toBeInstanceOf(MetricsReducer);
    });

    it('rejects a non-binary query (single metric)', () => {
      trail.updateFromUrl({ binaryQuery: 'just_a_metric' });

      expect(trail.state.binaryQuery).toBeUndefined();
    });

    it('round-trips a binary query through renderUrl + URL parsing without corruption', () => {
      trail.setState({ metric: 'errors_total', binaryQuery: BINARY });

      const url = urlUtil.renderUrl('/drilldown', trail.getUrlState());
      const search = new URLSearchParams(url.substring(url.indexOf('?') + 1));

      const target = new DataTrail({});
      target.updateFromUrl({
        metric: search.get('metric') ?? undefined,
        binaryQuery: search.get('binaryQuery') ?? undefined,
      });

      expect(target.state.binaryQuery).toBe(BINARY);
    });
  });

  describe('URL round-trip through Scenes sync layer', () => {
    it('preserves multiple metricType params from a raw query string', () => {
      activateFullSceneTree(trail);

      sceneUtils.syncStateFromSearchParams(
        trail,
        new URLSearchParams('metric=metric_a&metricType=counter-metric_a&metricType=gauge-metric_b')
      );

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], metricType: 'counter' },
        { metricName: 'metric_b', labels: [], metricType: 'gauge' },
      ]);
    });

    it('preserves multiple customFunction params from a raw query string', () => {
      activateFullSceneTree(trail);

      sceneUtils.syncStateFromSearchParams(
        trail,
        new URLSearchParams('metric=metric_a&customFunction=max_over_time-metric_a&customFunction=min_over_time-metric_b')
      );

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], customFunction: 'max_over_time' },
        { metricName: 'metric_b', labels: [], customFunction: 'min_over_time' },
      ]);
    });

    it('preserves mixed metricType and customFunction params', () => {
      activateFullSceneTree(trail);

      sceneUtils.syncStateFromSearchParams(
        trail,
        new URLSearchParams(
          'metric=metric_a&metricType=counter-metric_a&metricType=histogram-metric_b&customFunction=max_over_time-metric_a'
        )
      );

      expect(trail.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], metricType: 'counter', customFunction: 'max_over_time' },
        { metricName: 'metric_b', labels: [], metricType: 'histogram' },
      ]);
    });

    it('round-trips getUrlState through urlUtil.renderUrl without losing entries', () => {
      trail.setState({
        metric: 'metric_a',
        sourceMetrics: [
          { metricName: 'metric_a', labels: [], metricType: 'counter' },
          { metricName: 'metric_b', labels: [], metricType: 'gauge' },
        ],
      });

      const urlState = trail.getUrlState();
      const rendered = urlUtil.renderUrl('', urlState);

      const trail2 = new DataTrail({});
      activateFullSceneTree(trail2);
      sceneUtils.syncStateFromSearchParams(trail2, new URLSearchParams(rendered));

      expect(trail2.state.sourceMetrics).toEqual([
        { metricName: 'metric_a', labels: [], metricType: 'counter' },
        { metricName: 'metric_b', labels: [], metricType: 'gauge' },
      ]);
    });
  });
});

describe('DataTrail datasource URL synchronization', () => {
  beforeEach(() => {
    locationService.push('/');
    userStorage.clear();
  });

  afterEach(() => {
    userStorage.clear();
  });

  it('should preserve a validated standalone UID during initial URL sync', () => {
    const trail = new DataTrail({ initialDS: 'ds' });

    sceneUtils.syncStateFromSearchParams(trail, new URLSearchParams('var-ds=deleted-uid'));

    expect(sceneGraph.lookupVariable('ds', trail)?.getValue()).toBe('ds');
  });

  it('should retain embedded namespaced datasource selection', () => {
    const trail = new DataTrail({ initialDS: 'ds', embedded: true });

    sceneUtils.syncStateFromSearchParams(trail, new URLSearchParams('var-ds=host-ds&gmd-var-ds=embedded-ds'), {
      namespace: 'gmd',
    });

    expect(sceneGraph.lookupVariable('ds', trail)?.getValue()).toBe('embedded-ds');
  });

  it('should ignore the host datasource URL when the embedded namespace is absent', () => {
    const trail = new DataTrail({ initialDS: 'embedded-ds', embedded: true });

    sceneUtils.syncStateFromSearchParams(trail, new URLSearchParams('var-ds=host-ds'), { namespace: 'gmd' });

    expect(sceneGraph.lookupVariable('ds', trail)?.getValue()).toBe('embedded-ds');
  });

  describe('with an activated datasource', () => {
    let trail: DataTrail;
    let variable: MetricsDrilldownDataSourceVariable;
    let deactivate: () => void;
    let rerender: ReturnType<typeof render>['rerender'];

    const renderScene = () => (
      <LocationServiceProvider service={locationService}>
        <Router location={locationService.getLocation()} navigator={locationService.getHistory()}>
          <UrlSyncContextProvider scene={trail} updateUrlOnInit={true} createBrowserHistorySteps={true}>
            <span />
          </UrlSyncContextProvider>
        </Router>
      </LocationServiceProvider>
    );

    beforeEach(() => {
      locationService.push('/?var-ds=deleted-uid');
      trail = new DataTrail({ initialDS: 'ds' });
      variable = sceneGraph.findByKeyAndType(trail, 'ds', MetricsDrilldownDataSourceVariable);
      ({ rerender } = render(renderScene()));
      act(() => {
        deactivate = variable.activate();
      });
    });

    afterEach(() => {
      act(() => deactivate());
    });

    it('should retain the validated UID after provider initialization and activation', () => {
      expect(variable.getValue()).toBe('ds');
      expect(locationService.getSearchObject()['var-ds']).toBe('ds');
    });

    it('should update the URL and stored preference when the picker changes', () => {
      act(() => variable.changeValueTo('embedded-ds', 'Embedded Prometheus', true));

      expect(locationService.getSearchObject()['var-ds']).toBe('embedded-ds');
      expect(userStorage.getItem(PREF_KEYS.DATASOURCE)).toBe('embedded-ds');
    });

    it('should update the datasource and stored preference when navigating', async () => {
      act(() => locationService.push('/?var-ds=embedded-ds'));
      rerender(renderScene());

      await waitFor(() => expect(variable.getValue()).toBe('embedded-ds'));
      expect(userStorage.getItem(PREF_KEYS.DATASOURCE)).toBe('embedded-ds');
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

describe('DataTrail - Create Alert', () => {
  let dataTrail: DataTrail;

  beforeAll(() => {
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

  beforeEach(() => {
    dataTrail = new DataTrail({});
  });

  it('should initialize with modal closed and component unavailable', () => {
    expect(dataTrail.state.isCreateAlertModalOpen).toBe(false);
    expect(dataTrail.state.isCreateAlertAvailable).toBe(false);
    expect(dataTrail.state.createAlertPanelData).toBeUndefined();
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

    dataTrail.openCreateAlertModal(mockPanelData);

    expect(dataTrail.state.isCreateAlertModalOpen).toBe(true);
    expect(dataTrail.state.createAlertPanelData).toBe(mockPanelData);
  });

  it('should close modal and clear panel data', () => {
    const mockPanelData: PanelDataRequestPayload = {
      panel: { type: 'timeseries', title: 'Test', targets: [], datasource: null },
      range: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } },
    } as any;

    dataTrail.openCreateAlertModal(mockPanelData);
    dataTrail.closeCreateAlertModal();

    expect(dataTrail.state.isCreateAlertModalOpen).toBe(false);
    expect(dataTrail.state.createAlertPanelData).toBeUndefined();
  });

  it('should open the modal with the event payload when EventOpenCreateAlert is published', () => {
    dataTrail.activate();

    const mockPanelData: PanelDataRequestPayload = {
      panel: { type: 'timeseries', title: 'Test', targets: [], datasource: { type: 'prometheus', uid: 'test' } },
      range: { from: 'now-1h', to: 'now', raw: { from: 'now-1h', to: 'now' } },
    } as any;

    dataTrail.publishEvent(new EventOpenCreateAlert({ panelData: mockPanelData }), true);

    expect(dataTrail.state.isCreateAlertModalOpen).toBe(true);
    expect(dataTrail.state.createAlertPanelData).toBe(mockPanelData);
  });
});

describe('DataTrail - exemplars url param', () => {
  let trail: DataTrail;

  beforeAll(() => {
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: { name: 'Prometheus', type: DataSourceType.Prometheus, uid: 'ds' },
      })
    );
  });

  beforeEach(() => {
    trail = new DataTrail({});
  });

  function getMainPanel() {
    const metricScene = trail.state.topScene as MetricScene;
    return sceneGraph.findDescendents(metricScene.state.body, GmdVizPanel)[0];
  }

  it('emits exemplars=true in the url state only while enabled', () => {
    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'true' });
    expect(trail.getUrlState().exemplars).toBe('true');

    trail.updateFromUrl({ metric: 'http_requests_total' });
    expect(trail.getUrlState().exemplars).toBeUndefined();
  });

  it('turns exemplars on from the url and starts the main panel with them enabled', () => {
    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'true' });

    expect(trail.state.exemplarsEnabled).toBe(true);
    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBe(true);
  });

  it('keeps exemplars off unless the url explicitly says true', () => {
    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'false' });

    expect(trail.state.exemplarsEnabled).toBe(false);
    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBeFalsy();
  });

  it('resets exemplars when another metric is selected, so the param does not carry over', () => {
    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'true' });

    trail.updateFromUrl({ metric: 'go_goroutines' });

    expect(trail.state.exemplarsEnabled).toBe(false);
    expect(trail.getUrlState().exemplars).toBeUndefined();
    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBeFalsy();
  });

  it('keeps the same metric scene when only the exemplars param changes', () => {
    trail.updateFromUrl({ metric: 'http_requests_total' });
    const topScene = trail.state.topScene;

    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'true' });

    expect(trail.state.topScene).toBe(topScene);
    expect(trail.state.exemplarsEnabled).toBe(true);
  });

  it('ignores the param when there is no metric to show exemplars for', () => {
    trail.updateFromUrl({ exemplars: 'true' });

    expect(trail.state.exemplarsEnabled).toBe(false);
    expect(trail.getUrlState().exemplars).toBeUndefined();
  });

  it('pushes a change of the trail state into the live main panel', () => {
    trail.updateFromUrl({ metric: 'http_requests_total' });
    const metricScene = trail.state.topScene as MetricScene;
    jest.spyOn(trail, 'getMetadataForMetric').mockResolvedValue(undefined);
    metricScene.state.body.activate();

    trail.setState({ exemplarsEnabled: true });
    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBe(true);

    trail.setState({ exemplarsEnabled: false });
    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBe(false);
  });

  it('syncs the main panel when it activates after the trail changed since the metric scene was built', () => {
    // Opening a bookmark saved with exemplars on builds the metric scene first, then applies the
    // bookmark's url values to the trail, before the scene has activated and subscribed to the trail.
    trail.updateFromUrl({ metric: 'http_requests_total' });
    trail.updateFromUrl({ metric: 'http_requests_total', exemplars: 'true' });
    const metricScene = trail.state.topScene as MetricScene;
    jest.spyOn(trail, 'getMetadataForMetric').mockResolvedValue(undefined);

    metricScene.state.body.activate();

    expect(getMainPanel().state.queryConfig.exemplarsEnabled).toBe(true);
  });
});
