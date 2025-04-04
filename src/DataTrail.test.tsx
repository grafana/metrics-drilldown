import { VariableHide } from '@grafana/data';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { DataTrail } from './DataTrail';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { DataSourceType, MockDataSourceSrv } from './mocks/datasource';
import {
  MetricSelectedEvent,
  VAR_FILTERS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';
import { activateFullSceneTree } from './utils/utils.testing';
import { isAdHocFiltersVariable, isConstantVariable } from './utils/utils.variables';

jest.mock('./otel/api', () => ({
  totalOtelResources: jest.fn(() => ({ job: 'oteldemo', instance: 'instance' })),
  isOtelStandardization: jest.fn(() => true),
}));

describe('DataTrail', () => {
  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());
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

  afterAll(() => {
    jest.restoreAllMocks();
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

  describe('OTel resources attributes', () => {
    let trail: DataTrail;

    // selecting a non promoted resource from VAR_OTEL_AND_METRICS will automatically update the otel resources var
    const nonPromotedOtelResources = ['deployment_environment'];
    const preTrailUrl =
      '/trail?from=now-1h&to=now&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=k8s_cluster_name%7C%3D%7Cappo11ydev01&var-filters=&refresh=&metricPrefix=all&metricSearch=http&actionView=breakdown&var-groupby=$__all&metric=http_client_duration_milliseconds_bucket';

    function getOtelAndMetricsVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
      if (isAdHocFiltersVariable(variable)) {
        return variable;
      }
      throw new Error('getOtelAndMetricsVar failed');
    }

    function getOtelJoinQueryVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
      if (isConstantVariable(variable)) {
        return variable;
      }
      throw new Error('getOtelJoinQueryVar failed');
    }

    function getOtelResourcesVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
      if (isAdHocFiltersVariable(variable)) {
        return variable;
      }
      throw new Error('getOtelResourcesVar failed');
    }

    function getOtelGroupLeftVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
      if (isConstantVariable(variable)) {
        return variable;
      }
      throw new Error('getOtelGroupLeftVar failed');
    }

    beforeEach(() => {
      trail = new DataTrail({
        nonPromotedOtelResources,
        // before checking, things should be hidden
        initialOtelCheckComplete: false,
      });
      locationService.push(preTrailUrl);
      activateFullSceneTree(trail);
      getOtelGroupLeftVar(trail).setState({ value: 'attribute1,attribute2' });
    });
    // default otel experience to off
    it('clicking start button should start with OTel off and showing var filters', () => {
      trail.setState({ startButtonClicked: true });
      const otelResourcesHide = getOtelResourcesVar(trail).state.hide;
      const varFiltersHide = getFilterVar(trail).state.hide;
      expect(otelResourcesHide).toBe(VariableHide.hideVariable);
      expect(varFiltersHide).toBe(VariableHide.hideLabel);
    });

    it('should start with hidden otel join query variable', () => {
      const joinQueryVarHide = getOtelJoinQueryVar(trail).state.hide;
      expect(joinQueryVarHide).toBe(VariableHide.hideVariable);
    });

    it('should have a group left variable for resource attributes', () => {
      expect(getOtelGroupLeftVar(trail).state.value).toBe('attribute1,attribute2');
    });

    describe('resetting the OTel experience', () => {
      it('should display with hideLabel var filters and hide VAR_OTEL_AND_METRIC_FILTERS when resetting otel experience', () => {
        trail.resetOtelExperience();
        expect(getFilterVar(trail).state.hide).toBe(VariableHide.hideLabel);
        expect(getOtelAndMetricsVar(trail).state.hide).toBe(VariableHide.hideVariable);
      });
    });

    describe('when otel is on the subscription to Otel and metrics var should update other variables', () => {
      beforeEach(() => {
        trail.setState({ initialOtelCheckComplete: true, useOtelExperience: true });
      });

      it('should automatically update the otel resources var when a non promoted resource has been selected from VAR_OTEL_AND_METRICS', () => {
        getOtelAndMetricsVar(trail).setState({
          filters: [{ key: 'deployment_environment', operator: '=', value: 'production' }],
        });

        const otelResourcesVar = getOtelResourcesVar(trail);
        const otelResourcesFilter = otelResourcesVar.state.filters[0];
        expect(otelResourcesFilter.key).toBe('deployment_environment');
        expect(otelResourcesFilter.value).toBe('production');
      });

      it('should automatically update the var filters when a promoted resource has been selected from VAR_OTEL_AND_METRICS', () => {
        getOtelAndMetricsVar(trail).setState({ filters: [{ key: 'promoted', operator: '=', value: 'resource' }] });
        const varFilters = getFilterVar(trail).state.filters[0];
        expect(varFilters.key).toBe('promoted');
        expect(varFilters.value).toBe('resource');
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
  });
});

function getFilterVar(trail: DataTrail) {
  const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  if (isAdHocFiltersVariable(variable)) {
    return variable;
  }
  throw new Error('getFilterVar failed');
}
