import { t } from '@grafana/i18n';

export function getQuickSearchPlaceholder(args: {
  targetName: string;
  isQuestionMode: boolean;
  isAssistantAvailable: boolean;
  showAssistantHint: boolean;
}): string {
  const { targetName, isQuestionMode, isAssistantAvailable, showAssistantHint } = args;

  if (!isAssistantAvailable) {
    return t('quick-search.placeholder', 'Quick search {{targetName}}s', { targetName });
  }

  if (isQuestionMode) {
    return t('quick-search.placeholder-question-mode', 'Ask the Grafana Assistant a question and press enter');
  }

  if (showAssistantHint) {
    return t('quick-search.placeholder-with-assistant', 'Quick search {{targetName}}s or type ? to ask the Grafana Assistant', {
      targetName,
    });
  }

  return t('quick-search.placeholder', 'Quick search {{targetName}}s', { targetName });
}
