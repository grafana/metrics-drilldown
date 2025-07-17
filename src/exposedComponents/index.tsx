import { type DataSourceApi } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';
import React from 'react';

import { Wingman } from 'App/Routes';
import { newMetricsTrail } from 'utils';
import { parsePromQLQuery } from 'utils/utils.promql';

interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

function formatTime(time: string | number) {
  if (typeof time === 'number') {
    return new Date(time).toISOString();
  }

  return time;
}

export const LabelBreakdown = ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
  const { metricNames, labelFilters } = parsePromQLQuery(query);
  const from = formatTime(initialStart);
  const to = formatTime(initialEnd);
  const trail = newMetricsTrail({
    metric: metricNames[0],
    initialDS: dataSource.uid,
    initialFilters: labelFilters.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: new SceneTimeRange({ from, to }),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      <Wingman trail={trail} />
    </div>
  );
};
