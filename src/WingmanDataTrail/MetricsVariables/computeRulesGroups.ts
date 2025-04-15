type MetricType = 'metrics' | 'rules' | 'alerts';

export function computeRulesGroups(options: Array<{ label: string; value: string }>) {
  const rulesMap = new Map<MetricType, string[]>([
    ['metrics', []],
    ['rules', []],
    ['alerts', []],
  ]);

  for (const option of options) {
    const { value } = option;
    let key: MetricType = 'metrics';

    if (/:/i.test(value)) {
      key = 'rules';
    } else if (/^alert/i.test(value)) {
      key = 'alerts';
    }

    const values = rulesMap.get(key) ?? [];
    values.push(value);
    rulesMap.set(key, values);
  }

  return [
    { value: '^(?!alert)(?!.*:.*)', label: 'Non-rules metrics', count: rulesMap.get('metrics')!.length },
    { value: ':', label: 'Recording rules', count: rulesMap.get('rules')!.length },
    { value: '^alert', label: 'Alerting rules', count: rulesMap.get('alerts')!.length },
  ];
}
