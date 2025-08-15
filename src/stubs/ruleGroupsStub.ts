import { type PrometheusRuleGroup } from 'utils/utils.recording-rules';

export const ruleGroupsStub: PrometheusRuleGroup[] = [
  {
    name: 'group1',
    rules: [
      {
        name: 'instance_path:requests:rate5m',
        query: 'sum(rate(http_requests_total[5m])) by (instance, path)',
        type: 'recording',
      },
      {
        name: 'job:request_failures_per_requests:ratio_rate5m',
        query:
          'sum(rate(http_requests_total{status=~"5.."}[5m])) by (job) / sum(rate(http_requests_total[5m])) by (job)',
        type: 'recording',
      },
    ],
  },
  {
    name: 'group2',
    rules: [
      {
        name: 'ALERTS',
        query: 'up == 0',
        type: 'alerting',
      },
    ],
  },
];
