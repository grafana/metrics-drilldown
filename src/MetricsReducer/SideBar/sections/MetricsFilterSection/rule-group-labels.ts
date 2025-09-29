export const RULE_GROUP_LABELS = {
  metrics: 'Non-rules metrics',
  rules: 'Recording rules',
} as const;

export type RuleGroupLabel = (typeof RULE_GROUP_LABELS)[keyof typeof RULE_GROUP_LABELS];
