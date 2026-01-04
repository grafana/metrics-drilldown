import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect, useMemo, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { useCatchExceptions } from 'App/useCatchExceptions';
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

const MiniBreakdown = ({ query, initialStart, initialEnd, dataSource }: MiniBreakdownProps) => {
  const [error] = useCatchExceptions();
  const styles = useStyles2(getStyles);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'mini_breakdown' });
    }
  }, []);

  const { metric, labels } = parsePromQLQuery(query);

  // useMemo to avoid recreating the trail on every render
  const trail = useMemo(
    () =>
      newMetricsTrail({
        metric,
        initialDS: dataSource,
        initialFilters: labels.map(({ label, op, value }) => ({
          key: label,
          operator: op,
          value,
        })),
        $timeRange: toSceneTimeRange(initialStart, initialEnd),
        embedded: true,
        embeddedMini: true, // Enable mini mode for tooltip navigation preview
      }),
    [metric, dataSource, labels, initialStart, initialEnd]
  );

  return (
    <div data-testid="metrics-drilldown-mini-breakdown" className={styles.container}>
      {error ? <ErrorView error={error} /> : <trail.Component model={trail} />}
    </div>
  );
};

function getStyles() {
  return {
    container: css({
      width: '300px',
    }),
  };
}

// Default export required for React.lazy
export default MiniBreakdown;

// Named export for component usage
export { MiniBreakdown };
