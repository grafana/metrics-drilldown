import { CustomVariable } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export const VAR_VARIANT = 'variant';

export class VariantVariable extends CustomVariable {
  public static OPTIONS = ['onboard-filters-sidebar', 'onboard-filters-pills', 'onboard-filters-labels'];

  constructor() {
    super({
      name: VAR_VARIANT,
      query: VariantVariable.OPTIONS.join(','),
      hide: VariableHide.hideVariable,
      includeAll: false,
    });
  }
}
