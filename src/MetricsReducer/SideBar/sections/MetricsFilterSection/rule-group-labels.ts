export const RULE_GROUP_LABELS = {
  metrics: 'Non-rules metrics',
  rules: 'Recording rules',
} as const;

export type RuleGroupLabel = (typeof RULE_GROUP_LABELS)[keyof typeof RULE_GROUP_LABELS];

/**
 * Maps regex patterns used for rule filtering to their human-readable labels.
 * These regexes are used in URLs and need to be displayed in a user-friendly way.
 */
export const RULE_REGEX_TO_LABEL: Record<string, RuleGroupLabel> = {
  '^(?!.*:.*)': RULE_GROUP_LABELS.metrics,
  ':': RULE_GROUP_LABELS.rules,
} as const;
