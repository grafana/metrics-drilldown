import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';
import { useEffect, useState } from 'react';

import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

/**
 * Hook to track assistant availability.
 * Returns true if the Grafana Assistant is available, false otherwise.
 */
export function useQuickSearchAssistantAvailability(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const subscription = isAssistantAvailable().subscribe((available) => {
      setIsAvailable(available);
    });
    return () => subscription.unsubscribe();
  }, []);

  return isAvailable;
}

type QuickSearchContextInput = {
  datasourceUid: string;
  filters: Array<{ key: string; operator: string; value: string }>;
  timeRange: { from: string; to: string };
};

/** Pure builder for the quick-search Assistant context. Covered by the assistant evals (src/evals). */
export function buildQuickSearchContext({ datasourceUid, filters, timeRange }: QuickSearchContextInput) {
  const context = [];

  if (datasourceUid) {
    context.push(createAssistantContextItem('datasource', { datasourceUid }));
  }

  if (filters.length > 0) {
    context.push(
      createAssistantContextItem('structured', {
        title: t('quick-search-assistant.label-filters-title', 'Current label filters'),
        data: { filters: filters.map((f) => ({ key: f.key, operator: f.operator, value: f.value })) },
      })
    );
  }

  context.push(
    createAssistantContextItem('structured', {
      title: t('quick-search-assistant.time-range-title', 'Time range'),
      data: { from: timeRange.from, to: timeRange.to },
    })
  );

  return context;
}

/**
 * Opens the Grafana Assistant with context from the current scene.
 * Passes datasource, label filters, and time range as context.
 *
 * @param sceneObject - The scene object to gather context from
 * @param question - The user's question
 */
export function openQuickSearchAssistant(sceneObject: SceneObject, question: string): void {
  if (!question.trim()) {
    return;
  }

  const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable | undefined;
  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);
  const timeRange = sceneGraph.getTimeRange(sceneObject).state;

  const context = buildQuickSearchContext({
    datasourceUid: (dsVariable?.state.value as string) ?? '',
    filters: isAdHocFiltersVariable(filtersVariable) ? filtersVariable.state.filters : [],
    timeRange: { from: timeRange.from, to: timeRange.to },
  });

  // Track the event
  reportExploreMetrics('quick_search_assistant_question_asked', { question });

  openAssistant({
    origin: 'grafana-metricsdrilldown-app/quick-search',
    prompt: question,
    context,
  });
}
