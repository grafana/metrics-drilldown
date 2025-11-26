import { type AdHocVariableFilter } from '@grafana/data';
import {
  type AdHocFiltersVariable,
  type CustomVariable,
  type QueryVariable,
  type SceneVariable,
} from '@grafana/scenes';

import { type PromQLLabelMatcher } from './utils.promql';

type MaybeVariable = SceneVariable | null | undefined;

export function isAdHocFiltersVariable(variable: MaybeVariable): variable is AdHocFiltersVariable {
  return variable !== null && variable?.state.type === 'adhoc';
}

export function isCustomVariable(variable: MaybeVariable): variable is CustomVariable {
  return variable !== null && variable?.state.type === 'custom';
}

export function isQueryVariable(variable: MaybeVariable): variable is QueryVariable {
  return variable !== null && variable?.state.type === 'query';
}

export function labelMatcherToAdHocFilter(labelMatcher: PromQLLabelMatcher): AdHocVariableFilter {
  return {
    key: labelMatcher.label,
    operator: labelMatcher.op,
    value: labelMatcher.value,
  };
}
