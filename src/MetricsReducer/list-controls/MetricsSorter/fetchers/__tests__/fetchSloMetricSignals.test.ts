import { getBackendSrv } from '@grafana/runtime';

import { isSloTrackingEnabled } from 'shared/featureFlags/openFeature';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getPluginVersion } from 'shared/utils/getPluginVersion';

import { fetchSloMetricSignals, SLO_RESOURCE_URL } from '../fetchSloMetricSignals';

jest.mock('@grafana/runtime');
jest.mock('shared/featureFlags/openFeature');
jest.mock('shared/logger/logger');
jest.mock('shared/tracking/interactions');
jest.mock('shared/utils/getPluginVersion');

const mockIsSloTrackingEnabled = isSloTrackingEnabled as jest.MockedFunction<typeof isSloTrackingEnabled>;
const mockGetPluginVersion = getPluginVersion as jest.MockedFunction<typeof getPluginVersion>;
const mockReportExploreMetrics = reportExploreMetrics as jest.MockedFunction<typeof reportExploreMetrics>;

function setup(slos: unknown[] = []) {
  const get = jest.fn().mockResolvedValue({ slos });
  (getBackendSrv as jest.Mock).mockReturnValue({ get });
  const fetchFiringSignals = jest.fn().mockResolvedValue({
    metricCounts: new Map(),
    firingSloUuids: new Map(),
    ruleCount: 0,
  });
  return { get, fetchFiringSignals };
}

function definition(uuid: string, query: Record<string, unknown>, datasourceUid = 'prom-a') {
  return {
    uuid,
    query,
    destinationDatasource: { uid: datasourceUid, type: 'prometheus' },
  };
}

describe('fetchSloMetricSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSloTrackingEnabled.mockResolvedValue(true);
    mockGetPluginVersion.mockResolvedValue('1.2.3');
  });

  it('does no plugin, resource, or ruler work when rollout is disabled', async () => {
    mockIsSloTrackingEnabled.mockResolvedValue(false);
    const { get, fetchFiringSignals } = setup();

    await expect(fetchSloMetricSignals('prom-a', fetchFiringSignals)).resolves.toMatchObject({ status: 'disabled' });

    expect(mockGetPluginVersion).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(fetchFiringSignals).not.toHaveBeenCalled();
  });

  it('does no resource or ruler work when the SLO plugin is absent', async () => {
    mockGetPluginVersion.mockResolvedValue(null);
    const { get, fetchFiringSignals } = setup();

    await expect(fetchSloMetricSignals('prom-a', fetchFiringSignals)).resolves.toMatchObject({
      status: 'plugin-absent',
    });

    expect(mockGetPluginVersion).toHaveBeenCalledWith('grafana-slo-app');
    expect(get).not.toHaveBeenCalled();
    expect(fetchFiringSignals).not.toHaveBeenCalled();
  });

  it('extracts every native Prometheus query variant for the selected datasource', async () => {
    const slos = [
      definition('ratio', {
        type: 'ratio',
        ratio: {
          successMetric: { prometheusMetric: 'http_requests_total{code=~"2.."}' },
          totalMetric: { prometheusMetric: 'http_requests_total' },
        },
      }),
      definition('failure-ratio', {
        type: 'failureRatio',
        failureRatio: {
          failureMetric: { prometheusMetric: 'http_errors_total' },
          totalMetric: { prometheusMetric: 'http_requests_total' },
        },
      }),
      definition('threshold', {
        type: 'threshold',
        threshold: { thresholdExpression: 'histogram_quantile(0.9, rate(request_duration_bucket[5m]))' },
      }),
      definition('failure-threshold', {
        type: 'failureThreshold',
        failureThreshold: { failureThresholdExpression: 'queue_depth > 100' },
      }),
      definition('freeform', {
        type: 'freeform',
        freeform: { query: 'sum(rate(success_total[5m])) / sum(rate(attempt_total[5m]))' },
      }),
    ];
    const { fetchFiringSignals } = setup(slos);

    const result = await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect(result.status).toBe('ready');
    expect([...result.trackedMetrics.keys()]).toEqual(
      expect.arrayContaining([
        'http_requests_total',
        'http_errors_total',
        'request_duration_bucket',
        'queue_depth',
        'success_total',
        'attempt_total',
      ])
    );
    expect(result.trackedMetrics.get('http_requests_total')).toEqual(new Set(['ratio', 'failure-ratio']));
  });

  it('uses resolved, query, then destination datasource identity and excludes other datasources', async () => {
    const slos = [
      {
        ...definition('resolved', {
          type: 'freeform',
          freeform: { query: 'resolved_metric', sourceDatasourceUid: 'prom-other' },
        }),
        readOnly: { sourceDatasource: { uid: 'prom-a', type: 'prometheus' } },
      },
      definition(
        'query-source',
        {
          type: 'freeform',
          freeform: { query: 'query_metric', sourceDatasourceUid: 'prom-a' },
        },
        'prom-other'
      ),
      definition('destination-fallback', {
        type: 'freeform',
        freeform: { query: 'destination_metric' },
      }),
      definition(
        'excluded',
        {
          type: 'freeform',
          freeform: { query: 'same_name_metric' },
        },
        'prom-other'
      ),
      {
        ...definition('non-prometheus', {
          type: 'freeform',
          freeform: { query: 'loki_stream' },
        }),
        readOnly: { sourceDatasource: { uid: 'prom-a', type: 'loki' } },
      },
    ];
    const { fetchFiringSignals } = setup(slos);

    const result = await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect([...result.trackedMetrics.keys()]).toEqual(['resolved_metric', 'query_metric', 'destination_metric']);
    expect(result.trackedMetrics.has('same_name_metric')).toBe(false);
  });

  it('accepts only raw Prometheus Grafana queries for the selected datasource', async () => {
    const slos = [
      definition('big-tent', {
        type: 'grafanaQueries',
        grafanaQueries: {
          grafanaQueries: [
            { refId: 'A', expr: 'rate(selected_total[5m])', datasource: { uid: 'prom-a', type: 'prometheus' } },
            {
              refId: 'A2',
              expr: 'rate(aws_selected_total[5m])',
              datasource: { uid: 'prom-a', type: 'grafana-amazonprometheus-datasource' },
            },
            { refId: 'B', expr: 'rate(other_total[5m])', datasource: { uid: 'prom-b', type: 'prometheus' } },
            { refId: 'C', expr: 'count_over_time({app="api"}[5m])', datasource: { uid: 'loki', type: 'loki' } },
            { refId: 'D', expression: '$A / 2', type: 'math', datasource: { uid: 'prom-a', type: 'prometheus' } },
          ],
        },
      }),
    ];
    const { fetchFiringSignals } = setup(slos);

    const result = await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect([...result.trackedMetrics.keys()]).toEqual(['selected_total', 'aws_selected_total']);
  });

  it('marks every source metric owned by a firing SLO as actively burning', async () => {
    const { fetchFiringSignals } = setup([
      definition('slo-1', {
        type: 'ratio',
        ratio: {
          successMetric: { prometheusMetric: 'success_total' },
          totalMetric: { prometheusMetric: 'requests_total' },
        },
      }),
      definition('slo-2', { type: 'freeform', freeform: { query: 'healthy_metric' } }),
    ]);
    fetchFiringSignals.mockResolvedValue({
      metricCounts: new Map(),
      firingSloUuids: new Map([
        ['slo-1', new Set(['critical'])],
        ['unknown-slo', new Set(['warning'])],
      ]),
      ruleCount: 2,
    });

    const result = await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect(result.activeBurnMetrics).toEqual(new Set(['success_total', 'requests_total']));
    expect(result.trackedMetrics.has('healthy_metric')).toBe(true);
  });

  it('skips malformed siblings and returns ready-empty for a valid empty response', async () => {
    const { fetchFiringSignals } = setup([null, {}, { uuid: 1 }, definition('bad', { type: 'ratio', ratio: {} })]);

    const malformedResult = await fetchSloMetricSignals('prom-a', fetchFiringSignals);
    expect(malformedResult.status).toBe('ready');
    expect(malformedResult.trackedMetrics.size).toBe(0);

    const empty = setup([]);
    const emptyResult = await fetchSloMetricSignals('prom-a', empty.fetchFiringSignals);
    expect(emptyResult.status).toBe('ready');
    expect(emptyResult.trackedMetrics.size).toBe(0);
  });

  it('returns an explicit retryable error state and non-sensitive telemetry when the resource request fails', async () => {
    const { get, fetchFiringSignals } = setup();
    get.mockRejectedValue(new Error('forbidden'));

    const result = await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect(result).toMatchObject({ status: 'error', datasourceUid: 'prom-a' });
    expect(result.trackedMetrics.size).toBe(0);
    expect(logger.error).toHaveBeenCalled();
    expect(mockReportExploreMetrics).toHaveBeenLastCalledWith('slo_metric_signals_fetched', {
      status: 'error',
      duration_ms: expect.any(Number),
      definition_count: 0,
      metric_count: 0,
      active_burn_metric_count: 0,
    });
    expect(JSON.stringify(mockReportExploreMetrics.mock.calls)).not.toContain('forbidden');
  });

  it('uses the SLO resource route and silent request options', async () => {
    const { get, fetchFiringSignals } = setup([]);

    await fetchSloMetricSignals('prom-a', fetchFiringSignals);

    expect(get).toHaveBeenCalledWith(
      SLO_RESOURCE_URL,
      undefined,
      'grafana-metricsdrilldown-app-slo-metric-signals',
      expect.objectContaining({ showErrorAlert: false, showSuccessAlert: false })
    );
  });
});
