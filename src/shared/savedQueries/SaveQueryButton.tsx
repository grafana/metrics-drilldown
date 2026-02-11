
import { t } from '@grafana/i18n';
import { utf8Support, type PromQuery } from '@grafana/prometheus';
import { usePluginComponent } from '@grafana/runtime';
import { sceneGraph, type AdHocFiltersVariable, type SceneObject } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { MetricScene } from 'MetricScene/MetricScene';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { isQueryLibrarySupported, type OpenQueryLibraryComponentProps } from './savedQuery';
import { SaveQueryModal } from './SaveQueryModal';

interface Props {
  readonly sceneRef: SceneObject;
}

export function SaveQueryButton({ sceneRef }: Props) {
  const [saving, setSaving] = useState(false);
  const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
    usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

  const trail = useMemo(() => getTrailFor(sceneRef), [sceneRef]);

  const { dsUid, dsName } = useMemo(() => {
    const ds = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);
    return {
      dsUid: ds.getValue().toString(),
      dsName: ds.state.text?.toString() ?? '',
    };
  }, [trail]);

  const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, sceneRef) as AdHocFiltersVariable;
  const { filters: allFilters } = filtersVar.useState();

  const promql = useMemo(() => {
    let metric = '';
    try {
      const metricScene = sceneGraph.getAncestor(sceneRef, MetricScene);
      metric = metricScene.state.metric;
    } catch {
      // No MetricScene ancestor — we're in the MetricsReducer view
    }

    const labelStr = allFilters
      .filter((f) => f.key !== '__name__')
      .map((f) => `${utf8Support(f.key)}${f.operator}"${f.value}"`)
      .join(',');

    if (labelStr) {
      return metric ? `${metric}{${labelStr}}` : `{${labelStr}}`;
    }
    return metric;
  }, [sceneRef, allFilters]);

  const fallbackComponent = useMemo(
    () => (
      <>
        <ToolbarButton
          variant="canvas"
          icon="save"
          disabled={!promql}
          onClick={() => setSaving(true)}
          tooltip={t('metrics.metrics-drilldown.save-query.button-tooltip', 'Save query')}
        />
        {saving && <SaveQueryModal dsUid={dsUid} query={promql} onClose={() => setSaving(false)} />}
      </>
    ),
    [dsUid, promql, saving]
  );

  const query: PromQuery = useMemo(
    () => ({
      refId: 'drilldown',
      datasource: {
        type: 'prometheus',
        uid: dsUid,
      },
      expr: promql,
    }),
    [dsUid, promql]
  );

  if (trail.state.embedded) {
    return null;
  }

  if (!isQueryLibrarySupported() || !promql) {
    return fallbackComponent;
  } else if (isLoadingExposedComponent || !OpenQueryLibraryComponent) {
    return null;
  }

  return (
    <OpenQueryLibraryComponent
      datasourceFilters={[dsName]}
      query={query}
      tooltip={t('metrics.metrics-drilldown.save-query.button-tooltip-saved-queries', 'Save in Saved Queries')}
    />
  );
}
