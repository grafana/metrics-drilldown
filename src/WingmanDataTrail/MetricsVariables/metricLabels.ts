// Constants for metric rule type labels
export const LABEL_METRICS = 'Non-rules metrics';
export const LABEL_RULES = 'Recording rules';

export const ruleGroupLabels = {
  metrics: LABEL_METRICS,
  rules: LABEL_RULES,
} as const;

export type RuleGroupLabel = (typeof ruleGroupLabels)[keyof typeof ruleGroupLabels];
