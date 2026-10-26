import { sceneGraph, type DataSourceVariable, type SceneObject } from '@grafana/scenes';
import React, { useState } from 'react';

import { VAR_METRICS_VARIABLE, type MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { getPersonalSignals } from './personalization';
import { rankingProfileStorageKey } from './profileStorage';
import { type LocalSignals } from './ranking';
import { RankingProfileEditor } from './RankingProfileEditor';
import { MetricsSorter, sortMetricsAlphabetically } from '../MetricsSorter/MetricsSorter';

export function RankingProfileSettings({ model, onClose }: Readonly<{ model: SceneObject; onClose: () => void }>) {
  const datasource = sceneGraph.lookupVariable(VAR_DATASOURCE, model) as DataSourceVariable;
  const { value } = datasource.useState();
  const datasourceUid = typeof value === 'string' ? value : '';
  return (
    <ScopedSettings
      key={rankingProfileStorageKey(datasourceUid) ?? datasourceUid}
      model={model}
      datasourceUid={datasourceUid}
      onClose={onClose}
    />
  );
}

function ScopedSettings({
  model,
  datasourceUid,
  onClose,
}: Readonly<{ model: SceneObject; datasourceUid: string; onClose: () => void }>) {
  const trail = getTrailFor(model);
  // Snapshot the filtered catalog and cached evidence at opening. No optional integration requests.
  const [snapshot] = useState(() => {
    const sorter = sceneGraph.findByKeyAndType(model, 'metrics-sorter', MetricsSorter);
    const slo = sorter.peekSloMetricSignals(datasourceUid);
    const signals: LocalSignals = {
      trackedMetrics: slo?.trackedMetrics ?? new Map(),
      activeBurnMetrics: slo?.burnStatus === 'error' ? new Set() : (slo?.activeBurnMetrics ?? new Set()),
      attributedFiringCounts: new Map(),
      dashboardCounts: sorter.peekUsageCounts('dashboard-usage'),
      alertCounts: sorter.peekUsageCounts('alerting-usage'),
      personal: getPersonalSignals(datasourceUid),
    };
    const variable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, model) as MetricsVariable | undefined;
    const options = variable?.state.options ?? [];
    const names = sortMetricsAlphabetically(options.map((option) => String(option.value)));
    const metadata = new Map(names.map((name) => [name, trail.peekMetricMetadata(name)]));
    return { names, signals, metadata };
  });
  return (
    <RankingProfileEditor
      datasourceUid={datasourceUid}
      names={snapshot.names}
      signals={snapshot.signals}
      peekMetadata={(name) => snapshot.metadata.get(name)}
      isCurrentScope={() => sceneGraph.lookupVariable(VAR_DATASOURCE, model)?.getValue() === datasourceUid}
      onClose={onClose}
    />
  );
}
