import { type DataSourceApi } from '@grafana/data';
import React, { useEffect, useRef, useState } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Wingman } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'interactions';
import { newMetricsTrail } from 'utils';
import { type ParsedPromQLQuery } from 'utils/utils.promql';

import { parsePromQLQuery } from '../../extensions/links';
import { toSceneTimeRange } from '../../utils/utils.timerange';

export interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

const LabelBreakdown = ({ query, initialStart, initialEnd, dataSource }: LabelBreakdownProps) => {
  const [error] = useCatchExceptions();
  const [parsedPromQLQuery, setParsedPromQLQuery] = useState<ParsedPromQLQuery | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'label_breakdown' });
    }
  }, []);

  useEffect(() => {
    parsePromQLQuery(query).then(setParsedPromQLQuery);
  }, [query]);

  if (!parsedPromQLQuery) {
    return <div>Loading...</div>;
  }

  const trail = newMetricsTrail({
    metric: parsedPromQLQuery.metric,
    initialDS: dataSource.uid,
    initialFilters: parsedPromQLQuery.labels.map(({ label, op, value }) => ({
      key: label,
      operator: op,
      value,
    })),
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Wingman trail={trail} />}
    </div>
  );
};

export default LabelBreakdown;
