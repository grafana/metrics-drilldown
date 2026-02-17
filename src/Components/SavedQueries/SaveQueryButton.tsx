import React, { useMemo, useState } from 'react';

import { AdHocVariableFilter } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { SaveQueryModal } from './SaveQueryModal';
import { DataTrail } from '../../AppDataTrail/DataTrail';
import { PrometheusQuery, isQueryLibrarySupported, OpenQueryLibraryComponentProps } from '../../services/saveQuery';
import { getDataSourceVariable } from '../../services/variableGetters';
import { buildQueryExpression, LabelMatcher } from '../../shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, MetricType } from '../../shared/GmdVizPanel/matchers/getMetricType';
import { VAR_FILTERS } from '../../shared/shared';
import { isAdHocFiltersVariable } from '../../shared/utils/utils.variables';

interface Props {
  sceneRef: SceneObject;
}

export function SaveQueryButton({ sceneRef }: Props) {
  const [saving, setSaving] = useState(false);
  const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
    usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

  const trail = useMemo(() => sceneGraph.getAncestor(sceneRef, DataTrail), [sceneRef]);
  const metric = useMemo(() => trail.state.metric, [trail]);

  const dsUid = useMemo(() => {
    const dsVariable = getDataSourceVariable(trail);
    return dsVariable.getValue().toString();
  }, [trail]);

  const dsName = useMemo(() => {
    const dsVariable = getDataSourceVariable(trail);
    return dsVariable.state.text?.toString() || '';
  }, [trail]);

  const labelMatchers = useMemo(() => {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return [];
    }
    return filtersVar.state.filters
      .filter((f: AdHocVariableFilter) => f.key !== '__name__')
      .map(
        (f: AdHocVariableFilter): LabelMatcher => ({
          key: f.key,
          operator: f.operator,
          value: f.value,
        })
      );
  }, [trail]);

  const fallbackComponent = useMemo(
    () => (
      <>
        <ToolbarButton variant="canvas" icon="save" onClick={() => setSaving(true)} tooltip="Save query" />
        {saving && <SaveQueryModal dsUid={dsUid} metric={metric} sceneRef={sceneRef} onClose={() => setSaving(false)} />}
      </>
    ),
    [dsUid, metric, saving, sceneRef]
  );

  const query: PrometheusQuery = useMemo(() => {
    const expr = buildQueryExpression({
      metric: { name: metric || '', type: getMetricTypeSync(metric || '') as MetricType },
      labelMatchers,
      addIgnoreUsageFilter: true,
    });

    return {
      refId: 'drilldown',
      datasource: {
        type: 'prometheus',
        uid: dsUid,
      },
      expr,
    };
  }, [dsUid, metric, labelMatchers]);

  // Don't show in embedded mode
  if (trail.state.embedded) {
    return null;
  }

  // Don't show if no metric is selected
  if (!metric) {
    return null;
  }

  if (!isQueryLibrarySupported()) {
    return fallbackComponent;
  } else if (isLoadingExposedComponent || !OpenQueryLibraryComponent) {
    return null;
  }

  return (
    <OpenQueryLibraryComponent
      datasourceFilters={[dsName]}
      query={query}
      tooltip="Save in Saved Queries"
    />
  );
}
