import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { MetricSelectedEvent, VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { buildRankingRequest } from './buildRankingRequest';
import { fetchRelatedMetricsRanking } from './fetchRelatedMetricsRanking';
import { lookupMetricLabelNames } from './labelNames';
import { isJevDebugEnabled, isJevEnabled } from './toggles';
import { type RankingCandidateInfo, type RelatedMetricsRankingResponse } from './types';

interface RelatedMetricsRankingState extends SceneObjectState {
  metric: string;
  status: 'hidden' | 'loading' | 'ready';
  response?: RelatedMetricsRankingResponse;
  candidates: RankingCandidateInfo[];
  requestLatencyMs?: number;
  labelLatencyMs?: number;
}

export class RelatedMetricsRanking extends SceneObjectBase<RelatedMetricsRankingState> {
  private abortController?: AbortController;
  private started = false;

  constructor(metric: string) {
    super({ key: 'related-metrics-ranking', metric, status: isJevEnabled() ? 'loading' : 'hidden', candidates: [] });
    this.addActivationHandler(() => () => this.abortController?.abort());
  }

  public start(metricNames: string[]) {
    if (this.started || !isJevEnabled()) {
      return;
    }
    this.started = true;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const trail = getTrailFor(this);
    const datasourceUid = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString();
    const helper = (trail as unknown as { datasourceHelper: MetricDatasourceHelper }).datasourceHelper;
    const labelStart = performance.now();
    this.setState({ status: 'loading', labelLatencyMs: undefined, requestLatencyMs: undefined });
    void buildRankingRequest({
      selectedMetric: this.state.metric,
      metricNames,
      peekMetadata: (name) => helper.peekMetadata(name),
      lookupLabelNames: (name) => lookupMetricLabelNames(trail, datasourceUid, name),
      datasourceUid,
    }).then(async ({ request, candidatesById }) => {
      if (this.abortController?.signal.aborted) {
        return;
      }
      this.setState({ labelLatencyMs: performance.now() - labelStart });
      const result = await fetchRelatedMetricsRanking(request, candidatesById.keys(), this.abortController?.signal);
      if (!result.ok || this.abortController?.signal.aborted) {
        this.setState({ status: 'ready', candidates: [] });
        return;
      }
      const candidates = request.candidates.map((candidate) => ({
        ...candidate,
        score: result.response.scores?.[candidate.id],
        relationship: result.response.relationships[candidate.id],
      }));
      this.setState({ status: 'ready', response: result.response, candidates, requestLatencyMs: result.latencyMs });
    }).catch(() => {
      if (!this.abortController?.signal.aborted) {
        this.setState({ status: 'ready', candidates: [] });
      }
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedMetricsRanking>) => {
    const state = model.useState();
    const styles = useStyles2(getStyles);
    if (state.status === 'hidden' || (state.status === 'ready' && !state.response)) {
      return null;
    }
    if (state.status === 'loading') {
      return <div className={styles.loading}>{t('related-metrics-ranking.loading', 'Finding recommended metrics…')} <Spinner inline /></div>;
    }
    const byId = new Map(state.candidates.map((candidate) => [candidate.id, candidate]));
    const recommended = state.response?.recommended.flatMap((item) => {
      const candidate = byId.get(item.id);
      return candidate ? [{ candidate, p: item.p }] : [];
    }) ?? [];
    return (
      <div className={styles.root} data-testid="related-metrics-ranking">
        <div className={styles.heading}>{t('related-metrics-ranking.title', 'Recommended')}</div>
        <div className={styles.items}>
          {recommended.slice(0, 3).map(({ candidate, p }) => (
            <Button
              key={candidate.id}
              variant="secondary"
              fill="outline"
              size="sm"
              onClick={() => model.publishEvent(new MetricSelectedEvent({ metric: candidate.name }), true)}
            >
              {candidate.name}
              {candidate.relationship?.class && <span className={styles.hint}>{candidate.relationship.class.replaceAll('_', ' ')}</span>}
              {typeof p === 'number' && <span className={styles.score}>{Math.round(p * 100)}%</span>}
            </Button>
          ))}
        </div>
        {isJevDebugEnabled() && <DebugOverlay state={state} />}
      </div>
    );
  };
}

function DebugOverlay({ state }: Readonly<{ state: RelatedMetricsRankingState }>) {
  const response = state.response;
  return (
    <details className={css({ marginTop: 8 })}>
      <summary>{t('related-metrics-ranking.debug', 'Jev ranking details')}</summary>
      {/* Debug values are intentionally compact; each label is translated with t(). */}
      {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
      <small>
        {t('related-metrics-ranking.debug-status', 'Status')}: {response?.status};{' '}
        {t('related-metrics-ranking.debug-latency', 'Latency')}: {Math.round((state.labelLatencyMs ?? 0) + (state.requestLatencyMs ?? 0))}ms;{' '}
        {t('related-metrics-ranking.debug-server', 'Server')}: {response?.latencyMs ?? '—'}ms;{' '}
        {t('related-metrics-ranking.debug-model', 'Model')}: {response?.model ?? '—'};{' '}
        {t('related-metrics-ranking.debug-cached', 'Cached')}: {String(response?.cached ?? false)};{' '}
        {t('related-metrics-ranking.debug-prompt', 'Prompt')}: {response?.promptVersion ?? '—'};{' '}
        {t('related-metrics-ranking.debug-fallback', 'Fallback')}: {response?.fallbackReason ?? '—'}
      </small>
      <table><thead><tr><th>{t('related-metrics-ranking.debug-id', 'ID')}</th><th>{t('related-metrics-ranking.debug-metric', 'Metric')}</th><th>{t('related-metrics-ranking.debug-rank', 'Rank')}</th><th>{t('related-metrics-ranking.debug-score', 'Jev p')}</th><th>{t('related-metrics-ranking.debug-relationship', 'Relationship')}</th></tr></thead><tbody>
        {state.candidates.map((candidate) => <tr key={candidate.id}><td>{candidate.id}</td><td>{candidate.name}</td><td>{candidate.baselineRank}</td><td>{candidate.score ?? '—'}</td><td>{candidate.relationship?.class ?? '—'}{candidate.relationship?.confidence !== undefined ? ` (${candidate.relationship.confidence})` : ''}</td></tr>)}
      </tbody></table>
    </details>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({ padding: theme.spacing(0, 0, 1), display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5) }),
    loading: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize, padding: theme.spacing(0.5, 0) }),
    heading: css({ fontWeight: theme.typography.fontWeightMedium, fontSize: theme.typography.bodySmall.fontSize }),
    items: css({ display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) }),
    hint: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize, marginLeft: theme.spacing(1) }),
    score: css({ color: theme.colors.text.secondary, marginLeft: theme.spacing(1) }),
  };
}
