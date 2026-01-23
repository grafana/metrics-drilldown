import { t } from '@grafana/i18n';

export type AssistantHintType = 'none' | 'question_mark' | 'tab_enter';

export function getQuickSearchPlaceholder(args: {
  targetName: string;
  isQuestionMode: boolean;
  isAssistantAvailable: boolean;
  assistantHintType: AssistantHintType;
}): string {
  const { targetName, isQuestionMode, isAssistantAvailable, assistantHintType } = args;

  if (!isAssistantAvailable) {
    return t('quick-search.placeholder', 'Quick search {{targetName}}s', { targetName });
  }

  if (isQuestionMode) {
    return t('quick-search.placeholder-question-mode', 'Ask the Grafana Assistant a question and press enter');
  }

  if (assistantHintType === 'question_mark') {
    return t(
      'quick-search.placeholder-with-assistant',
      'Quick search {{targetName}}s or type ? to ask the Grafana Assistant',
      {
        targetName,
      }
    );
  }

  if (assistantHintType === 'tab_enter') {
    return t(
      'quick-search.placeholder-with-assistant-tab-enter',
      'Quick search {{targetName}}s or press tab then enter to ask the Grafana Assistant',
      { targetName }
    );
  }

  return t('quick-search.placeholder', 'Quick search {{targetName}}s', { targetName });
}
