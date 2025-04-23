type MetricType = 'metrics' | 'rules';

export function computeRulesGroups(options: Array<{ label: string; value: string }>) {
  const rulesMap = new Map<MetricType, string[]>([
    ['metrics', []],
    ['rules', []],
  ]);

  for (const option of options) {
    const { value } = option;
    const key: MetricType = /:/i.test(value) ? 'rules' : 'metrics';

    const values = rulesMap.get(key) ?? [];
    values.push(value);
    rulesMap.set(key, values);
  }

  return [
    { value: '^(?!.*:.*)', label: 'Non-rules metrics', count: rulesMap.get('metrics')!.length },
    { value: ':', label: 'Recording rules', count: rulesMap.get('rules')!.length },
  ];
}
