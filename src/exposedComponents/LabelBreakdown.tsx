import { type DataSourceApi, type PluginExtensionExposedComponentConfig } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';
import React from 'react';

import { ErrorView } from 'App/ErrorView';
import { Wingman } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { newMetricsTrail } from 'utils';

import { parsePromQLQuery } from '../extensions/links';
import pluginJson from '../plugin.json';

interface LabelBreakdownProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

function toSceneTime(time: string | number): string {
  if (typeof time === 'number') {
    // Convert a unix timestamp to a date string that SceneTimeRange can use
    return new Date(time).toISOString();
  }

  // Could be 'now', 'now-1h', etc. or a date string
  return time;
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

  return (
    <div data-testid="metrics-drilldown-embedded-label-breakdown">
      {error ? <ErrorView error={error} /> : <Wingman trail={trail} />}
    </div>
  );
};

export const labelBreakdownConfig: PluginExtensionExposedComponentConfig<LabelBreakdownProps> = {
  id: `${pluginJson.id}/label-breakdown-component/v1`,
  title: 'Label Breakdown',
  description: 'A metrics label breakdown view from the Metrics Drilldown app.',
  component: LabelBreakdown,
};
