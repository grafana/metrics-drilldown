import { type DataSourceApi } from '@grafana/data';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Trail } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { newMetricsTrail } from 'shared/utils/utils';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

export interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

const LabelBreakdown = ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
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
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Trail trail={trail} />}
    </div>
  );
};

export default LabelBreakdown;
