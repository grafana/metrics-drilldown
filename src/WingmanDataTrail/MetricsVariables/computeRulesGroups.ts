import { ruleGroupLabels } from './metricLabels';
import { isRecordingRule } from '../../utils/utils.recording-rules';

type MetricType = 'metrics' | 'rules';

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
