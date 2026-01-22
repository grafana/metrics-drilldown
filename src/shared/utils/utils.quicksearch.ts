import { t } from '@grafana/i18n';

export type AssistantHint = 'tab' | 'question_mark';

export function getQuickSearchPlaceholder(args: {
  targetName: string;
  isQuestionMode: boolean;
  isAssistantAvailable: boolean;
  assistantHint: AssistantHint;
}): string {
  const { targetName, isQuestionMode, isAssistantAvailable, assistantHint } = args;

  if (isQuestionMode) {
    return t('quick-search.placeholder-question-mode', 'Ask the Grafana Assistant a question and press enter');
  }

  if (!isAssistantAvailable) {
    return t('quick-search.placeholder', 'Quick search {{targetName}}s', { targetName });
  }

  if (assistantHint === 'tab') {
    return t('quick-search.placeholder-with-assistant-tab', 'Quick search {{targetName}}s or press Tab to ask the Grafana Assistant', {
      targetName,
    });
  }

  return t('quick-search.placeholder-with-assistant', 'Quick search {{targetName}}s or type ? to ask the Grafana Assistant', {
    targetName,
  });
}

