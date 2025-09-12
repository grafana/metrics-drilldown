import { VariableHide, VariableRefresh } from '@grafana/data';
import { QueryVariable, sceneGraph } from '@grafana/scenes';

import { VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared';
import { withLifecycleEvents } from 'WingmanDataTrail/MetricsVariables/withLifecycleEvents';

import { MetricsWithLabelValueDataSource } from './MetricsWithLabelValueDataSource';

export const VAR_METRIC_WITH_LABEL_VALUE = 'metrics-with-label-value';

export class MetricsWithLabelValueVariable extends QueryVariable {
  constructor({
    labelName,
    labelValue,
    removeRules,
  }: {
    labelName: string;
    labelValue: string;
    removeRules?: boolean;
  }) {
    super({
      key: `${VAR_METRIC_WITH_LABEL_VALUE}-${labelName}-${labelValue}`,
      name: VAR_METRIC_WITH_LABEL_VALUE,
      datasource: { uid: MetricsWithLabelValueDataSource.uid },
      query: MetricsWithLabelValueVariable.buildQuery(labelName, labelValue, removeRules),
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

    this.addActivationHandler(this.onActivate.bind(this, labelName, labelValue, removeRules));

    // required for filtering and sorting
    return withLifecycleEvents<MetricsWithLabelValueVariable>(this);
  }

  protected onActivate(labelName: string, labelValue: string, removeRules?: boolean) {
    const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);

    if (adHocFiltersVariable?.state.hide !== VariableHide.hideVariable) {
      this.setState({
        query: MetricsWithLabelValueVariable.buildQuery(labelName, labelValue, removeRules),
      });
    }
  }

  private static buildQuery(labelName: string, labelValue: string, removeRules?: boolean) {
    return removeRules
      ? `removeRules{${labelName}="${labelValue}",${VAR_FILTERS_EXPR}}`
      : `{${labelName}="${labelValue}",${VAR_FILTERS_EXPR}}`;
  }
}
