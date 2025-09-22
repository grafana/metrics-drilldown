import { config, usePluginLinks } from '@grafana/runtime';
import { type SceneDataQuery, type SceneTimeRangeState } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';
import React, { useMemo } from 'react';

import { reportExploreMetrics } from '../../shared/tracking/interactions';

const extensionPointId = 'grafana-metricsdrilldown-app/open-in-logs-drilldown/v1';

export interface LogsDrilldownLinkContext {
  targets: SceneDataQuery[];
  timeRange?: SceneTimeRangeState;
}

export function OpenInLogsDrilldownButton({ context }: Readonly<{ context: LogsDrilldownLinkContext }>) {
  const memoizedContext = useMemo(() => context, [context]);
  const { links, isLoading } = usePluginLinks({
    extensionPointId,
    limitPerPlugin: 1,
    context: memoizedContext,
  });
  const logsDrilldownLink = useMemo(() => {
    return links.find(({ pluginId }) => pluginId === 'grafana-lokiexplore-app');
  }, [links]);

  if (isLoading) {
    return (
      <LinkButton variant="secondary" size="sm" disabled>
        Loading...
      </LinkButton>
    );
  }

  const logsDrilldownLinkExists = typeof logsDrilldownLink !== 'undefined';

  return (
    <LinkButton
      href={
        // We prefix with the appSubUrl for environments that don't host grafana at the root.
        logsDrilldownLinkExists
          ? `${config.appSubUrl}${logsDrilldownLink.path}`
          : `${config.appSubUrl}/a/grafana-lokiexplore-app` // We fall back to the app's landing page if a link can't get generated using the supplied `context`
      }
      target="_blank"
      tooltip={
        logsDrilldownLinkExists
          ? 'Use the Logs Drilldown app to explore these logs'
          : 'Navigate to the Logs Drilldown app'
      }
      variant="secondary"
      size="sm"
      onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_logs_drilldown' })}
    >
      {logsDrilldownLinkExists ? 'Open in Logs Drilldown' : 'Open Logs Drilldown'}
    </LinkButton>
  );
}
