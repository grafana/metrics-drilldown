import { css } from '@emotion/css';
import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstanceSettings } from '@grafana/plugin-compat/datasources';
import { type PromQuery } from '@grafana/prometheus';
import { getAppEvents, locationService, usePluginComponent } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useCallback, useMemo } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';
import { ROUTES } from 'shared/constants/routes';
import { logger } from 'shared/logger/logger';
import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getTrailFor } from 'shared/utils/utils';
import { getResponsiveBreakpoints } from 'shared/utils/utils.styles';

import { type OpenQueryLibraryComponentProps } from './savedQuery';

export interface LoadQuerySceneState extends SceneObjectState {
  dsName: string;
}

export class LoadQueryScene extends SceneObjectBase<LoadQuerySceneState> {
  private datasourceStateGeneration = 0;

  constructor(state: Partial<LoadQuerySceneState> = {}) {
    super({
      dsName: '',
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    const trail = getTrailFor(this);
    const dsVar = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);

    const uid = dsVar.getValue().toString();
    void this.updateDataSourceState(uid);

    this._subs.add(
      dsVar.subscribeToState((newState) => {
        const uid = newState.value.toString();
        void this.updateDataSourceState(uid);
      })
    );
  };

  private async updateDataSourceState(dsUid: string) {
    const generation = ++this.datasourceStateGeneration;
    this.setState({ dsName: '' });

    const settings = await getDataSourceInstanceSettings(dsUid).catch(() => {
      logger.debug(`getDataSourceInstanceSettings lookup failed`, { dsUid });
      return undefined;
    });
    if (generation !== this.datasourceStateGeneration) {
      return;
    }

    const dsName = settings?.name ?? '';
    this.setState({ dsName });
  }

  static readonly Component = ({ model }: SceneComponentProps<LoadQueryScene>) => {
    const { dsName } = model.useState();
    const styles = useStyles2(getStyles);

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

    if (isLoadingExposedComponent || !OpenQueryLibraryComponent || !dsName) {
      return null;
    }

    return (
      <div
        role="none"
        style={{ display: 'contents' }}
        onClick={() => reportExploreMetrics('saved_query_load_modal_opened', {})}
      >
        <OpenQueryLibraryComponent
          className={styles.button}
          context="drilldown"
          datasourceFilters={[dsName]}
          icon="folder-open"
          onSelectQuery={onSelectQuery}
          tooltip={t('metrics.metrics-drilldown.load-query.saved-query-button-tooltip', 'Load Saved query')}
        />
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    [getResponsiveBreakpoints(theme).down('lg')]: {
      alignSelf: 'flex-start',
    },
    alignSelf: 'flex-end',
  }),
});
