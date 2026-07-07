import { getBackendSrv } from '@grafana/runtime';

import { logger } from 'shared/logger/logger';

import { fetchFiringAlertMetrics } from '../fetchFiringAlertMetrics';
import { GRAFANA_RULER_RULES_URL } from '../shared';

jest.mock('@grafana/runtime');
jest.mock('shared/logger/logger');
jest.mock('../../../../../shared/utils/utils.promql', () => ({
  extractMetricNames: jest.fn(),
}));

const { extractMetricNames: realExtractMetricNames } = jest.requireActual(
  '../../../../../shared/utils/utils.promql'
) as { extractMetricNames: (...args: unknown[]) => string[] };

const { extractMetricNames: mockExtractMetricNames } = jest.requireMock<{ extractMetricNames: jest.Mock }>(
  '../../../../../shared/utils/utils.promql'
);

function setup() {
  const get = jest.fn() as jest.Mock;
  (getBackendSrv as jest.Mock).mockImplementation(() => ({ get }));
  return { get };
}

function buildRulerResponse(groups: Array<{ name: string; rules: Array<Record<string, unknown>> }>) {
  return {
    status: 'success',
    data: {
      groups: groups.map((g) => ({
        name: g.name,
        file: 'test.yaml',
        rules: g.rules,
        interval: 60,
      })),
    },
  };
}

function alertingRule(name: string, query: string) {
  return { type: 'alerting', name, query, state: 'firing', health: 'ok', alerts: [], labels: {}, annotations: {} };
}

function recordingRule(name: string, query: string) {
  return { type: 'recording', name, query, health: 'ok' };
}

describe('fetchFiringAlertMetrics()', () => {
  beforeEach(() => {
    mockExtractMetricNames.mockImplementation(realExtractMetricNames);
  });

  test('calls the correct endpoint with state=firing and limit_alerts=0', async () => {
    const { get } = setup();
    get.mockResolvedValueOnce(buildRulerResponse([]));

    await fetchFiringAlertMetrics();

    expect(get).toHaveBeenCalledWith(
      GRAFANA_RULER_RULES_URL,
      { state: 'firing', limit_alerts: 0 },
      'grafana-metricsdrilldown-app-firing-alert-metric-usage',
      expect.any(Object)
    );
  });

  describe('happy path', () => {
    test('returns metric counts from firing alerting rules across groups', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [alertingRule('HighLatency', 'rate(http_requests_total[5m]) > 100')],
          },
          {
            name: 'group-2',
            rules: [alertingRule('HighErrors', 'sum(rate(http_errors_total[5m])) > 10')],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.get('http_requests_total')).toBe(1);
      expect(result.get('http_errors_total')).toBe(1);
    });

    test('sums counts when the same metric is referenced by multiple firing rules', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [
              alertingRule('HighLatency', 'rate(http_requests_total[5m]) > 100'),
              alertingRule('LowThroughput', 'rate(http_requests_total[5m]) < 1'),
            ],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(result.get('http_requests_total')).toBe(2);
    });

    test('extracts multiple metrics from a single PromQL expression', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [alertingRule('ErrorRatio', 'rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.5')],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(result.get('http_errors_total')).toBe(1);
      expect(result.get('http_requests_total')).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('returns empty Map when API returns empty groups array', async () => {
      const { get } = setup();
      get.mockResolvedValueOnce(buildRulerResponse([]));

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('excludes recording rules from the output', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'mixed-group',
            rules: [
              alertingRule('HighLatency', 'rate(http_requests_total[5m]) > 100'),
              recordingRule('job:http_requests:rate5m', 'sum(rate(http_requests_total[5m])) by (job)'),
            ],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(result.size).toBe(1);
      expect(result.get('http_requests_total')).toBe(1);
    });

    test('skips rules with empty query strings', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [alertingRule('EmptyQuery', ''), alertingRule('ValidRule', 'up == 0')],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(result.size).toBe(1);
      expect(result.get('up')).toBe(1);
    });

    test('returns zero metrics for malformed PromQL that yields no identifiers', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [
              alertingRule('BadQuery', '{{{invalid promql'),
              alertingRule('GoodQuery', 'node_cpu_seconds_total > 0.9'),
            ],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      // The lezer PromQL parser is tolerant — malformed input returns [] rather than throwing.
      // The valid rule should still be processed.
      expect(result.size).toBe(1);
      expect(result.get('node_cpu_seconds_total')).toBe(1);
    });

    test('logs a warning and continues processing when metric extraction throws', async () => {
      const { get } = setup();
      mockExtractMetricNames
        .mockImplementationOnce(() => {
          throw new TypeError('unexpected failure');
        })
        .mockImplementationOnce(() => ['node_cpu_seconds_total']);

      get.mockResolvedValueOnce(
        buildRulerResponse([
          {
            name: 'group-1',
            rules: [
              alertingRule('FailRule', 'some_expr > 1'),
              alertingRule('GoodRule', 'node_cpu_seconds_total > 0.9'),
            ],
          },
        ])
      );

      const result = await fetchFiringAlertMetrics();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({ message: expect.stringContaining('FailRule') })
      );
      expect(result.size).toBe(1);
      expect(result.get('node_cpu_seconds_total')).toBe(1);
    });

    test('handles response with missing data.groups gracefully', async () => {
      const { get } = setup();
      get.mockResolvedValueOnce({ status: 'success', data: {} });

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('handles group with missing rules array gracefully', async () => {
      const { get } = setup();
      get.mockResolvedValueOnce({
        status: 'success',
        data: {
          groups: [{ name: 'bad-group', file: 'test.yaml' }],
        },
      });

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('error handling', () => {
    test('returns empty Map and logs error when API call fails', async () => {
      const { get } = setup();
      get.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ message: expect.any(String) })
      );
    });

    test('handles string error from API', async () => {
      const { get } = setup();
      get.mockRejectedValueOnce('Unauthorized');

      const result = await fetchFiringAlertMetrics();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ message: expect.any(String) })
      );
    });
  });
});
