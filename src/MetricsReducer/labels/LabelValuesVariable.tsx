import { VariableHide, VariableRefresh } from '@grafana/data';
import { QueryVariable } from '@grafana/scenes';
import React from 'react';

import { LabelsDataSource } from './LabelsDataSource';

export const VAR_LABEL_VALUES = 'wingmanLabelValues';

export class LabelValuesVariable extends QueryVariable {
  constructor({ labelName }: { labelName: string }) {
    super({
      name: VAR_LABEL_VALUES,
      datasource: { uid: LabelsDataSource.uid },
      // just some syntax we make up so that the data source can decide what to fetch
      query: `valuesOf(${labelName})`,
      isMulti: false,
      allowCustomValue: false,
      refresh: VariableRefresh.onTimeRangeChanged,
      hide: VariableHide.hideVariable,
      // BOTH "value" and "includeAll" below ensure the repetition in SceneByVariableRepeater
      // // (if not set, it'll render only the 1st variable option)
      value: '$__all',
      includeAll: true,
    });
  }

  public static readonly Component = () => {
    return <></>;
  };
}
