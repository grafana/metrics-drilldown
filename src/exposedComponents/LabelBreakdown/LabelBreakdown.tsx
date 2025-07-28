import { dateMath, type DataSourceApi } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Wingman } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'interactions';
import { newMetricsTrail } from 'utils';

import { parsePromQLQuery } from '../../extensions/links';

export interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

function toSceneTime(time: string | number): string {
  if (typeof time === 'string' && dateMath.isMathString(time)) {
    // 'now', 'now-1h', etc.
    return time;
  }

  return dateMath.toDateTime(new Date(time), { roundUp: false })!.toISOString();
}

const LabelBreakdown = ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
  const [error] = useCatchExceptions();
  const { metric, labels } = parsePromQLQuery(query);
  const from = toSceneTime(initialStart);
  const to = toSceneTime(initialEnd);
  const trail = newMetricsTrail({
    metric,
    initialDS: dataSource.uid,
    initialFilters: labels.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: new SceneTimeRange({ from, to }),
    embedded: true,
  });

  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' });
    }
  }, []);

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Wingman trail={trail} />}
    </div>
  );
};

export default LabelBreakdown;
