import { of } from 'rxjs';

import {
  extractRecordingRulesFromPrometheusRuleGroups,
  fetchPrometheusRuleGroups,
  findRecordingRuleByName,
  type PrometheusRule,
  type PrometheusRuleGroup,
} from './utils.recording-rules';
import { dataSourceStub } from '../stubs/dataSourceStub';
import { ruleGroupsStub } from '../stubs/ruleGroupsStub';
import { logger } from '../tracking/logger/logger';

// Mock the runtime modules
const fetchSpy = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchSpy,
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    request: jest.fn(),
    datasourceRequest: jest.fn(),
  }),
}));

jest.mock('../tracking/logger/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

function getExpectedRule(name: string, query: string, type: PrometheusRule['type'] = 'recording') {
  return {
    name,
    query,
    type,
    datasource: {
      name: dataSourceStub.name,
      uid: dataSourceStub.uid,
    },
  };
}

describe('Prometheus Rules Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchPrometheusRuleGroups', () => {
    it('should fetch rule groups successfully', async () => {
      const mockResponse = {
        ok: true,
        data: {
          data: {
            groups: ruleGroupsStub,
          },
        },
      };

      fetchSpy.mockReturnValue(of(mockResponse));

      const result = await fetchPrometheusRuleGroups(dataSourceStub);

      expect(result).toEqual(ruleGroupsStub);
      expect(fetchSpy).toHaveBeenCalledWith({
        url: `api/prometheus/${dataSourceStub.uid}/api/v1/rules`,
        showErrorAlert: false,
        showSuccessAlert: false,
      });
    });

    it('should handle failed response', async () => {
      const mockResponse = {
        ok: false,
        data: { data: { groups: [] } },
      };

      fetchSpy.mockReturnValue(of(mockResponse));

      const result = await fetchPrometheusRuleGroups(dataSourceStub);

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch recording rules'));
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      fetchSpy.mockImplementation(() => {
        throw error;
      });

      const result = await fetchPrometheusRuleGroups(dataSourceStub);

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        'Error fetching recording rules from Prometheus data source Prometheus:',
        error
      );
    });
  });

  describe('extractRecordingRulesFromPrometheusRuleGroups', () => {
    it('should extract recording rules correctly', () => {
      const result = extractRecordingRulesFromPrometheusRuleGroups(ruleGroupsStub, dataSourceStub);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        getExpectedRule('instance_path:requests:rate5m', 'sum(rate(http_requests_total[5m])) by (instance, path)')
      );
      expect(result[1]).toEqual(
        getExpectedRule(
          'job:request_failures_per_requests:ratio_rate5m',
          'sum(rate(http_requests_total{status=~"5.."}[5m])) by (job) / sum(rate(http_requests_total[5m])) by (job)'
        )
      );
    });

    it('should return empty array for empty rule groups', () => {
      const result = extractRecordingRulesFromPrometheusRuleGroups([], dataSourceStub);
      expect(result).toEqual([]);
    });

    it('should filter out non-recording rules', () => {
      const ruleGroupsWithOnlyAlerting: PrometheusRuleGroup[] = [
        {
          name: 'group1',
          rules: [
            {
              name: 'ALERTS',
              query: 'up == 0',
              type: 'alerting',
            },
          ],
        },
      ];

      const result = extractRecordingRulesFromPrometheusRuleGroups(ruleGroupsWithOnlyAlerting, dataSourceStub);
      expect(result).toEqual([]);
    });
  });

  describe('findRecordingRuleByName', () => {
    it('should find recording rule by name', async () => {
      const mockResponse = {
        ok: true,
        data: {
          data: {
            groups: ruleGroupsStub,
          },
        },
      };

      fetchSpy.mockReturnValue(of(mockResponse));

      const result = await findRecordingRuleByName('instance_path:requests:rate5m', dataSourceStub);

      expect(result).toEqual(
        getExpectedRule('instance_path:requests:rate5m', 'sum(rate(http_requests_total[5m])) by (instance, path)')
      );
    });

    it('should return null for non-existent rule', async () => {
      const mockResponse = {
        ok: true,
        data: {
          data: {
            groups: ruleGroupsStub,
          },
        },
      };

      fetchSpy.mockReturnValue(of(mockResponse));

      const result = await findRecordingRuleByName('non_existent_rule', dataSourceStub);

      expect(result).toBeNull();
    });
  });
});
