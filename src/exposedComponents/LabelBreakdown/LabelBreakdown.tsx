import { css } from '@emotion/css';
import { type DataSourceApi, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef } from 'react';

import { Trail } from 'App/Routes';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { newMetricsTrail } from 'shared/utils/utils';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

export interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

const LabelBreakdown = ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
  const styles = useStyles2(getStyles);
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
    initialDS: dataSource.uid,
    initialFilters: labels.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown" className={styles.container}>
      <Trail trail={trail} />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      // Host surfaces provide their own page chrome around this component, so we self-paint the
      // background here rather than leaving it transparent to the host's own background, which
      // isn't guaranteed to match theme.colors.background.primary.
      background: getAppBackgroundColor(theme, true),
      height: '100%',
    }),
  };
}

export default LabelBreakdown;
