import { t } from '@grafana/i18n';
import { CustomVariable } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

import { type HistogramBreakdownFn } from 'shared/GmdVizPanel/GmdVizPanel';
import { VAR_HISTOGRAM_BREAKDOWN_FN } from 'shared/shared';

export const HISTOGRAM_BREAKDOWN_FN_OPTIONS: Array<{ label: string; value: HistogramBreakdownFn }> = [
  { label: 'Sum', value: 'sum' },
  { label: 'p99', value: 'p99' },
  { label: 'p95', value: 'p95' },
  { label: 'p75', value: 'p75' },
  { label: 'p50', value: 'p50' },
];

// Visibility is decided by LabelBreakdownScene (which already tracks metric type), not by this
// variable itself: rendering is gated there, so this stays a plain static-options variable.
export class HistogramBreakdownFnVariable extends CustomVariable {
  constructor() {
    super({
      name: VAR_HISTOGRAM_BREAKDOWN_FN,
      label: t('breakdown.histogram-fn.label', 'Histogram function'),
      query: HISTOGRAM_BREAKDOWN_FN_OPTIONS.map(({ label, value }) => `${label} : ${value}`).join(','),
      value: 'sum',
      text: t('breakdown.histogram-fn.default-text', 'Sum'),
      hide: VariableHide.hideVariable,
    });
  }
}
