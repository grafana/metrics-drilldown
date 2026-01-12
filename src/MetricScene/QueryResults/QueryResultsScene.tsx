import { css } from '@emotion/css';
import { LoadingState, type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { useResizeObserver } from '@react-aria/utils';
import React, { createElement, useLayoutEffect, useRef, useState } from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';

import { DEFAULT_QUERY_RESULTS_TABLE_WIDTH, type PrometheusQueryResultsV1Props } from './constants';
import { InlineBanner } from '../../App/InlineBanner';
import { getTrailFor } from '../../shared/utils/utils';
import { getAppBackgroundColor } from '../../shared/utils/utils.styles';
import { actionViews } from '../MetricActionBar';
import { signalOnQueryComplete } from '../utils/signalOnQueryComplete';

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(DEFAULT_QUERY_RESULTS_TABLE_WIDTH);

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
  queryResultsComponent?: React.ComponentType<PrometheusQueryResultsV1Props>;
}

export class QueryResultsScene extends SceneObjectBase<QueryResultsSceneState> {
  constructor({
    metric,
    queryResultsComponent,
  }: {
    metric: QueryResultsSceneState['metric'];
    queryResultsComponent?: QueryResultsSceneState['queryResultsComponent'];
  }) {
    super({
      metric,
      queryResultsComponent,
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
    const { queryResultsComponent: InstantQueryResults } = model.useState();

    // Get data from the SceneQueryRunner
    const dataProvider = sceneGraph.getData(model);
    const { data } = dataProvider.useState();
    const tableResult = data?.series || [];
    const loadingState = data?.state || LoadingState.Loading;

    const { ref: containerRef, width } = useElementWidth<HTMLDivElement>();

    const hasError = data?.state === LoadingState.Error;

    return (
      <div className={styles.container} ref={containerRef}>
        {hasError && data?.errors && (
          <InlineBanner severity="error" title="Query failed" error={data.errors[0] as Error} />
        )}
        {!InstantQueryResults && (
          <InlineBanner severity="warning" title="Query Results component unavailable">
            This feature requires a newer version of Grafana.
          </InlineBanner>
        )}
        {InstantQueryResults &&
          !hasError &&
          createElement(InstantQueryResults, {
            tableResult,
            timeZone: 'browser',
            loading: loadingState,
            showRawPrometheus: true,
            width,
            ariaLabel: 'Instant query results',
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
