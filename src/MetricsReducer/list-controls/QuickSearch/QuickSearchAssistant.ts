import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
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

/**
 * Opens the Grafana Assistant with context from the current scene.
 * Passes datasource, label filters, and time range as context.
 *
 * @param sceneObject - The scene object to gather context from
 * @param question - The user's question (without the leading '?')
 */
export function openQuickSearchAssistant(sceneObject: SceneObject, question: string): void {
  if (!question.trim()) {
    return;
  }

  const context = [];

  // Datasource context
  const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE) as DataSourceVariable | undefined;
  const datasourceUid = (dsVariable?.state.value as string) ?? '';

  if (datasourceUid) {
    context.push(createAssistantContextItem('datasource', { datasourceUid }));
  }

  // Label filters context
  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject);
  if (isAdHocFiltersVariable(filtersVariable) && filtersVariable.state.filters.length > 0) {
    context.push(
      createAssistantContextItem('structured', {
        title: 'Current label filters',
        data: {
          filters: filtersVariable.state.filters.map((f) => ({
            key: f.key,
            operator: f.operator,
            value: f.value,
          })),
        },
      })
    );
  }

  // Time range context
  const timeRange = sceneGraph.getTimeRange(sceneObject).state;
  context.push(
    createAssistantContextItem('structured', {
      title: 'Time range',
      data: {
        from: timeRange.from,
        to: timeRange.to,
      },
    })
  );

  // Track the event
  reportExploreMetrics('quick_search_assistant_question_asked', { question });

  openAssistant({
    origin: 'grafana-metricsdrilldown-app/quick-search',
    prompt: question,
    context,
  });
}

