import { css } from '@emotion/css';
import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type PromQuery } from '@grafana/prometheus';
import { getAppEvents, locationService, usePluginComponent } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';
import { ROUTES } from 'shared/constants/routes';
import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getTrailFor } from 'shared/utils/utils';

import { LoadQueryModal } from './LoadQueryModal';
import { isQueryLibrarySupported, useHasSavedQueries, type OpenQueryLibraryComponentProps } from './savedQuery';

export interface LoadQuerySceneState extends SceneObjectState {
  dsName: string;
  dsUid: string | undefined;
  isOpen: boolean;
}

export class LoadQueryScene extends SceneObjectBase<LoadQuerySceneState> {
  constructor(state: Partial<LoadQuerySceneState> = {}) {
    super({
      dsUid: undefined,
      dsName: '',
      isOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    const trail = getTrailFor(this);
    const dsVar = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);

    this.setState({
      dsUid: dsVar.getValue().toString(),
      dsName: dsVar.state.text?.toString() ?? '',
    });

    this._subs.add(
      dsVar.subscribeToState((newState) => {
        this.setState({
          dsUid: newState.value.toString(),
          dsName: newState.text?.toString() ?? '',
        });
      })
    );
  };

  toggleOpen = () => {
    this.setState({
      isOpen: true,
    });
  };

  toggleClosed = () => {
    this.setState({
      isOpen: false,
    });
  };

  static readonly Component = ({ model }: SceneComponentProps<LoadQueryScene>) => {
    const { dsName, dsUid, isOpen } = model.useState();
    const styles = useStyles2(getStyles);
    const hasSavedQueries = useHasSavedQueries(dsUid);

    const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
      usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

    const trail = useMemo(() => getTrailFor(model), [model]);

    const onSelectQuery = useCallback(
      (query: PromQuery) => {
        const appEvents = getAppEvents();

        if (query.datasource?.type !== 'prometheus') {
          appEvents.publish({
            payload: [t('metrics.metrics-drilldown.load-query.load-type-error', 'Please select a Prometheus query.')],
            type: AppEvents.alertError.name,
          });
          return;
        }

        try {
          const { metric, labels } = parsePromQLQuery(query.expr);
          const timeRange = sceneGraph.getTimeRange(trail).state.value.raw;
          const promURLObject = createPromURLObject(
            query.datasource?.uid,
            labels,
            metric,
            timeRange.from.toString(),
            timeRange.to.toString()
          );
          const params = buildNavigateToMetricsParams(promURLObject);
          locationService.push(createAppUrl(ROUTES.Drilldown, params));
          reportExploreMetrics('saved_query_loaded_from_library', {});
        } catch {
          appEvents.publish({
            payload: [
              t(
                'metrics.metrics-drilldown.load-query.load-error',
                'This query contains expressions that cannot be represented in Metrics Drilldown. Only simple metric{label} selectors are supported.'
              ),
            ],
            type: AppEvents.alertError.name,
          });
        }
      },
      [trail]
    );

    if (trail.state.embedded) {
      return null;
    }

    if (!isQueryLibrarySupported()) {
      return (
        <>
          <ToolbarButton
            icon="folder-open"
            variant="canvas"
            disabled={!hasSavedQueries}
            onClick={model.toggleOpen}
            className={styles.button}
            tooltip={
              hasSavedQueries
                ? t('metrics.metrics-drilldown.load-query.button-tooltip', 'Load saved query')
                : t('metrics.metrics-drilldown.load-query.button-no-query-tooltip', 'No saved queries to load')
            }
          />
          {isOpen && <LoadQueryModal sceneRef={model} onClose={model.toggleClosed} />}
        </>
      );
    } else if (isLoadingExposedComponent || !OpenQueryLibraryComponent) {
      return null;
    }

    return (
      <OpenQueryLibraryComponent
        className={styles.button}
        context="drilldown"
        datasourceFilters={[dsName]}
        icon="folder-open"
        onSelectQuery={onSelectQuery}
        tooltip={t('metrics.metrics-drilldown.load-query.saved-query-button-tooltip', 'Load saved query')}
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    [theme.breakpoints.down('lg')]: {
      alignSelf: 'flex-start',
    },
    alignSelf: 'flex-end',
  }),
});
