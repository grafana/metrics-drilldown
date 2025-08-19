import { ruleGroupLabels } from './metricLabels';

type MetricType = 'metrics' | 'rules';

/**
 * Checks if a metric name follows Prometheus recording rule naming conventions.
 *
 * @remarks Recording rules follow the pattern: `level:metric:operations` or `level:metric`.
 * The `level` component might be empty. Where `level` and `operations` can contain
 * underscores and alphanumeric characters. The `metric` part can contain any character, but can't be empty.
 */
export function isRecordingRule(value: string): boolean {
  // Matches patterns like:
  // - instance_path:requests:rate5m
  // - path:requests:rate5m
  // - job:request_failures_per_requests:ratio_rate5m
  // - apiserver_request:availability30d
  // - asserts:container_memory
  // - :requests:rate5m
  return /^\w*:.*?(?::\w+)?$/.test(value);
}

export function computeRulesGroups(options: Array<{ label: string; value: string }>) {
  const rulesMap = new Map<MetricType, string[]>([
    ['metrics', []],
    ['rules', []],
  ]);

  for (const option of options) {
    const { value } = option;
    const key: MetricType = isRecordingRule(value) ? 'rules' : 'metrics';

    const values = rulesMap.get(key) ?? [];
    values.push(value);
    rulesMap.set(key, values);
  }

  return [
    { value: '^(?!.*:.*)', label: ruleGroupLabels.metrics, count: rulesMap.get('metrics')!.length },
    { value: ':', label: ruleGroupLabels.rules, count: rulesMap.get('rules')!.length },
  ];
}
