import { css } from '@emotion/css';
import { LoadingState, type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneQueryRunner, type CancelActivationHandler, type VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { isCounterMetric } from 'GmdVizPanel/matchers/isCounterMetric';
import { getTimeseriesQueryRunnerParams } from 'GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams';
import { reportExploreMetrics } from 'interactions';

import { isAllDataNaN } from './isAllDataNaN';

/**
 * A stateless function that detects when all data in a query result is NaN
 * and attempts to re-run the query with extreme value filtering.
 *
 * This addresses the issue where Prometheus metrics with extremely small values
 * (e.g., 9e-129) cause arithmetic operations during averaging to underflow
 * or become undefined, resulting in NaN for queries like `avg(some_metric_with_extreme_values)`.
 *
 * @remarks
 * Implementing this as a behavior allows us to apply the extreme values filtering
 * to only the queries that are affected by the extreme values, rather than all queries in the scene.
 * That way, we can keep queries simpler by default, and only apply the extreme values filtering
 * when it's necessary.
 */
export function extremeValueFilterBehavior(panel: VizPanel): CancelActivationHandler | void {
  // works only for timeseries panels...
  if (panel.state.pluginId !== 'timeseries') {
    return;
  }

  // ...with a query runner attached...
  const [queryRunner] = sceneGraph.findDescendents(panel, SceneQueryRunner);
  if (!queryRunner) {
    return;
  }

  // ...that has some queries...
  const { queries } = queryRunner.state;
  if (!queries?.length) {
    return;
  }

  const { metric, queryConfig } = sceneGraph.getAncestor(panel, GmdVizPanel).state;

  // ... and only for non-counter metrics, because counter metrics translate to rate queries (see getTimeseriesQueryRunnerParams.ts)
  // and this the behavior does not support it
  if (isCounterMetric(metric)) {
    return;
  }

  // When the query runner's state changes, check if the data is all NaN.
  // If it is, remove the extreme values from the query.
  const queryRunnerSub = queryRunner.subscribeToState((newState, prevState) => {
    // wait to receive series
    if (
      newState.data?.state !== LoadingState.Done ||
      !newState.data.series?.length ||
      newState.data.series === prevState.data?.series
    ) {
      return;
    }

    // discard the behaviour if non-timeseries data is received
    const dataFrameType = newState.data.series[0].meta?.type;
    if (dataFrameType && !dataFrameType.startsWith('timeseries')) {
      return;
    }

    // act only if all data is NaN
    if (!isAllDataNaN(newState.data.series)) {
      return;
    }

    // rebuild query with extreme values filtering
    const queryParams = getTimeseriesQueryRunnerParams({
      metric,
      queryConfig: { ...queryConfig, addExtremeValuesFiltering: true },
    });

    // update and run the new queries
    queryRunner.setState({ queries: queryParams.queries });
    queryRunner.runQueries();

    panel.setState({
      titleItems: (
        <VizPanelExtremeValuesMessage
          level="info"
          message="Panel data was re-fetched with a more complex query to handle extremely small values in the series"
        />
      ),
    });

    reportExploreMetrics('extreme_value_filter_behavior_triggered', {
      expression: sceneGraph.interpolate(queryRunner, queryRunner.state.queries[0].expr),
    });
  });

  return () => {
    queryRunnerSub.unsubscribe();
  };
}

interface VizPanelExtremeValuesMessageProps {
  message: string;
  level: 'warning' | 'info';
}

function VizPanelExtremeValuesMessage({ message, level }: Readonly<VizPanelExtremeValuesMessageProps>) {
  const styles = useStyles2(getStyles, level);

  return (
    <div className={styles.extremeValuedisclaimer}>
      <Tooltip content={message}>
        <span className={styles.warningMessage}>
          <Icon name={level === 'warning' ? 'exclamation-triangle' : 'info-circle'} aria-hidden="true" />
        </span>
      </Tooltip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, level: 'warning' | 'info') => ({
  extremeValuedisclaimer: css({
    label: 'extreme-value-disclaimer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: level === 'warning' ? theme.colors.warning.main : theme.colors.info.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
