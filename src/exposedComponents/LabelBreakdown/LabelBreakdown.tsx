import { type DataSourceApi } from '@grafana/data';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Wingman } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'interactions';
import { newMetricsTrail } from 'utils';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../utils/utils.timerange';

export interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

const LabelBreakdown = async ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
  const [error] = useCatchExceptions();
  const { metric, labels } = await parsePromQLQuery(query);
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

  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'label_breakdown' });
    }
  }, []);

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Wingman trail={trail} />}
    </div>
  );
};

export default LabelBreakdown;
