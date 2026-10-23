import { css } from '@emotion/css';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type AdHocFiltersVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, Spinner } from '@grafana/ui';
import React from 'react';

import { isJevDebugEnabled, isJevEnabled } from 'MetricScene/RelatedMetrics/ranking/toggles';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { fetchCatalogRanking } from './fetchCatalogRanking';
import {
  buildLocalBaseline,
  CATALOG_POLICY_VERSION,
  catalogRequest,
  mergeCatalogRanking,
  otelEvidence,
  selectCatalogCandidates,
  type CatalogRequest,
  type CatalogResponse,
  type LocalCandidate,
} from './ranking';
import { acquireCatalogSignals, boundedWait, CatalogLabelEnricher, type SignalSnapshot } from './signals';
import { EventSortByChanged } from '../MetricsSorter/events/EventSortByChanged';
import { sortMetricsWithRecentFirst, type MetricsSorter } from '../MetricsSorter/MetricsSorter';

interface CatalogRankingState extends SceneObjectState {
  status: 'hidden' | 'loading' | 'ready' | 'fallback';
  total: number;
  baseline: LocalCandidate[];
  request?: CatalogRequest;
  response?: CatalogResponse;
  snapshot?: SignalSnapshot;
  elapsedMs?: number;
  labelMs?: number;
}
function hasUsableScores(response: CatalogResponse): boolean {
  return (response.status === 'ok' || response.status === 'partial') && Object.keys(response.scores).length > 0;
}

function statusMessage(state: CatalogRankingState): string {
  if (state.status === 'loading') {
    return t('jev-sort.loading', 'Finding relevant metrics…');
  }
  if (state.status === 'ready') {
    return t(
      'jev-sort.sorted',
      'Incident/SLO priority applied. Jev ranked {{count}} of {{total}} matching metrics; others use signal-based order.',
      { count: Object.keys(state.response?.scores ?? {}).length, total: state.total }
    );
  }
  return t('jev-sort.fallback', 'Jev unavailable — using signal-based priority.');
}

export class CatalogRanking extends SceneObjectBase<CatalogRankingState> {
  private controller?: AbortController;
  private current?: { signature: string; promise: Promise<string[]> };
  private labels = new CatalogLabelEnricher();
  private cache = new Map<string, { response: CatalogResponse; expires: number }>();

  constructor() {
    super({ key: 'catalog-ranking', status: 'hidden', total: 0, baseline: [] });
    this.addActivationHandler(() => () => this.cancel());
  }
  public cancel() {
    this.controller?.abort();
    this.current = undefined;
    this.setState({ status: 'hidden' });
  }
  public retry = () => {
    this.cancel();
    this.publishEvent(new EventSortByChanged({ sortBy: 'jev-relevance' }), true);
  };

  public rank(
    names: string[],
    sorter: MetricsSorter,
    filterContext: unknown,
    applyBaseline: (names: string[]) => void
  ): Promise<string[]> {
    const ordinary = sortMetricsWithRecentFirst(names);
    if (!isJevEnabled() || !ordinary.length) {
      this.cancel();
      return Promise.resolve(ordinary);
    }
    const trail = getTrailFor(this);
    const datasourceUid = String(sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue() ?? '');
    const range = sceneGraph.getTimeRange(trail).state.value;
    const filters = (sceneGraph.lookupVariable(VAR_FILTERS, this) as AdHocFiltersVariable | undefined)?.state.filters;
    const context = JSON.stringify([
      datasourceUid,
      range.from.valueOf(),
      range.to.valueOf(),
      filters,
      filterContext,
      CATALOG_POLICY_VERSION,
    ]);
    // Include metadata and the freshness window: identical names alone do not define identical evidence.
    const signature = JSON.stringify([
      context,
      ordinary.map((name) => [name, trail.peekMetricMetadata(name)]),
      Math.floor(Date.now() / 60_000),
    ]);
    if (signature === this.current?.signature) {
      return this.current.promise;
    }
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.setState({
      status: 'loading',
      total: ordinary.length,
      baseline: [],
      response: undefined,
      request: undefined,
      snapshot: undefined,
      elapsedMs: undefined,
      labelMs: undefined,
    });
    const promise = this.run(ordinary, sorter, datasourceUid, context, controller, applyBaseline).finally(() => {
      if (this.controller === controller) {
        this.current = undefined;
      }
    });
    this.current = { signature, promise };
    return promise;
  }

  private async run(
    ordinary: string[],
    sorter: MetricsSorter,
    datasourceUid: string,
    context: string,
    controller: AbortController,
    applyBaseline: (names: string[]) => void
  ): Promise<string[]> {
    const started = performance.now();
    const trail = getTrailFor(this);
    let fallback = ordinary;
    try {
      // Coalesce rapid input changes before optional integration/network work.
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, 200);
        controller.signal.addEventListener('abort', finish, { once: true });
      });
      if (controller.signal.aborted) {
        return ordinary;
      }
      const snapshot = await boundedWait(acquireCatalogSignals(sorter, datasourceUid), controller.signal, 1500);
      if (controller.signal.aborted) {
        return ordinary;
      }
      const baseline = buildLocalBaseline(ordinary, snapshot.signals, (name) => trail.peekMetricMetadata(name));
      fallback = baseline.map((candidate) => candidate.name);
      this.setState({ snapshot, baseline });
      applyBaseline(fallback);
      const selected = selectCatalogCandidates(baseline);
      if (!selected.length) {
        this.setState({ status: 'fallback' });
        return fallback;
      }
      const labelStarted = performance.now();
      const labels = await this.labels.enrich(
        selected.map(({ name }) => name),
        context,
        (name) => trail.getMetricLabelNames(name),
        controller.signal
      );
      if (controller.signal.aborted) {
        return fallback;
      }
      for (const candidate of selected) {
        candidate.labelNames = labels.get(candidate.name);
        candidate.otelEvidence = otelEvidence(candidate.name, candidate.labelNames);
      }
      const request = catalogRequest(selected, datasourceUid);
      this.setState({ request, labelMs: performance.now() - labelStarted });
      // Local filter values never enter this request or the backend cache key.
      const response = await this.loadResponse(request, controller.signal);
      if (controller.signal.aborted) {
        return fallback;
      }
      const usable = hasUsableScores(response);
      this.setState({ response, status: usable ? 'ready' : 'fallback', elapsedMs: performance.now() - started });
      return usable ? mergeCatalogRanking(baseline, request, response.scores) : fallback;
    } catch {
      if (!controller.signal.aborted) {
        this.setState({ status: 'fallback', elapsedMs: performance.now() - started });
      }
      return fallback;
    }
  }

  private async loadResponse(request: CatalogRequest, signal: AbortSignal): Promise<CatalogResponse> {
    const key = JSON.stringify(request);
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return { ...cached.response, cached: true, usage: undefined };
    }
    const response = await fetchCatalogRanking(request, signal);
    if (!signal.aborted && hasUsableScores(response)) {
      this.cache.set(key, { response, expires: Date.now() + 60_000 });
      if (this.cache.size > 5) {
        this.cache.delete(this.cache.keys().next().value!);
      }
    }
    return response;
  }

  public static readonly Component = ({ model }: SceneComponentProps<CatalogRanking>) => {
    const state = model.useState();
    if (state.status === 'hidden') {
      return null;
    }
    return (
      <div className={css({ maxWidth: '100%', overflowWrap: 'anywhere' })} data-testid="catalog-ranking">
        <div role="status" aria-live="polite">
          {statusMessage(state)} {state.status === 'loading' && <Spinner inline />}
        </div>
        <div>
          {t(
            'jev-sort.alert-scope',
            'Direct alert counts lack datasource attribution; incident priority currently uses SLO burn evidence.'
          )}
        </div>
        {state.status === 'fallback' && (
          <Button size="sm" variant="secondary" onClick={model.retry}>
            {t('jev-sort.retry', 'Retry Jev ranking')}
          </Button>
        )}
        {isJevDebugEnabled() && (
          <details>
            <summary>{t('jev-sort.debug', 'Jev ranking details')}</summary>
            <pre>
              {JSON.stringify(
                {
                  status: state.response?.status ?? state.status,
                  model: state.response?.model,
                  promptVersion: state.response?.promptVersion,
                  cached: state.response?.cached,
                  usage: state.response?.usage,
                  elapsedMs: state.elapsedMs,
                  labelMs: state.labelMs,
                  signalStatus: state.snapshot?.status,
                  burnStatus: state.snapshot?.burnStatus,
                  signalAgeMs: state.snapshot?.fetchedAt ? Date.now() - state.snapshot.fetchedAt : undefined,
                  directAlerts: state.snapshot?.directAlerts,
                },
                null,
                2
              )}
            </pre>
            <table>
              <thead>
                <tr>
                  <th>{t('jev-sort.metric', 'Metric')}</th>
                  <th>{t('jev-sort.band', 'Band')}</th>
                  <th>{t('jev-sort.reasons', 'Local reasons')}</th>
                  <th>{t('jev-sort.score', 'Jev rubric')}</th>
                </tr>
              </thead>
              <tbody>
                {state.request?.candidates.map((candidate) => {
                  const local = state.baseline.find(({ name }) => name === candidate.name);
                  return (
                    <tr key={candidate.id}>
                      <td>{candidate.name}</td>
                      <td>{local?.band}</td>
                      <td>{local?.reasons.join(', ')}</td>
                      <td>{JSON.stringify(state.response?.scores[candidate.id] ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        )}
      </div>
    );
  };
}
