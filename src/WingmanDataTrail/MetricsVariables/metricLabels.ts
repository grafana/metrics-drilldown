export const ruleGroupLabels = {
  metrics: 'Non-rules metrics',
  rules: 'Recording rules',
} as const;

export type RuleGroupLabel = (typeof ruleGroupLabels)[keyof typeof ruleGroupLabels];
