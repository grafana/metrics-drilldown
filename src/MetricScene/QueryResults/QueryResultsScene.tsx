import { css } from '@emotion/css';
import { LoadingState, type GrafanaTheme2 } from '@grafana/data';
import { usePluginComponent } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Spinner, useStyles2 } from '@grafana/ui';
import { useResizeObserver } from '@react-aria/utils';
import React, { createElement, useLayoutEffect, useRef, useState } from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';

import { InlineBanner } from '../../App/InlineBanner';
import { getTrailFor } from '../../shared/utils/utils';
import { getAppBackgroundColor } from '../../shared/utils/utils.styles';
import { actionViews } from '../MetricActionBar';
import { signalOnQueryComplete } from '../utils/signalOnQueryComplete';
import { PROMETHEUS_QUERY_RESULTS_COMPONENT_ID, PrometheusQueryResultsV1Props } from './constants';

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  // Measure initial width synchronously before first paint
  useLayoutEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
  }, []);

  useResizeObserver({
    ref,
    onResize: () => {
      requestAnimationFrame(() => {
        if (ref.current) {
          setWidth(ref.current.offsetWidth);
        }
      });
    },
  });

  return { ref, width };
}

interface QueryResultsSceneState extends SceneObjectState {
  metric: string;
}

export class QueryResultsScene extends SceneObjectBase<QueryResultsSceneState> {
  constructor({ metric }: { metric: QueryResultsSceneState['metric'] }) {
    super({
      metric,
      $data: new SceneQueryRunner({
        datasource: trailDS,
        queries: [
          {
            refId: 'instant-query-results',
            expr: buildQueryExpression({
              metric: { name: metric, type: getMetricTypeSync(metric) as MetricType },
              addIgnoreUsageFilter: true,
            }),
            instant: true,
            format: 'table',
          },
        ],
      }),
      $behaviors: [new behaviors.SceneQueryController()],
      key: 'QueryResultsScene',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    signalOnQueryComplete(this, actionViews.queryResults);
  }

  public static readonly Component = ({ model }: SceneComponentProps<QueryResultsScene>) => {
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail);

    // Get data from the SceneQueryRunner
    const dataProvider = sceneGraph.getData(model);
    const { data } = dataProvider.useState();
    const tableResult = data?.series || [];
    const loadingState = data?.state || LoadingState.Loading;

    const { component: InstantQueryResults, isLoading: isLoadingQueryResults } = usePluginComponent(
      PROMETHEUS_QUERY_RESULTS_COMPONENT_ID
    );

    const { ref: containerRef, width } = useElementWidth<HTMLDivElement>();

    const hasError = data?.state === LoadingState.Error;
    const isLoading = loadingState === LoadingState.Loading || isLoadingQueryResults;

    return (
      <div className={styles.container} ref={containerRef}>
        {isLoading && <Spinner />}
        {hasError && data?.errors && (
          <InlineBanner severity="error" title="Query failed" error={data.errors[0] as Error} />
        )}
        {!InstantQueryResults && !isLoadingQueryResults && (
          <InlineBanner severity="warning" title="Query Results component unavailable">
            This feature requires a newer version of Grafana.
          </InlineBanner>
        )}
        {InstantQueryResults &&
          !isLoadingQueryResults &&
          !hasError &&
          createElement(InstantQueryResults as React.ComponentType<PrometheusQueryResultsV1Props>, {
            tableResult,
            timeZone: 'browser',
            loading: loadingState,
            showRawPrometheus: true,
            width,
          })}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, trail: DataTrail) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      background: getAppBackgroundColor(theme, trail),
      padding: theme.spacing(1, 0),
    }),
  };
}
