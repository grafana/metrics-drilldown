import { sceneGraph, type QueryVariable } from '@grafana/scenes';
import React, { useCallback } from 'react';

import { GroupBySelector } from './GroupBySelector';
import { VAR_FILTERS } from '../../shared';

import type { GroupBySelectorProps } from './types';


type VariableBackedGroupBySelectorProps = {
  variable: QueryVariable;
} & Omit<GroupBySelectorProps, 'options' | 'value' | 'onChange' | 'filters' | 'radioAttributes'>;

export function VariableBackedGroupBySelector({ variable, ...props }: VariableBackedGroupBySelectorProps) {
  const { options, value: rawValue } = variable.useState();
  const value = variable.hasAllValue() ? 'All' : (rawValue as string);

  // Keep lookup to preserve side-effects if any; filters are no longer needed here
  sceneGraph.lookupVariable(VAR_FILTERS, variable);

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
      value={value}
      onChange={onChange}
      showAll
      {...props}
    />
  );
}


