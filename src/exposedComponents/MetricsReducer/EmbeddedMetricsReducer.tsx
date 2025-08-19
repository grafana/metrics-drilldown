import { type DataSourceApi } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ErrorView } from 'App/ErrorView';
import { Wingman } from 'App/Routes';
import { useCatchExceptions } from 'App/useCatchExceptions';
import { reportExploreMetrics } from 'interactions';
import { logger } from 'tracking/logger/logger';
import { newMetricsTrail } from 'utils';

import { parsePromQLQuery } from '../../extensions/links';
import { extractLabelsFromRateFunction, type PromQLLabelMatcher } from '../../utils/utils.promql';
import { findRecordingRuleByName, isRecordingRule } from '../../utils/utils.recording-rules';
import { toSceneTimeRange } from '../../utils/utils.timerange';

export interface EmbeddedMetricsReducerProps {
  query: string;
  initialStart: string | number;
  initialEnd: string | number;
  dataSource: DataSourceApi;
}

type LabelFetchStatus = 'idle' | 'loading' | 'done' | 'error';

const EmbeddedMetricsReducer = ({ query, initialStart, initialEnd, dataSource }: EmbeddedMetricsReducerProps) => {
  const [error] = useCatchExceptions();
  const { metric, labels: initialLabels } = parsePromQLQuery(query);
  const [labelFetchStatus, setLabelFetchStatus] = useState<LabelFetchStatus>('idle');
  const [labels, setLabels] = useState<PromQLLabelMatcher[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const trail = useMemo(
    () =>
      newMetricsTrail({
        initialDS: dataSource.uid,
        $timeRange: toSceneTimeRange(initialStart, initialEnd),
        initialFilters: labels.map((labelMatcher: PromQLLabelMatcher) => ({
          key: labelMatcher.label,
          operator: labelMatcher.op,
          value: labelMatcher.value,
        })),
        metric: selectedMetric ?? undefined,
        embedded: true,
      }),
    [labels, dataSource.uid, selectedMetric, initialStart, initialEnd]
  );

  const initRef = useRef(false);

  useEffect(() => {
    // Report the expose component usage only once
    if (!initRef.current) {
      initRef.current = true;
      reportExploreMetrics('exposed_component_viewed', { component: 'embedded_metrics_reducer' });
    }
  }, []);

  useEffect(() => {
    if (labelFetchStatus !== 'idle') {
      return;
    }

    setLabelFetchStatus('loading');

    if (isRecordingRule(metric)) {
      // If the metric is a recording rule, we find the relevant labels inside the recording rule expression.
      // We use those labels to show all Source Metrics in the Metrics Reducer view, so the user can choose
      // the Source Metric of interest.
      setLabelsFromRecordingRule(metric, dataSource, initialLabels, setLabelFetchStatus, setLabels);
    } else {
      // If not a recording rule, we assume the metric in the query is a source metric.
      // If it's a source metric, we can pre-select it and go directly to the Label Breakdown view.
      setLabelFetchStatus('done');
      setSelectedMetric(metric);
      setLabels(initialLabels);
    }
  }, [metric, dataSource, initialLabels, labelFetchStatus, setLabelFetchStatus]);

  if (error) {
    return <ErrorView error={error} />;
  }

  if (labelFetchStatus === 'idle' || labelFetchStatus === 'loading') {
    return <LoadingPlaceholder text="Loading..." />;
  }

  return <EmbeddedMetricsReducerWrapper>{trail && <Wingman trail={trail} />}</EmbeddedMetricsReducerWrapper>;
};

const EmbeddedMetricsReducerWrapper = ({ children }: { children: React.ReactNode }) => {
  const [error] = useCatchExceptions();

  if (error) {
    return <ErrorView error={error} />;
  }

  return <div data-testid="metrics-drilldown-embedded-metrics-reducer">{children}</div>;
};

export default EmbeddedMetricsReducer;

const setLabelsFromRecordingRule = async (
  metric: string,
  dataSource: DataSourceApi,
  initialLabels: PromQLLabelMatcher[],
  setLabelFetchStatus: (status: LabelFetchStatus) => void,
  setLabels: (labels: PromQLLabelMatcher[]) => void
): Promise<void> => {
  try {
    const recordingRule = await findRecordingRuleByName(metric, dataSource);

    if (!recordingRule) {
      throw new Error(`Recording rule ${metric} not found in data source ${dataSource.name}`);
    }

    const parsedQuery = extractLabelsFromRateFunction(recordingRule.query);

    if (parsedQuery.hasErrors) {
      throw new Error(`Recording rule ${metric} has errors: ${parsedQuery.errors.join(', ')}`);
    }

    setLabelFetchStatus('done');
    setLabels(parsedQuery.labels);
  } catch (error) {
    setLabelFetchStatus('error');

    if (error instanceof Error) {
      logger.error(error);
    } else {
      logger.error(new Error(`Error fetching recording rule expression: ${error}`));
    }

    // Fallback to the initial labels if the recording rule parsing fails
    setLabels(initialLabels);
  }
};
