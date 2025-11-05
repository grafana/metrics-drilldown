import { PageLayoutType, type NavModelItem } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { UrlSyncContextProvider, type SceneObject } from '@grafana/scenes';
import React, { useEffect, useMemo, useState } from 'react';

import { type DataTrail } from '../AppDataTrail/DataTrail';
import { defaultActionView } from '../MetricScene/MetricActionBar';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricsReducer } from '../MetricsReducer/MetricsReducer';
import { useMetricsDrilldownQuestions } from './assistant/useMetricsDrilldownQuestions';

interface TrailProps {
  trail: DataTrail;
}

/**
 * Generates the page navigation breadcrumb based on the current scene state
 * @param topScene - The current top-level scene (MetricScene or MetricsReducer)
 * @param metric - The currently selected metric name
 * @param currentActionViewName - The display name of the current action view
 * @returns Navigation model item for breadcrumbs, or undefined if no navigation should be shown
 */
export function getPageNav(
  topScene: SceneObject | undefined,
  metric: string | undefined,
  currentActionViewName: string
): NavModelItem | undefined {
  if (metric && topScene instanceof MetricScene) {
    // When a metric is selected, we add the metric name and action view name to the navigation breadcrumbs
    // For example:
    // - "Home > Drilldown > Metrics > metric_a > Breakdown"
    // - "Home > Drilldown > Metrics > metric_b > Related metrics"
    // - "Home > Drilldown > Metrics > metric_c > Related logs"

    const searchParams = new URLSearchParams(window.location.search);
    const searchParamsWithDefaultActionView = new URLSearchParams(searchParams);
    searchParamsWithDefaultActionView.set('actionView', defaultActionView);

    const navModelItem: NavModelItem = {
      text: currentActionViewName,
      url: `${window.location.pathname}?${searchParams.toString()}`,
      parentItem: {
        text: metric,
        // Clicking on the metric name should reset the default action view
        url: `${window.location.pathname}?${searchParamsWithDefaultActionView.toString()}`,
        parentItem: {
          text: 'Metrics',
          url: window.location.pathname,
        },
      },
    };

    return navModelItem;
  } else if (topScene instanceof MetricsReducer) {
    return { text: 'All metrics' };
  }

  return undefined;
}

export default function Trail({ trail }: Readonly<TrailProps>) {
  // Register all assistant questions for metrics drilldown
  // Questions are automatically matched based on URL patterns
  useMetricsDrilldownQuestions();

  const { topScene, metric } = trail.useState();
  const [currentActionViewName, setCurrentActionViewName] = useState<string>('');

  // Subscribe to MetricScene state changes to update breadcrumb
  useEffect(() => {
    if (topScene instanceof MetricScene) {
      // Get current action view name
      setCurrentActionViewName(topScene.getActionViewName());

      // Subscribe to action view state changes
      const topSceneSubscription = topScene.subscribeToState(() => {
        setCurrentActionViewName(topScene.getActionViewName());
      });

      return () => {
        if (topSceneSubscription) {
          topSceneSubscription.unsubscribe();
        }
      };
    } else {
      setCurrentActionViewName('');
      return undefined;
    }
  }, [topScene]);

  // Create pageNav based on current state
  const pageNav = useMemo(
    (): NavModelItem | undefined => getPageNav(topScene, metric, currentActionViewName),
    [topScene, metric, currentActionViewName]
  );

  return (
    <PluginPage pageNav={pageNav} layout={PageLayoutType.Canvas}>
      <UrlSyncContextProvider
        scene={trail}
        createBrowserHistorySteps={true}
        updateUrlOnInit={true}
        namespace={trail.state.urlNamespace}
      >
        <trail.Component model={trail} />
      </UrlSyncContextProvider>
    </PluginPage>
  );
}
