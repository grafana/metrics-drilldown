import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { buildRankingRequest } from './buildRankingRequest';
import { fetchRelatedMetricsRanking } from './fetchRelatedMetricsRanking';
import { getMetricLabelEnricher } from './labelNames';
import { isJevDebugEnabled, isJevEnabled } from './toggles';
import { type RankingCandidateInfo, type RankingFailureReason, type RelatedMetricsRankingResponse } from './types';

interface RelatedMetricsRankingState extends SceneObjectState {
  metric: string;
  status: 'hidden' | 'loading' | 'ready' | 'failed';
  response?: RelatedMetricsRankingResponse;
  failureReason?: RankingFailureReason;
  candidates: RankingCandidateInfo[];
  requestLatencyMs?: number;
  labelLatencyMs?: number;
}

export class RelatedMetricsRanking extends SceneObjectBase<RelatedMetricsRankingState> {
  private abortController?: AbortController;
  private lastSignature?: string;

  constructor(metric: string) {
    super({ key: 'related-metrics-ranking', metric, status: isJevEnabled() ? 'loading' : 'hidden', candidates: [] });
    this.addActivationHandler(() => () => {
      this.abortController?.abort();
      // Keep successful results when switching tabs; retry interruptions or failures on return.
      if (this.state.status !== 'ready') {
        this.lastSignature = undefined;
      }
    });
  }

  public start(metricNames: string[]) {
    if (!isJevEnabled() || metricNames.length === 0) {
      return;
    }
    const datasourceUid = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString();
    const trail = getTrailFor(this);
    const range = sceneGraph.getTimeRange(trail).state.value;
    const labelContext = JSON.stringify([datasourceUid, range.from.valueOf(), range.to.valueOf()]);
    const signature = JSON.stringify([labelContext, metricNames, Math.floor(Date.now() / 60_000)]);
    if (signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    const labelStart = performance.now();
    this.setState({
      status: 'loading',
      response: undefined,
      failureReason: undefined,
      candidates: [],
      labelLatencyMs: undefined,
      requestLatencyMs: undefined,
    });

    buildRankingRequest({
      selectedMetric: this.state.metric,
      metricNames,
      peekMetadata: (name) => trail.peekMetricMetadata(name),
      lookupLabelNames: (name) => trail.getMetricLabelNames(name),
      labelEnricher: getMetricLabelEnricher(trail),
      labelContext,
      signal: controller.signal,
      datasourceUid,
    })
      .then(async ({ request }) => {
        if (controller.signal.aborted) {
          return;
        }
        const labelLatencyMs = performance.now() - labelStart;
        const candidates: RankingCandidateInfo[] = request.candidates.map((candidate) => ({ ...candidate }));
        this.setState({ labelLatencyMs, candidates });

        const result = await fetchRelatedMetricsRanking(
          request,
          request.candidates.map(({ id }) => id),
          controller.signal
        );
        if (controller.signal.aborted) {
          return;
        }
        if (!result.ok) {
          this.setState({ status: 'failed', failureReason: result.reason, response: result.response });
          return;
        }
        this.setState({
          status: 'ready',
          response: result.response,
          requestLatencyMs: result.latencyMs,
          candidates: candidates.map((candidate) => ({
            ...candidate,
            score: result.response.scores?.[candidate.id],
            relationship: result.response.relationships[candidate.id],
          })),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          this.setState({ status: 'failed', failureReason: 'unexpected' });
        }
      });
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedMetricsRanking>) => {
    const state = model.useState();
    const styles = useStyles2(getStyles);
    const debug = isJevDebugEnabled();

    if (state.status === 'hidden') {
      return null;
    }
    if (state.status === 'loading') {
      return (
        <div className={styles.loading}>
          {t('related-metrics-ranking.loading', 'Finding recommended metrics…')} <Spinner inline />
        </div>
      );
    }

    const hasRanking =
      state.status === 'ready' &&
      (Boolean(state.response?.recommended.length) || Boolean(Object.keys(state.response?.scores ?? {}).length));

    return (
      <div className={styles.root} data-testid="related-metrics-ranking">
        <div className={styles.status}>
          {hasRanking
            ? t(
                'related-metrics-ranking.sorted',
                'Sorted by Jev relevance. Unranked metrics follow in name-similarity order.'
              )
            : t('related-metrics-ranking.fallback', 'Jev ranking unavailable. Showing name-similarity order.')}
        </div>
        {debug && <DebugOverlay state={state} />}
      </div>
    );
  };
}

function formatNumber(value: number | undefined, digits = 2) {
  return value === undefined ? '—' : value.toFixed(digits);
}

/** e.g. `ok`, or `not-ok/disabled` when the client failed open on a server status. */
function debugStatus({ status, failureReason, response }: RelatedMetricsRankingState): string {
  if (status !== 'failed') {
    return response?.status ?? '—';
  }
  const serverStatus = response ? '/' + response.status : '';
  return (failureReason ?? 'unknown') + serverStatus;
}

function debugSummary(state: RelatedMetricsRankingState, status: string): string {
  const { response } = state;
  const dash = '—';
  const totalLatency = Math.round((state.labelLatencyMs ?? 0) + (state.requestLatencyMs ?? 0));
  return [
    `${t('related-metrics-ranking.debug-status', 'Status')}: ${status}`,
    `${t('related-metrics-ranking.debug-latency', 'Latency')}: ${totalLatency} ms`,
    `${t('related-metrics-ranking.debug-label-latency', 'Labels')}: ${Math.round(state.labelLatencyMs ?? 0)} ms`,
    `${t('related-metrics-ranking.debug-server', 'Server')}: ${response?.latencyMs ?? dash} ms`,
    `${t('related-metrics-ranking.debug-model', 'Model')}: ${response?.model || dash}`,
    `${t('related-metrics-ranking.debug-cached', 'Cached')}: ${String(response?.cached ?? false)}`,
    `${t('related-metrics-ranking.debug-prompt', 'Prompt')}: ${response?.promptVersion ?? dash}`,
    `${t('related-metrics-ranking.debug-usage', 'Usage')}: ${response?.usage?.inputTokens ?? dash} / ${response?.usage?.cost ?? dash}`,
    `${t('related-metrics-ranking.debug-fallback', 'Fallback')}: ${response?.fallbackReason ?? dash}`,
  ].join('; ');
}

function DebugOverlay({ state }: Readonly<{ state: RelatedMetricsRankingState }>) {
  const styles = useStyles2(getStyles);
  const status = debugStatus(state);

  return (
    <details className={styles.debug} data-testid="related-metrics-ranking-debug">
      <summary>{`${t('related-metrics-ranking.debug', 'Jev ranking details')} (${status})`}</summary>
      <small>{debugSummary(state, status)}</small>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('related-metrics-ranking.debug-id', 'ID')}</th>
            <th>{t('related-metrics-ranking.debug-metric', 'Metric')}</th>
            <th>{t('related-metrics-ranking.debug-rank', 'Rank')}</th>
            <th>{t('related-metrics-ranking.debug-score', 'Jev p')}</th>
            <th>{t('related-metrics-ranking.debug-relationship', 'Relationship')}</th>
          </tr>
        </thead>
        <tbody>
          {state.candidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>{candidate.id}</td>
              <td>{candidate.name}</td>
              <td>{candidate.baselineRank}</td>
              <td>{formatNumber(candidate.score)}</td>
              <td>
                {candidate.relationship?.class ?? '—'}
                {candidate.relationship?.confidence !== undefined &&
                  ` (${formatNumber(candidate.relationship.confidence)})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({ padding: theme.spacing(0, 0, 1), display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5) }),
    loading: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(0.5, 0),
    }),
    status: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
    debug: css({ marginTop: theme.spacing(1), fontSize: theme.typography.bodySmall.fontSize }),
    table: css({
      marginTop: theme.spacing(0.5),
      'th, td': { padding: theme.spacing(0.25, 1), textAlign: 'left' },
    }),
  };
}
