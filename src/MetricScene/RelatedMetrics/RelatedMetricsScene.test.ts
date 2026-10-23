import { sceneGraph } from '@grafana/scenes';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { EventQuickSearchChanged } from 'MetricsReducer/list-controls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';
import {
  FilteredMetricsVariable,
  VAR_FILTERED_METRICS_VARIABLE,
} from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { EventFiltersChanged } from 'MetricsReducer/SideBar/sections/MetricsFilterSection/EventFiltersChanged';

import { buildRankingRequest } from './ranking/buildRankingRequest';
import { fetchRelatedMetricsRanking } from './ranking/fetchRelatedMetricsRanking';
import { type RelatedMetricsScene } from './RelatedMetricsScene';
import { sortRelatedMetrics } from './sortRelatedMetrics';
import { actionViews, getActionViewsDefinitions } from '../MetricActionBar';
import { MetricScene } from '../MetricScene';

jest.mock('./ranking/buildRankingRequest', () => ({ buildRankingRequest: jest.fn() }));
jest.mock('./ranking/fetchRelatedMetricsRanking', () => ({ fetchRelatedMetricsRanking: jest.fn() }));

const metric = 'demo_requests_total';
const metrics = [metric, 'demo_errors_total', 'demo_latency_seconds', 'other_metric'];

function names(scene: RelatedMetricsScene) {
  return sceneGraph
    .findByKeyAndType(scene, VAR_FILTERED_METRICS_VARIABLE, FilteredMetricsVariable)
    .state.options.map(({ value }) => value);
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Jev related metrics comparison', () => {
  const cleanups: Array<() => void> = [];
  function activate(scene: RelatedMetricsScene) {
    const deactivateScene = scene.activate();
    const deactivateVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, scene)!.activate();
    const deactivateRanking = scene.state.ranking?.activate();
    const cleanup = () => {
      deactivateRanking?.();
      deactivateVariable();
      deactivateScene();
    };
    cleanups.push(cleanup);
    return () => {
      cleanups.splice(cleanups.indexOf(cleanup), 1);
      cleanup();
    };
  }

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  beforeEach(() => {
    localStorage.clear();
    jest.mocked(buildRankingRequest).mockResolvedValue({
      request: {
        schemaVersion: 1,
        selected: { name: metric },
        candidates: metrics.slice(1).map((name, index) => ({ id: `c${index}`, name, baselineRank: index + 1 })),
      },
      candidatesById: new Map(),
    });
    jest.mocked(fetchRelatedMetricsRanking).mockResolvedValue({
      ok: true,
      latencyMs: 12,
      response: {
        status: 'ok',
        recommended: [
          { id: 'c1', p: 0.8 },
          { id: 'c0', p: 0.2 },
        ],
        relationships: {},
      },
    });
  });

  it('shows the opt-in Jev tab immediately after Related metrics', () => {
    expect(getActionViewsDefinitions().map(({ value }) => value)).not.toContain(actionViews.jevRelated);
    localStorage.setItem('gmd.jev.enabled', '1');
    const tabs = getActionViewsDefinitions();
    const index = tabs.findIndex(({ value }) => value === actionViews.related);
    expect(tabs[index + 1]).toMatchObject({ value: actionViews.jevRelated, displayName: 'Jev Related ✨' });
  });

  it('keeps baseline sorting separate and reuses the Jev ranking across tab switches and filters', async () => {
    localStorage.setItem('gmd.jev.enabled', '1');
    const metricScene = new MetricScene({ metric });
    const trail = new DataTrail({ topScene: metricScene });
    const source = sceneGraph.findByKeyAndType(trail, VAR_METRICS_VARIABLE, MetricsVariable);
    jest.spyOn(source, 'fetchAllMetrics').mockImplementation(() => {});
    source.setState({ loading: false, options: metrics.map((name) => ({ label: name, value: name })) });

    metricScene.setActionView(actionViews.related);
    const baselineScene = metricScene.state.body.state.selectedTab as RelatedMetricsScene;
    let deactivate = activate(baselineScene);
    expect(baselineScene.state.ranking).toBeUndefined();
    expect(names(baselineScene)).toEqual(sortRelatedMetrics([...metrics], metric));
    expect(fetchRelatedMetricsRanking).not.toHaveBeenCalled();
    deactivate();

    metricScene.setActionView(actionViews.jevRelated);
    const jevScene = metricScene.state.body.state.selectedTab as RelatedMetricsScene;
    deactivate = activate(jevScene);
    await flush();
    const ranked = ['demo_latency_seconds', 'demo_errors_total', metric, 'other_metric'];
    expect(names(jevScene)).toEqual(ranked);
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);

    const search = sceneGraph.findByKeyAndType(jevScene, 'quick-search', QuickSearch);
    search.setState({ value: 'demo_' });
    search.publishEvent(new EventQuickSearchChanged({ searchText: 'demo_' }), true);
    expect(names(jevScene)).toEqual(ranked.slice(0, 3));
    search.publishEvent(new EventFiltersChanged({ type: 'prefixes', filters: ['other'] }), true);
    expect(names(jevScene)).toEqual([]);
    search.publishEvent(new EventFiltersChanged({ type: 'prefixes', filters: [] }), true);
    expect(names(jevScene)).toEqual(ranked.slice(0, 3));
    deactivate();

    metricScene.setActionView(actionViews.related);
    expect(metricScene.state.body.state.selectedTab).toBe(baselineScene);
    deactivate = activate(baselineScene);
    expect(names(baselineScene)).toEqual(sortRelatedMetrics([...metrics], metric));
    deactivate();

    metricScene.updateFromUrl({ actionView: actionViews.jevRelated });
    expect(metricScene.state.body.state.selectedTab).toBe(jevScene);
    expect(metricScene.getUrlState().actionView).toBe('jev-related');
    deactivate = activate(jevScene);
    await flush();
    expect(names(jevScene)).toEqual(ranked.slice(0, 3));
    expect(search.state.value).toBe('demo_');
    expect(fetchRelatedMetricsRanking).toHaveBeenCalledTimes(1);
    deactivate();
  });
});
