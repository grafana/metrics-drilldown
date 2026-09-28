import { css } from '@emotion/css';
import { type AdHocVariableFilter, type DataSourceApi, type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef } from 'react';

import { Trail } from 'App/Routes';
import { type KgEntityHint } from 'shared/knowledgeGraph/kgAnnotations';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { newMetricsTrail } from 'shared/utils/utils';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { toSceneTimeRange } from '../../shared/utils/utils.timerange';

export interface EntityMetricsProps {
  labels: Record<string, string>; // Entity labels (service, namespace, etc.)
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
  entityType?: string;
  entityName?: string;
}

const EntityMetrics = ({
  labels,
  initialStart,
  initialEnd,
  dataSource,
  entityType,
  entityName,
}: EntityMetricsProps) => {
  const styles = useStyles2(getStyles);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'entity_metrics' });
    }
  }, []);

  // Convert labels to AdHocVariableFilter format
  const initialFilters: AdHocVariableFilter[] = Object.entries(labels)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      key,
      operator: '=',
      value: String(value),
    }));

  // When entity type and name are provided, use direct KG entity queries
  // instead of the label-resolution fallback
  let kgEntityHint: KgEntityHint | undefined;
  if (entityType && entityName) {
    kgEntityHint = {
      entityType,
      entityName,
      scope: labels.namespace ? { namespace: labels.namespace } : undefined,
    };
  }

  const trail = newMetricsTrail({
    initialDS: dataSource.uid,
    initialFilters,
    kgEntityHint,
    $timeRange: toSceneTimeRange(initialStart, initialEnd),
    embedded: true,
  });

  return (
    <div data-testid="metrics-drilldown-embedded-entity-metrics" className={styles.container}>
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

export default EntityMetrics;
