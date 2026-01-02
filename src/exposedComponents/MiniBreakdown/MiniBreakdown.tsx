import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { newMetricsTrail } from 'shared/utils/utils';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

export interface MiniBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: string; // The data source UID
}

export const MiniBreakdown = ({ query, initialStart, initialEnd, dataSource }: MiniBreakdownProps) => {
  const [error] = useCatchExceptions();
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'label_breakdown' });
    }
  }, []);

  const { metric, labels } = parsePromQLQuery(query);

  const trail = newMetricsTrail({
    metric,
    initialDS: dataSource,
    initialFilters: labels.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  logger.log('trail', trail);

  return (
    <div data-testid="metrics-drilldown-mini-label-breakdown">
      {error ? <ErrorView error={error} /> : <>Hello world</>}
    </div>
  );
};
