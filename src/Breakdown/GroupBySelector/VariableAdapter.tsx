import { sceneGraph, type QueryVariable } from '@grafana/scenes';
import React, { useCallback } from 'react';

import { GroupBySelector } from './GroupBySelector';
import { deriveRadioAttributesFromOptions } from './utils';
import { VAR_FILTERS } from '../../shared';
import { isAdHocFiltersVariable } from '../../utils/utils.variables';

import type { GroupBySelectorProps } from './types';


type VariableBackedGroupBySelectorProps = {
  variable: QueryVariable;
} & Omit<GroupBySelectorProps, 'options' | 'value' | 'onChange' | 'filters' | 'radioAttributes'>;

export function VariableBackedGroupBySelector({ variable, ...props }: VariableBackedGroupBySelectorProps) {
  const { options, value: rawValue } = variable.useState();
  const value = variable.hasAllValue() ? 'All' : (rawValue as string);

  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, variable);
  const filters = isAdHocFiltersVariable(filtersVariable)
    ? filtersVariable.state.filters.map((f: any) => ({ key: f.key, operator: f.operator, value: f.value }))
    : [];

  const radioAttributes = deriveRadioAttributesFromOptions(options as Array<{ value?: string }>, 4);

  const onChange = useCallback(
    (selected: string, ignore?: boolean) => {
      const next = selected === 'All' ? '$__all' : selected;
      // Pass isUserAction=true only for real user interactions so URL/history updates
      variable.changeValueTo(next, undefined, !ignore);
    },
    [variable]
  );

  return (
    <GroupBySelector
      options={options as Array<{ label?: string; value: string }>}
      radioAttributes={radioAttributes}
      value={value}
      onChange={onChange}
      filters={filters}
      showAll
      {...props}
    />
  );
}


