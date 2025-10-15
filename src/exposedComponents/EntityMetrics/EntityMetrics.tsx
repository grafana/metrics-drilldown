import { type DataSourceApi } from '@grafana/data';
import React, { useEffect, useRef } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Trail } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { newMetricsTrail } from 'shared/utils/utils';
import { toSceneTimeRange } from '../../shared/utils/utils.timerange';
import { type AdHocVariableFilter } from '@grafana/scenes';

export interface EntityMetricsProps {
  labels: Record<string, string>;  // Entity labels (service, namespace, etc.)
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
  entityType?: string;  // Optional for UI customization
}

const EntityMetrics = ({ labels, initialStart, initialEnd, dataSource, entityType }: EntityMetricsProps) => {
  const [error] = useCatchExceptions();
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'entity_metrics', entityType });
    }
  }, [entityType]);

  // Convert labels to AdHocVariableFilter format
  const initialFilters: AdHocVariableFilter[] = Object.entries(labels)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ({
      key,
      operator: '=',
      value: String(value),
    }));

  const trail = newMetricsTrail({
    initialDS: dataSource.uid,
    initialFilters,
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-entity-metrics">
      {error ? <ErrorView error={error} /> : <Trail trail={trail} />}
    </div>
  );
};

export default EntityMetrics;
