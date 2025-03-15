import { VariableHide, VariableRefresh } from '@grafana/data';
import { QueryVariable } from '@grafana/scenes';

import { MetricsWithLabelValueDataSource } from './MetricsWithLabelValueDataSource';

export const VAR_METRIC_WITH_LABEL_VALUE = 'metrics-with-label-value';

export class MetricsWithLabelValueVariable extends QueryVariable {
  constructor({ labelName, labelValue }: { labelName: string; labelValue: string }) {
    super({
      name: VAR_METRIC_WITH_LABEL_VALUE,
      datasource: { uid: MetricsWithLabelValueDataSource.uid },
      query: `{${labelName}="${labelValue}"}`,
      isMulti: false,
      allowCustomValue: false,
      refresh: VariableRefresh.onTimeRangeChanged,
      hide: VariableHide.hideVariable,
      skipUrlSync: true,
      // BOTH "value" and "includeAll" below ensure the repetition in SceneByVariableRepeater
      // // (if not set, it'll render only the 1st variable option)
      value: '$__all',
      includeAll: true,
    });
  }
}
