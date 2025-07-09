import { config, usePluginLinks } from '@grafana/runtime';
import { type SceneDataQuery, type SceneTimeRangeState } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';
import React, { useMemo } from 'react';

import { reportExploreMetrics } from '../interactions';

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

  if (typeof logsDrilldownLink === 'undefined') {
    return null;
  }

  return (
    <LinkButton
      href={
        // We prefix with the appSubUrl for environments that don't host grafana at the root.
        `${config.appSubUrl}${logsDrilldownLink.path}`
      }
      target="_blank"
      tooltip={'Navigate to the Logs Drilldown app'}
      variant="secondary"
      size="sm"
      onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_logs_drilldown' })}
    >
      Open in Logs Drilldown
    </LinkButton>
  );
}
