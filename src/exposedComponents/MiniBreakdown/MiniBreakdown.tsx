import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { MiniBreakdownScene } from 'exposedComponents/MiniBreakdown/MiniBreakdownScene';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

export interface MiniBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: string;
}

export const MiniBreakdown = ({ query, initialStart, initialEnd, dataSource }: MiniBreakdownProps) => {
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

  const scene = new MiniBreakdownScene({
    metric,
    dataSource,
    initialFilters: labels.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
  });

  return (
    <div className={styles.container} data-testid="mini-breakdown">
      {error ? <ErrorView error={error} /> : <scene.Component model={scene} />}
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      overflow: 'hidden',
    }),
  };
}
